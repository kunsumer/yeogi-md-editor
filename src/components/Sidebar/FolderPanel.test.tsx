import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
