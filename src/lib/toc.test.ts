import { describe, it, expect } from "vitest";
import { extractHeadings } from "./toc";

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
