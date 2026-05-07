/**
 * Post-processes raw markdown from tiptap-markdown's serializer to fix
 * round-trip patterns that the stock serializer handles in ways that don't
 * match the source form we want to ship back to disk. Each rewrite is a
 * narrow regex targeting a specific serializer quirk.
 *
 * Safe to run on any serializer output — idempotent (applying twice gives
 * the same result as applying once) and only touches patterns unambiguously
 * produced by the serializer, not patterns a human would typically type.
 */
export function postProcessMarkdown(raw: string): string {
  return raw
    // Wiki-link collapse: `[[Target|Target]]` → `[[Target]]` when the alias
    // equals the target (the serializer always emits the two-segment form).
    // The negative character class mirrors the parser's bail rules: no
    // nested brackets, no newline inside, no second pipe.
    .replace(/\[\[([^\[\]|\n]+)\|\1\]\]/g, "[[$1]]")
    // Email autolink restore: `[x@y](mailto:x@y)` → `<x@y>` when the display
    // text matches the address exactly. Email autolinks parse into Link
    // marks with href="mailto:x@y" which breaks prosemirror-markdown's
    // isPlainURL check, so they serialize as inline-link form. URL autolinks
    // round-trip correctly already (isPlainURL handles them).
    .replace(/\[([^\[\]\n]+)\]\(mailto:\1\)/g, "<$1>");
}
