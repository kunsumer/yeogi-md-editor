# Changelog

All notable changes to Yeogi .MD Editor are documented here. Version numbers
follow [Semantic Versioning](https://semver.org/); entries highlight
user-visible behavior (new capabilities and bug fixes), not internal
refactors or visual tweaks.

## v0.2.0 — 2026-04-23

### New

- **Folder Explorer panel.** Open a folder (⌥⌘O / View menu) to browse its
  markdown files as a tree in a left sidebar. Files open in new tabs; the
  selected folder persists across restarts.
  - Header actions: open-folder (swap), search (filename filter, case-
    insensitive, auto-expands matches), expand-all (BFS-loads every sub-
    directory to a safety cap of 500, then expands), collapse-all, close.
- **Outline panel.** Live table of contents. Click a heading to jump to it
  (slug-matched against the rendered doc so duplicate headings and nested
  nodes don't drift the target).
- **Resizable, toggleable sidebars.** Drag to resize; keyboard toggles
  ⌥⌘1 (Files) and ⌥⌘2 (Outline); ⌘\ hides both and remembers the previous
  layout on the next press. Widths persist.
- **Wiki-style links `[[Target]]`.** Parse, render, and click-to-open
  against the active folder — BFS search, exact then case-insensitive
  match. Round-trips on save. Insert button in the toolbar.
- **Footnotes.** `[^id]` references with `[^id]: body` definitions
  collected in an auto-rendered section. Insert button auto-suggests the
  next free id and drops a stub definition you can type into.
- **Subscript / Superscript / Highlight marks** with toolbar buttons and
  keyboard shortcuts (⌘,  ⌘.  ⇧⌘H). Supports `H~2~O`, `E=mc^2^`,
  `==highlight==` syntax.
- **Text alignment** for paragraphs + headings (left / center / right /
  justify) via toolbar, persisted as inline style in markdown.
- **Table column alignment.** GFM `:---` / `:---:` / `---:` markers now
  round-trip through save cycles. Toolbar buttons (shown when cursor is
  inside a table) set the current cell's alignment; the delimiter row
  carries it across every row on save.
- **Image insertion from URL or local file upload.** Embeds local images
  as data URLs so documents stay self-contained. Corner handles for
  resizing; aspect ratio locked by default.
- **Mermaid + LaTeX insert dialogs** with side-by-side live preview,
  template palettes, and (for LaTeX) a categorized symbol palette.
- **Resizable Mermaid diagrams** that re-flow their layout at the new
  width (Gantt date ticks especially benefit) instead of scaling.
- **Per-document Autosave toggle** in the top bar. Saves trigger ~500 ms
  after you stop typing, or every ~2 s during a sustained streak.
- **Close-with-unsaved-changes guard.** Dirty tabs prompt Save / Don't Save /
  Cancel instead of silently dropping edits.
- **External file-change reconciliation.** If an open file changes on
  disk, a banner offers Keep or Reload; clean files silently update.
- **Mode-switch scroll preservation.** Toggling WYSIWYG ↔ Edit keeps the
  heading nearest the viewport top pinned in place.
- **Anchor-link scrolling.** `[text](#heading)` links scroll to the
  matching heading (slug-matched, no id= attributes required).
- **Universal macOS .dmg** (arm64 + Intel) via `pnpm release:build`.
- **Auto-updater plumbing** (Tauri updater plugin wired, minisign signing
  keys supported — configured per the docs, UI banner in place).
- **First-run tutorial.** Multi-step walkthrough that also covers wiki-
  links, footnotes, shortcuts, and the "Open With" default-handler flow.
- **.md file association.** Double-click / "Open With" from Finder routes
  through the Rust `RunEvent::Opened` bridge into a new tab.
- **Find and Replace** in both modes — CodeMirror's built-in panel for
  Edit, a ProseMirror-decoration bar for WYSIWYG.
- **Export HTML** + **Print to PDF** (routed via default browser so
  macOS's "Save as PDF" works reliably in WKWebView).
- **Chrome-style "+" button** at the end of the tab strip, and middle-
  click to close.

### Fixed

- Mermaid ER diagrams: HTML labels survived DOMPurify by dropping
  `USE_PROFILES` from the sanitize config.
- Mermaid resize: was previously scaling the SVG (so text grew with the
  box); now reconfigures per diagram type and re-runs at the new width.
- Mermaid YAML frontmatter lines inside a diagram no longer get
  mis-detected as the diagram type token.
- Table column alignment survives save/reopen: tiptap-markdown's default
  Table serializer wiped `:---:` markers on every save, overridden now.
- TOC clicks land on the intended heading even with hidden frontmatter
  nodes or duplicate heading text: match by slug + level + occurrence
  order instead of raw DOM index.
- Footnote references render as `<sup>` with a working anchor instead of
  as literal `[^1]` text.
- Highlight (`==text==`), subscript (`H~2~O`), superscript (`E = mc^2^`)
  now parse correctly and round-trip on save — they previously rendered
  as literal delimiter text.
- Print from the menu bar used to silently drop the gesture (WKWebView
  blocks `window.print()` from IPC); routes through a temp HTML file
  opened in the default browser now.
- "Unsaved" indicator was showing "Saved" while autosave was off and the
  buffer was dirty; priority order fixed.
- File-watcher subscription is now reliably re-issued across tab
  switches and folder changes.
- External-change detection: a clean buffer reloads silently; a dirty
  one prompts before overwriting user edits.
- Tab session restore is scoped per document so a rapid tab switch
  during the async mount window can't apply heading positions from doc A
  to doc B.
- WYSIWYG ↔ Edit mode switch: captured heading is now matched back to
  the TOC list by slug + level before being used as the scroll target,
  so mode-switch doesn't drift the viewport when one mode has heading
  elements the other doesn't.
