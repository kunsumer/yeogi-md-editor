import { describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { FolderPanel } from "./FolderPanel";

vi.mock("../../lib/ipc/commands", () => ({
  fsList: vi.fn(async () => []),
}));

// Small helper so each test doesn't need to spell out every no-op callback.
function baseProps(overrides: Partial<React.ComponentProps<typeof FolderPanel>> = {}) {
  return {
    folder: null,
    extraFolders: [],
    activeDocPath: null,
    onPickFolder: () => {},
    onCloseFolder: () => {},
    onOpenFile: () => {},
    ...overrides,
  };
}

describe("FolderPanel", () => {
  it("shows an empty state with a Choose folder… button when no folder is set", () => {
    const onPickFolder = vi.fn();
    render(<FolderPanel {...baseProps({ onPickFolder })} />);
    expect(screen.getByText(/No folder open/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Choose folder/i });
    fireEvent.click(btn);
    expect(onPickFolder).toHaveBeenCalledTimes(1);
  });

  it("renders the folder basename in the FolderGroup header when a folder is set", () => {
    render(<FolderPanel {...baseProps({ folder: "/Users/me/Notes" })} />);
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });

  it("renders each folder as its own group with a close button (primary + extras)", () => {
    const onClose = vi.fn();
    render(
      <FolderPanel
        {...baseProps({
          folder: "/Users/me/Primary",
          extraFolders: ["/Users/me/Extra1", "/Users/me/Extra2"],
          onCloseFolder: onClose,
        })}
      />,
    );
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Extra1")).toBeInTheDocument();
    expect(screen.getByText("Extra2")).toBeInTheDocument();
    // Every folder group has a close button — 3 total (1 primary + 2 extras).
    const closeBtns = screen.getAllByRole("button", { name: /Close folder/i });
    expect(closeBtns).toHaveLength(3);
    // First in DOM order is the primary group's close button.
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledWith("/Users/me/Primary");
    onClose.mockClear();
    fireEvent.click(closeBtns[1]);
    expect(onClose).toHaveBeenCalledWith("/Users/me/Extra1");
  });

  it("fires onPickFolder when the Open-folder button in the toolbar is clicked", () => {
    const onPickFolder = vi.fn();
    render(
      <FolderPanel {...baseProps({ folder: "/Users/me/Notes", onPickFolder })} />,
    );
    // The toolbar Open-folder button is the one labelled "Open folder";
    // the empty-state "Choose folder…" button doesn't appear once a folder
    // is set, so this is unambiguous.
    const btn = screen.getByRole("button", { name: /Open folder/i });
    fireEvent.click(btn);
    expect(onPickFolder).toHaveBeenCalledTimes(1);
  });

  it("defaults selection to the folder containing the active document", () => {
    const { container } = render(
      <FolderPanel
        {...baseProps({
          folder: "/Users/me/Primary",
          extraFolders: ["/Users/me/Extra"],
          activeDocPath: "/Users/me/Extra/sub/note.md",
        })}
      />,
    );
    // Only the Extra folder section should carry aria-current="true".
    const sections = container.querySelectorAll("section[aria-label]");
    const aria = Array.from(sections).map((s) => ({
      label: s.getAttribute("aria-label"),
      current: s.getAttribute("aria-current"),
    }));
    expect(aria).toContainEqual({ label: "Primary", current: null });
    expect(aria).toContainEqual({ label: "Extra", current: "true" });
  });

  it("clicking a folder header makes it the selected (highlighted) tree", () => {
    const { container } = render(
      <FolderPanel
        {...baseProps({
          folder: "/Users/me/Primary",
          extraFolders: ["/Users/me/Extra"],
          activeDocPath: "/Users/me/Primary/Welcome.md",
        })}
      />,
    );
    // Default selection follows the active doc → Primary is selected.
    const primarySection = container.querySelector(
      'section[aria-label="Primary"]',
    );
    const extraSection = container.querySelector('section[aria-label="Extra"]');
    expect(primarySection?.getAttribute("aria-current")).toBe("true");
    expect(extraSection?.getAttribute("aria-current")).toBeNull();

    // Click on Extra's header strip → manual override; selection moves.
    fireEvent.mouseDown(extraSection!);
    expect(
      container
        .querySelector('section[aria-label="Extra"]')
        ?.getAttribute("aria-current"),
    ).toBe("true");
    expect(
      container
        .querySelector('section[aria-label="Primary"]')
        ?.getAttribute("aria-current"),
    ).toBeNull();
  });

  it("picks the deepest matching root when folders are nested (default selection)", () => {
    const { container } = render(
      <FolderPanel
        {...baseProps({
          folder: "/Users/me",
          // /Users/me/repo is a subdirectory of /Users/me — both are open.
          extraFolders: ["/Users/me/repo"],
          activeDocPath: "/Users/me/repo/notes/draft.md",
        })}
      />,
    );
    // The deeper match (/Users/me/repo) wins; outer folder stays unmarked.
    const sections = container.querySelectorAll("section[aria-label]");
    const aria = Array.from(sections).map((s) => ({
      label: s.getAttribute("aria-label"),
      current: s.getAttribute("aria-current"),
    }));
    expect(aria).toContainEqual({ label: "me", current: null });
    expect(aria).toContainEqual({ label: "repo", current: "true" });
  });
});

describe("FolderPanel reload feedback", () => {
  it("spins while reloading, announces completion, then stops upright", async () => {
    render(<FolderPanel {...baseProps({ folder: "/root" })} />);
    // Wait for the group header so the initial tree fetch isn't racing
    // the reload below.
    await screen.findByText("root");

    const btn = screen.getByRole("button", { name: "Reload folders" });
    expect(btn).toHaveAttribute("data-reload-state", "idle");
    expect(btn).toHaveAttribute("aria-busy", "false");

    fireEvent.click(btn);

    // The in-progress state is immediate and must be visible + announced
    // (the mocked fetch can't resolve until the test yields a microtask,
    // so this is deterministic).
    expect(btn).toHaveAttribute("data-reload-state", "reloading");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reloading folder contents…",
    );

    // Honest completion: announced only after the tree's refetch reports
    // back. The icon keeps spinning a little longer — it finishes the
    // current rotation — but the WORK state (live region + aria-busy)
    // flips at the real completion moment.
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });
    expect(btn).toHaveAttribute("aria-busy", "false");
    expect(btn).toHaveAttribute("data-reload-state", "reloading");

    // The spin tail is transient — the icon stops at the next whole
    // rotation and the announcement clears.
    await waitFor(
      () => expect(btn).toHaveAttribute("data-reload-state", "idle"),
      { timeout: 3000 },
    );
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("does not hang when every folder group is collapsed", async () => {
    render(<FolderPanel {...baseProps({ folder: "/root" })} />);
    await screen.findByText("root");

    // Collapse the group — its FileTree unmounts, so no tree will report.
    fireEvent.click(screen.getByRole("button", { name: "Collapse folder" }));

    const btn = screen.getByRole("button", { name: "Reload folders" });
    fireEvent.click(btn);

    // Nothing was mounted to reload; the spin still shows one rotation
    // for feedback, completion is announced, and the icon stops instead
    // of spinning forever.
    expect(btn).toHaveAttribute("data-reload-state", "reloading");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });
    await waitFor(
      () => expect(btn).toHaveAttribute("data-reload-state", "idle"),
      { timeout: 3000 },
    );
  });

  it("announces completion only after ALL visible trees report (multi-root)", async () => {
    const { fsList } = await import("../../lib/ipc/commands");
    const fsListMock = vi.mocked(fsList);
    render(
      <FolderPanel
        {...baseProps({ folder: "/a", extraFolders: ["/b"] })}
      />,
    );
    await screen.findByText("a");
    await screen.findByText("b");

    // Reload fetches hang until each root is released explicitly.
    const release = new Map<string, () => void>();
    fsListMock.mockImplementation(
      (p: string) =>
        new Promise((resolve) => {
          release.set(p, () => resolve([]));
        }),
    );

    const btn = screen.getByRole("button", { name: "Reload folders" });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-reload-state", "reloading");

    // First tree reporting is NOT completion — /b is still fetching.
    release.get("/a")!();
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reloading folder contents…",
    );

    release.get("/b")!();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });
    // Restore the suite-wide default so later tests' mount fetches resolve.
    fsListMock.mockImplementation(async () => []);
  });

  it("ignores stale reports from a superseded reload (rapid double-click)", async () => {
    const { fsList } = await import("../../lib/ipc/commands");
    const fsListMock = vi.mocked(fsList);
    render(<FolderPanel {...baseProps({ folder: "/root" })} />);
    await screen.findByText("root");

    let release!: () => void;
    fsListMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );

    const btn = screen.getByRole("button", { name: "Reload folders" });
    // Two clicks in a row: the second bumps the seq, which re-runs the
    // tree's reload effect — its cleanup fires a cancellation report for
    // the FIRST seq. That stale report must not drain the new tracker
    // into a false "reloaded" announcement.
    fireEvent.click(btn);
    fireEvent.click(btn);
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reloading folder contents…",
    );

    // Completing the second reload's fetch is what finishes it.
    release();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });
    // Restore the suite-wide default so later tests' mount fetches resolve.
    fsListMock.mockImplementation(async () => []);
  });

  it("stops spinning under React.StrictMode (the app renders inside it)", async () => {
    // StrictMode mounts → unmounts → remounts in dev. A cleanup that sets
    // an "unmounted" flag without the setup resetting it leaves the flag
    // stuck at true — finishReload then never schedules the stop timer
    // and the icon spins forever. Render exactly like main.tsx does.
    render(
      <StrictMode>
        <FolderPanel {...baseProps({ folder: "/root" })} />
      </StrictMode>,
    );
    await screen.findByText("root");

    const btn = screen.getByRole("button", { name: "Reload folders" });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-reload-state", "reloading");

    await waitFor(
      () => expect(btn).toHaveAttribute("data-reload-state", "idle"),
      { timeout: 3000 },
    );
  });

  it("is not stopped mid-flight by the previous reload's spin-tail timer", async () => {
    const { fsList } = await import("../../lib/ipc/commands");
    const fsListMock = vi.mocked(fsList);
    render(<FolderPanel {...baseProps({ folder: "/root" })} />);
    await screen.findByText("root");

    const btn = screen.getByRole("button", { name: "Reload folders" });

    // First reload completes normally → completion announced, the
    // spin-tail stop timer is armed.
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });

    // Second reload starts DURING the tail and hangs longer than the
    // remainder of the rotation window.
    let release!: () => void;
    fsListMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("data-reload-state", "reloading");

    // Ride out the stale timer's window — the spinner must survive it.
    await new Promise((r) => setTimeout(r, 1000));
    expect(btn).toHaveAttribute("data-reload-state", "reloading");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reloading folder contents…",
    );

    release();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Folder contents reloaded",
      );
    });
  });
});
