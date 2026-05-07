/**
 * Strip ChatGPT-style citation tokens (and any leftover Unicode Private
 * Use Area characters) from a string.
 *
 * ChatGPT injects citation markers around invisible Private Use Area
 * characters (U+E000–U+F8FF) — labels like `cite`, `filecite`, `entity`
 * — that would normally be processed by the ChatGPT web UI. When the
 * text is copied out into any other app, those markers come along and
 * render as font-fallback placeholder boxes plus their visible label /
 * payload text:
 *
 *   <PUA>filecite<PUA>turn0file0<PUA>
 *   <PUA>cite<PUA>turn4view2<PUA>turn6view0<PUA>
 *   <PUA>entity<PUA>["country","Japan"]<PUA>
 *
 * Two-pass strategy:
 *
 * 1. **Structured pass.** Match the *full* citation token by a known
 *    label and recognized payload shapes (`turnNfileN`, `turnNviewN`,
 *    `["...","..."]` JSON arrays, etc.) and remove it entirely. This
 *    is safe even when two citations are separated by ordinary words
 *    — the per-segment payload regex won't accidentally bridge them.
 *
 * 2. **Stray-PUA sweep.** Strip any remaining BMP PUA characters that
 *    weren't part of a recognized token (e.g., a malformed marker, or
 *    a label / payload shape we haven't seen before). The visible
 *    label / payload text in those cases stays — better to leave a
 *    visible "filecite turn0file0" the user can manually delete than
 *    silently eat unrelated content.
 *
 * Conservative on range — only the BMP PUA — so supplementary-plane
 * PUA-A/B (U+F0000+) where legitimate niche uses live is untouched.
 */

const PUA_CHAR = "[\\uE000-\\uF8FF]";
const NOT_PUA = "[^\\uE000-\\uF8FF\\n]";

const KNOWN_LABELS = [
  "cite",
  "filecite",
  "entity",
  "fileid",
  "videocite",
  "searchresult",
  "navigation",
  "search",
];

// Payload shape: either a structured turn-token (`turn0file0`,
// `turn4view2`, etc.) OR a JSON-like array (`["country","Japan"]`).
// Keeping this tight is what stops the stripper from eating ordinary
// English text between two adjacent citations.
const PAYLOAD = "(?:turn\\d+\\w*|\\[(?:\"[^\"\\n\\]]*\"(?:,\"[^\"\\n\\]]*\")*)?\\])";

const CITATION_TOKEN_RE = new RegExp(
  `${PUA_CHAR}(?:${KNOWN_LABELS.join("|")})${PUA_CHAR}(?:${PAYLOAD}${PUA_CHAR})+`,
  "g",
);

const STRAY_PUA_RE = new RegExp(PUA_CHAR, "g");

export function stripPrivateUseArea(input: string): string {
  // Pass 1: remove whole citation tokens (label + payload + PUA brackets).
  const afterTokens = input.replace(CITATION_TOKEN_RE, "");
  // Pass 2: sweep any leftover stray PUA chars (markers that didn't form
  // a recognized token). Visible text in unmatched tokens is left for
  // the user to deal with manually rather than risking false positives.
  return afterTokens.replace(STRAY_PUA_RE, "");
}

// Re-export for tests + any future surface that needs the raw helpers.
export const _internals = { CITATION_TOKEN_RE, STRAY_PUA_RE, NOT_PUA };
