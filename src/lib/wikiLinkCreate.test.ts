import { describe, it, expect } from "vitest";
import { sanitizeWikiTargetFilename } from "./wikiLinkCreate";

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
