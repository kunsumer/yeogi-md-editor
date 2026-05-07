/**
 * Strip Unicode Private Use Area characters from a string.
 *
 * The BMP PUA range (U+E000–U+F8FF) holds codepoints reserved for
 * vendor-specific use; no font is required to define glyphs for them.
 * In practice the most common producer is OpenAI / ChatGPT, which
 * brackets in-line citation tokens with PUA markers (e.g.
 * `fileciteturn0file0`). When users copy text out of
 * ChatGPT into any other app, the markers come along and render as
 * placeholder boxes because the font has nothing to show.
 *
 * This stripper is conservative — only the BMP PUA range — so it
 * won't touch supplementary-plane PUA-A/B (U+F0000–U+10FFFD) where
 * legitimate niche uses are slightly more common.
 */

// Built via RegExp constructor so the source stays human-readable
// (an inline char-class in a string literal would render the literal
// PUA characters between the brackets — the regex would still work,
// but you can't tell what's there from a glance).
const PUA_REGEX = new RegExp("[\\uE000-\\uF8FF]", "g");

export function stripPrivateUseArea(input: string): string {
  return input.replace(PUA_REGEX, "");
}
