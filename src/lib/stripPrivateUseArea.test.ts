import { describe, it, expect } from "vitest";
import { stripPrivateUseArea } from "./stripPrivateUseArea";

// Helpers — build PUA-bracketed citations without typing literal PUA
// chars in source (which would render as invisible boxes in any editor
// that opens this file).
const PUA = "";
const PUA2 = "";
const cite = (label: string, ...payloadSegments: string[]) =>
  `${PUA}${label}${PUA2}${payloadSegments.join(`${PUA}`)}${PUA2}`;

describe("stripPrivateUseArea", () => {
  it("removes a complete filecite token (label + payload + brackets)", () => {
    const input = `Some text ${cite("filecite", "turn0file0")} more text`;
    expect(stripPrivateUseArea(input)).toBe("Some text  more text");
  });

  it("removes a complete entity token whose payload is a JSON array", () => {
    const input = `Markets in ${cite("entity", '["country","Japan","east asia"]')}, growing`;
    expect(stripPrivateUseArea(input)).toBe("Markets in , growing");
  });

  it("removes a multi-segment cite token (multiple turn IDs)", () => {
    const input = `End of paragraph. ${cite("cite", "turn4view2", "turn6view0")}`;
    expect(stripPrivateUseArea(input)).toBe("End of paragraph. ");
  });

  it("does NOT bridge two adjacent citations across ordinary text", () => {
    // Real risk: a too-greedy regex would eat "middle words" between two
    // separate citations. The structured payload pattern stops that.
    const input = `${cite("cite", "turn0view0")} middle words ${cite("cite", "turn1view1")}`;
    expect(stripPrivateUseArea(input)).toBe(" middle words ");
  });

  it("leaves ordinary text and ASCII punctuation alone", () => {
    const input = "Hello, world! 123 @#$";
    expect(stripPrivateUseArea(input)).toBe(input);
  });

  it("leaves emoji and CJK alone (outside PUA range)", () => {
    const input = "안녕 こんにちは 🎉 Привет";
    expect(stripPrivateUseArea(input)).toBe(input);
  });

  it("does NOT touch supplementary-plane PUA-A/B (U+F0000+)", () => {
    const input = "before󰀀after"; // U+F0000
    expect(stripPrivateUseArea(input)).toBe(input);
  });

  it("strips stray PUA chars that aren't part of a recognized token", () => {
    // A lone PUA char with no label/payload structure — sweep it.
    const input = `acknowledged${PUA}.`;
    expect(stripPrivateUseArea(input)).toBe("acknowledged.");
  });

  it("preserves visible text in malformed tokens but strips the PUA chars", () => {
    // Unknown label → token regex doesn't match → falls through to the
    // PUA sweep. Visible "weirdlabel" + "payload" remain so the user
    // notices and cleans up manually rather than silently losing
    // unrelated content.
    const input = `before ${PUA}weirdlabel${PUA2}payload${PUA} after`;
    expect(stripPrivateUseArea(input)).toBe("before weirdlabelpayload after");
  });

  it("returns empty string when input is empty", () => {
    expect(stripPrivateUseArea("")).toBe("");
  });

  it("strips the user's exact reported example (mixed cite types in one paragraph)", () => {
    const input =
      `acknowledges. ${cite("filecite", "turn0file0")}\n\n` +
      `The acquisition can still be worthwhile, but only if the value thesis is narrowed. ` +
      `Public materials position Relux in ${cite("entity", '["country","Japan","east asia"]')}, ` +
      `selective demand from ${cite("entity", '["country","South Korea","east asia"]')}, ` +
      `disciplined CRM. ${cite("filecite", "turn0file0")} ${cite("cite", "turn4view2", "turn6view0")}`;
    const out = stripPrivateUseArea(input);
    // Verify visible cite tokens are gone.
    expect(out).not.toContain("filecite");
    expect(out).not.toContain("turn0file0");
    expect(out).not.toContain("entity");
    expect(out).not.toContain("turn4view2");
    expect(out).not.toContain("turn6view0");
    expect(out).not.toContain("country");
    // Verify surrounding prose is intact.
    expect(out).toContain("acknowledges.");
    expect(out).toContain("The acquisition can still be worthwhile");
    expect(out).toContain("Public materials position Relux in");
    expect(out).toContain("selective demand from");
    expect(out).toContain("disciplined CRM.");
  });
});
