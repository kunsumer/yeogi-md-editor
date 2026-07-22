# WYSIWYG Copy Semantics — Plain Text by Default, ⇧⌘C for Markdown

**Status:** ✅ implemented (2026-07-22) via TDD. Suite 272 green, tsc clean.
**Platform:** macOS desktop, WYSIWYG editor only (Edit mode's buffer *is*
markdown — ⌘C there already copies source).

## Problem
`Markdown.configure({ transformCopiedText: true })` made tiptap-markdown
replace the clipboard's **text/plain** flavor with its markdown
serialization of the copied slice. Because the slice keeps ancestor
context, copying text from a table cell serialized the enclosing table —
and non-GFM-representable tables fall back to raw HTML
(`MarkdownTable`'s fallback), so pasting "User agent" into a plain-text
target produced `<table><tr><td>User agent</td></tr></table>`.

## Behavior (after)
- **⌘C / ⌘X (default):** native ProseMirror clipboard. `text/plain` =
  the selection's plain text ("User agent"); `text/html` = the rich DOM
  serialization, so a copied table pastes as a *real table* into Word /
  Pages / Google Docs.
- **⇧⌘C — Copy as Markdown:** serializes the selection through the same
  pipeline the save path uses (`storage.markdown.serializer` +
  `postProcessMarkdown`), so the clipboard gets exactly the source form
  the .md file would contain. Empty selection = no-op (falls through,
  mirroring ⌘C).

## Implementation
- `WysiwygEditor.tsx`: `transformCopiedText: false` (with a comment
  explaining why); registers the `CopyAsMarkdown` extension.
- **New `copyAsMarkdown.ts`**: `selectionToMarkdown(editor)` (pure —
  serializes `doc.cut(from, to)` so ancestor context survives: heading
  text yields `# text`, cells yield pipe tables), `copySelectionAsMarkdown`
  (clipboard write via `navigator.clipboard.writeText`, the pattern
  CodeBlockView already uses), and the `CopyAsMarkdown` Tiptap extension
  binding `Mod-Shift-c`.
- `transformPastedText: true` is untouched — pasting markdown text into
  the editor still parses it.

## Testing
- `WysiwygEditor.test.tsx` (real component config): copy event from a
  table cell puts plain text in `text/plain` (the regression) and keeps
  the rich `text/html` flavor.
- `copyAsMarkdown.test.ts`: empty selection → null/false; bold survives
  as `**bold**`; a simple table serializes as GFM pipes (not `<table>`);
  clipboard write happens exactly once with the markdown.

## Non-goals (this iteration)
- A native menu item for Copy as Markdown (Edit ▸). Worth adding for
  discoverability if users don't find ⇧⌘C — needs `menu.rs` + an
  App→focused-editor command route.
- Changing Edit-mode (CodeMirror) copy behavior — already source.
- A preference to restore markdown-in-text/plain as the ⌘C default.
