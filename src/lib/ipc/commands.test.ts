import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

import { fsRead, fsWrite } from "./commands";

describe("ipc wrappers", () => {
  beforeEach(() => invoke.mockReset());

  it("fsRead forwards path", async () => {
    invoke.mockResolvedValue({ content: "x", mtime_ms: 1, encoding: "utf-8" });
    const r = await fsRead("/p/a.md");
    expect(invoke).toHaveBeenCalledWith("fs_read", { path: "/p/a.md" });
    expect(r.content).toBe("x");
  });

  it("fsWrite forwards path and content", async () => {
    invoke.mockResolvedValue({ mtime_ms: 2 });
    const r = await fsWrite("/p/a.md", "hello");
    expect(invoke).toHaveBeenCalledWith("fs_write", { path: "/p/a.md", content: "hello" });
    expect(r.mtime_ms).toBe(2);
  });
});
