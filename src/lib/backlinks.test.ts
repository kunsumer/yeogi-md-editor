import { describe, it, expect } from "vitest";
import { extractPreviewLine, findLinksTo } from "./backlinks";

describe("findLinksTo", () => {
  it("returns null when no links match", () => {
    expect(findLinksTo("plain text", "foo")).toBeNull();
    expect(findLinksTo("[[Bar]] is here", "foo")).toBeNull();
  });

  it("finds a single [[target]] match, case-insensitively", () => {
    const r = findLinksTo("See [[Welcome]] for context.", "welcome");
    expect(r).not.toBeNull();
    expect(r!.count).toBe(1);
    expect(r!.firstIdx).toBe(4);
    expect(r!.firstLen).toBe("[[Welcome]]".length);
  });

  it("counts all occurrences and returns the first", () => {
    const text = "[[Doc]] then [[doc]] and also [[DOC]].";
    const r = findLinksTo(text, "doc");
    expect(r!.count).toBe(3);
    expect(r!.firstIdx).toBe(0);
  });

  it("counts piped-form links as matches on the target side only", () => {
    const text = "Earlier: [[Welcome|intro]] matters.";
    const r = findLinksTo(text, "welcome");
    expect(r!.count).toBe(1);
  });

  it("does not match when target differs even with same display text", () => {
    const text = "[[NotThis|welcome]] pipes display side only.";
    expect(findLinksTo(text, "welcome")).toBeNull();
  });

  it("ignores malformed unclosed brackets", () => {
    expect(findLinksTo("[[Welcome", "welcome")).toBeNull();
  });
});

describe("extractPreviewLine", () => {
  it("returns the trimmed line containing the match when short", () => {
    const text = "line one\n   Look at [[Welcome]] here   \nline three";
    const matchStart = text.indexOf("[[");
    const line = extractPreviewLine(text, matchStart, "[[Welcome]]".length);
    expect(line).toBe("Look at [[Welcome]] here");
  });

  it("truncates long lines with ellipses centered on the match", () => {
    const prefix = "x".repeat(200);
    const suffix = "y".repeat(200);
    const text = `${prefix} [[Welcome]] ${suffix}`;
    const matchStart = text.indexOf("[[");
    const line = extractPreviewLine(text, matchStart, "[[Welcome]]".length);
    expect(line.startsWith("…")).toBe(true);
    expect(line.endsWith("…")).toBe(true);
    expect(line).toContain("[[Welcome]]");
    expect(line.length).toBeLessThanOrEqual(122); // PREVIEW_MAX + 2 for the ellipses
  });

  it("handles a match on the first line of a file", () => {
    const text = "[[Welcome]] is the first thing in the file.";
    const line = extractPreviewLine(text, 0, "[[Welcome]]".length);
    expect(line).toBe(text);
  });
});
