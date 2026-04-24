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
    onPickFolder: () => {},
    onAddFolder: () => {},
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

  it("fires onAddFolder when the Add-folder button is clicked", () => {
    const onAddFolder = vi.fn();
    render(
      <FolderPanel {...baseProps({ folder: "/Users/me/Notes", onAddFolder })} />,
    );
    const btn = screen.getByRole("button", { name: /Add another folder/i });
    fireEvent.click(btn);
    expect(onAddFolder).toHaveBeenCalledTimes(1);
  });
});
