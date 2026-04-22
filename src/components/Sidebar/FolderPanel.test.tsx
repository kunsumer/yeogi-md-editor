import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderPanel } from "./FolderPanel";

vi.mock("../../lib/ipc/commands", () => ({
  fsList: vi.fn(async () => []),
}));

describe("FolderPanel", () => {
  it("shows an empty state with a Choose folder… button when no folder is set", () => {
    const onPickFolder = vi.fn();
    render(
      <FolderPanel folder={null} onPickFolder={onPickFolder} onOpenFile={() => {}} />,
    );
    expect(screen.getByText(/No folder open/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Choose folder/i });
    fireEvent.click(btn);
    expect(onPickFolder).toHaveBeenCalledTimes(1);
  });

  it("renders the folder basename in the panel header when a folder is set", () => {
    render(
      <FolderPanel
        folder="/Users/me/Notes"
        onPickFolder={() => {}}
        onOpenFile={() => {}}
      />,
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });
});
