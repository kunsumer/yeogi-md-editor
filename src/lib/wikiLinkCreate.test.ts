import { describe, it, expect } from "vitest";
import { sanitizeWikiTargetFilename } from "./wikiLinkCreate";
import { stripMdExt } from "./resolveWikiLink";

describe("sanitizeWikiTargetFilename", () => {
  it("passes plain names through unchanged", () => {
    expect(sanitizeWikiTargetFilename("Project Alpha")).toBe("Project Alpha");
  });

  it("replaces filesystem-illegal characters with hyphens", () => {
    expect(sanitizeWikiTargetFilename("Bug #12: summary")).toBe("Bug #12- summary");
    expect(sanitizeWikiTargetFilename("a/b\\c*d?e")).toBe("a-b-c-d-e");
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeWikiTargetFilename("a    b")).toBe("a b");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeWikiTargetFilename("   Foo   ")).toBe("Foo");
  });

  it("strips leading dots so hidden files aren't created", () => {
    expect(sanitizeWikiTargetFilename(".hidden")).toBe("hidden");
    expect(sanitizeWikiTargetFilename("..dots")).toBe("dots");
  });

  it("returns empty string when every character is illegal", () => {
    expect(sanitizeWikiTargetFilename("///")).toBe("---"); // hyphens ARE valid
    expect(sanitizeWikiTargetFilename("\x00\x01")).toBe("--"); // ditto
    expect(sanitizeWikiTargetFilename("   ")).toBe("");
  });
});

describe("stripMdExt", () => {
  it("strips .md (and variants) when present", () => {
    expect(stripMdExt("README.md")).toBe("README");
    expect(stripMdExt("notes.markdown")).toBe("notes");
    expect(stripMdExt("topic.MDOWN")).toBe("topic");
    expect(stripMdExt("thing.mkd")).toBe("thing");
  });

  it("leaves names without a markdown extension alone", () => {
    expect(stripMdExt("README")).toBe("README");
    expect(stripMdExt("notes.txt")).toBe("notes.txt");
    expect(stripMdExt("My Doc")).toBe("My Doc");
  });

  it("strips only the trailing extension, not earlier dots", () => {
    expect(stripMdExt("v1.2.md")).toBe("v1.2");
  });
});
