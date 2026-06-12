import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("reports reload completion via onReloadDone after a reloadSeq bump", async () => {
    const onReloadDone = vi.fn();
    const { rerender, unmount } = render(
      <FileTree
        root="/root"
        onOpenFile={() => {}}
        reloadSeq={0}
        onReloadDone={onReloadDone}
      />,
    );
    await screen.findByText("a.md");
    expect(onReloadDone).not.toHaveBeenCalled();

    rerender(
      <FileTree
        root="/root"
        onOpenFile={() => {}}
        reloadSeq={1}
        onReloadDone={onReloadDone}
      />,
    );
    await waitFor(() => {
      expect(onReloadDone).toHaveBeenCalledWith("/root", 1);
    });
    expect(onReloadDone).toHaveBeenCalledTimes(1);

    // The cleanup path must NOT double-report a seq that already
    // completed — unmount immediately and recount.
    unmount();
    expect(onReloadDone).toHaveBeenCalledTimes(1);
  });

  it("reports a cancelled reload on unmount so trackers never hang", async () => {
    const fsListMock = vi.mocked((await import("../../lib/ipc/commands")).fsList);
    const onReloadDone = vi.fn();
    const { rerender, unmount } = render(
      <FileTree
        root="/root"
        onOpenFile={() => {}}
        reloadSeq={0}
        onReloadDone={onReloadDone}
      />,
    );
    await screen.findByText("a.md");

    // Make the next fsList hang so the reload stays in-flight.
    let release!: () => void;
    fsListMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );
    rerender(
      <FileTree
        root="/root"
        onOpenFile={() => {}}
        reloadSeq={1}
        onReloadDone={onReloadDone}
      />,
    );
    expect(onReloadDone).not.toHaveBeenCalled();

    unmount();
    expect(onReloadDone).toHaveBeenCalledWith("/root", 1);
    expect(onReloadDone).toHaveBeenCalledTimes(1);

    // Releasing the hung fetch after the fact must not produce a second
    // report — flush the async continuation before recounting.
    release();
    await Promise.resolve();
    await Promise.resolve();
    expect(onReloadDone).toHaveBeenCalledTimes(1);
  });
});
