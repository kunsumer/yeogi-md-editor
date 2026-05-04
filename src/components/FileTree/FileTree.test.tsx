import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/ipc/commands", () => ({
  fsList: vi.fn(async (p: string) => {
    if (p === "/root")
      return [
        { name: "sub", path: "/root/sub", is_dir: true },
        { name: "a.md", path: "/root/a.md", is_dir: false },
      ];
    return [{ name: "b.md", path: "/root/sub/b.md", is_dir: false }];
  }),
}));

import { FileTree } from "./FileTree";

describe("FileTree", () => {
  it("lists files and opens on click", async () => {
    const onOpenFile = vi.fn();
    render(<FileTree root="/root" onOpenFile={onOpenFile} />);
    const item = await screen.findByText("a.md");
    await userEvent.click(item);
    expect(onOpenFile).toHaveBeenCalledWith("/root/a.md", undefined);
  });

  it("expands folders and shows children", async () => {
    render(<FileTree root="/root" onOpenFile={() => {}} />);
    const folder = await screen.findByText("sub");
    await userEvent.click(folder);
    await screen.findByText("b.md");
  });

  it("forwards metaKey on file click", async () => {
    const onOpenFile = vi.fn();
    render(<FileTree root="/root" onOpenFile={onOpenFile} />);
    const item = await screen.findByText("a.md");
    fireEvent.click(item, { metaKey: true });
    expect(onOpenFile).toHaveBeenCalledWith("/root/a.md", { toSide: true });
  });
});
