import { describe, it, expect } from "vitest";
import { parseWikiLinkInner } from "./markdownItWikiLinks";

describe("parseWikiLinkInner — basic form", () => {
  it("extracts the target from [[Project Alpha]]", () => {
    const got = parseWikiLinkInner("Project Alpha");
    expect(got).toEqual({ target: "Project Alpha", display: "Project Alpha" });
  });

  it("trims whitespace around a single-target link", () => {
    const got = parseWikiLinkInner("  My Note  ");
    expect(got).toEqual({ target: "My Note", display: "My Note" });
  });
});

describe("parseWikiLinkInner — piped display form", () => {
  it("splits [[Quality Assurance|ran the tests]] into target + display", () => {
    const got = parseWikiLinkInner("Quality Assurance|ran the tests");
    expect(got).toEqual({
      target: "Quality Assurance",
      display: "ran the tests",
    });
  });

  it("trims both sides of the pipe", () => {
    const got = parseWikiLinkInner("  Foo  |  Bar baz  ");
    expect(got).toEqual({ target: "Foo", display: "Bar baz" });
  });
});

describe("parseWikiLinkInner — malformed input returns null", () => {
  it("rejects empty targets (whitespace only)", () => {
    expect(parseWikiLinkInner("")).toBeNull();
    expect(parseWikiLinkInner("   ")).toBeNull();
  });

  it("rejects pipe form with empty target: [[|Display]]", () => {
    expect(parseWikiLinkInner("|Display")).toBeNull();
  });

  it("rejects pipe form with empty display: [[Target|]]", () => {
    expect(parseWikiLinkInner("Target|")).toBeNull();
  });

  it("rejects inner newlines", () => {
    expect(parseWikiLinkInner("Has\nnewline")).toBeNull();
  });

  it("rejects nested brackets", () => {
    expect(parseWikiLinkInner("has[inner]brackets")).toBeNull();
    expect(parseWikiLinkInner("[[nested]]")).toBeNull();
  });

  it("rejects more than one pipe", () => {
    expect(parseWikiLinkInner("Target|Display|Extra")).toBeNull();
  });
});
