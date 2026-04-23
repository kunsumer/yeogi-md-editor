/**
 * Slugify a string using the GitHub / CommonMark-compatible algorithm so
 * that `[Heading Levels](#heading-levels)` resolves against an `<h2>` with
 * text "Heading Levels" without us needing to inject `id=` attributes into
 * every heading node.
 *
 * Rules (matches `github-slugger` closely):
 *   - trim + lowercase
 *   - collapse whitespace to single hyphens
 *   - keep unicode letters, numbers, hyphen, underscore; drop everything else
 *   - collapse runs of hyphens and trim edge hyphens
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
