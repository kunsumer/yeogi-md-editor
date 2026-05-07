import { describe, it, expect } from "vitest";
import { stripPrivateUseArea } from "./stripPrivateUseArea";

describe("stripPrivateUseArea", () => {
  it("removes BMP PUA characters at the boundaries", () => {
    const input = "middle";
    expect(stripPrivateUseArea(input)).toBe("middle");
  });

  it("removes a typical ChatGPT-style citation marker run", () => {
    // Real-world shape: bracket markers around a citation token.
    const input = "Some text fileciteturn0file0 more text";
    expect(stripPrivateUseArea(input)).toBe(
      "Some text fileciteturn0file0 more text",
    );
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
    // Supplementary PUA is encoded as a surrogate pair in UTF-16; the
    // helper's regex is BMP-only by design, so these survive.
    const input = "before󰀀after"; // U+F0000
    expect(stripPrivateUseArea(input)).toBe(input);
  });

  it("returns empty string when input is empty", () => {
    expect(stripPrivateUseArea("")).toBe("");
  });
});
