import { describe, it, expect } from "vitest";
import { isMarkdownPath } from "./isMarkdownPath";

describe("isMarkdownPath", () => {
  it.each([
    "/x/y.md",
    "/x/y.markdown",
    "/x/y.mdown",
    "/x/y.mkd",
    "Welcome.MD",
    "/x/y.MARKDOWN",
  ])("treats %s as markdown", (p) => {
    expect(isMarkdownPath(p)).toBe(true);
  });

  it.each([
    "/x/notes.txt",
    "/x/config.json",
    "/x/build.sh",
    "/x/server.log",
    "/x/data.csv",
    "/x/.gitignore",
    "/x/README", // no extension
  ])("treats %s as non-markdown", (p) => {
    expect(isMarkdownPath(p)).toBe(false);
  });

  it("treats untitled buffers (null/undefined path) as markdown", () => {
    expect(isMarkdownPath(null)).toBe(true);
    expect(isMarkdownPath(undefined)).toBe(true);
  });

  it("does not match files whose name only contains the extension as substring", () => {
    expect(isMarkdownPath("/x/mdfile.txt")).toBe(false);
    expect(isMarkdownPath("/x/markdown-helper.json")).toBe(false);
  });
});
