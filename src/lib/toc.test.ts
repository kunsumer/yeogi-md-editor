import { describe, it, expect } from "vitest";
import { extractBlocks, extractHeadings } from "./toc";

describe("extractHeadings", () => {
  it("picks up ATX headings with correct levels and lines", () => {
    const md = "# One\n\ntext\n\n## Two\n\n### Three point five\n";
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: "One", line: 1 },
      { level: 2, text: "Two", line: 5 },
      { level: 3, text: "Three point five", line: 7 },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const md = "# Real\n\n```md\n# Fake\n```\n\n## Another real\n";
    const headings = extractHeadings(md);
    expect(headings.map((h: { text: string }) => h.text)).toEqual(["Real", "Another real"]);
  });

  it("strips trailing hashes and whitespace", () => {
    expect(extractHeadings("## Hello ##\n")).toEqual([{ level: 2, text: "Hello", line: 1 }]);
  });

  it("requires a space after the #", () => {
    // "#notheading" is not an ATX heading in CommonMark
    expect(extractHeadings("#notheading\n")).toEqual([]);
  });
});

describe("extractBlocks", () => {
  it("returns one entry per top-level block with its start line", () => {
    const md = "# H1\n\nA paragraph.\n\n- a\n- b\n\n```\ncode\n```\n";
    expect(extractBlocks(md)).toEqual([
      { type: "heading", line: 1 },
      { type: "paragraph", line: 3 },
      { type: "list", line: 5 },
      { type: "code", line: 8 },
    ]);
  });

  it("skips link reference definitions (invisible in rendered output)", () => {
    const md = "Text.\n\n[foo]: https://x.com\n\nMore.\n";
    expect(extractBlocks(md).map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });

  it("collapses consecutive footnoteDefinitions into one anchor", () => {
    const md = "text[^1] and[^2]\n\n[^1]: one\n[^2]: two\n";
    const result = extractBlocks(md);
    expect(result.map((b) => b.type)).toEqual(["paragraph", "footnoteSection"]);
  });

  it("captures thematicBreak, blockquote, and table as blocks", () => {
    const md = "A\n\n---\n\n> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    expect(extractBlocks(md).map((b) => b.type)).toEqual([
      "paragraph",
      "thematicBreak",
      "blockquote",
      "table",
    ]);
  });
});
