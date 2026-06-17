# Changelog

All notable changes to Yeogi .MD Editor are documented here. Version numbers follow [Semantic Versioning](https://semver.org/); entries highlight user-visible behavior (new capabilities and bug fixes), not internal refactors or visual tweaks.

## v0.5.3 — 2026-06-17

### New

- **The window comes to the front when you open a file from outside the app.** Opening a `.md` from Finder ("Open With") or the `open` command now raises and focuses the window — so you can see the file you just opened instead of wondering whether it worked. Covers the app being in the background, minimized, or launched fresh by the open.
- **Zoom into images and Mermaid diagrams in the Preview window.** Click any image or diagram in a preview to open it in a fullscreen viewer: scroll (or use the −/+ controls) to zoom, double-click to toggle fit ↔ 200%, drag to pan, and press Esc, click the backdrop, or hit ✕ to close.

## v0.5.2 — 2026-06-12

### New

- **The explorer's Reload button shows real progress.** The ⟳ icon spins until every visible folder tree has actually re-fetched from disk, then stops upright on the next full rotation — so even an instant reload is visibly acknowledged. VoiceOver hears "Reloading folder contents…" / "Folder contents reloaded", and Reduce Motion users get a static accent highlight instead of the spin.

### Fixed

- **Opening a document no longer lands you at the bottom.** The WYSIWYG editor auto-focused the caret at the *end* of the content, scrolling every freshly opened file to its last line. Files now open at the top with the caret on the first text position — and for documents that start with YAML frontmatter (or a Mermaid/math block), typing immediately after opening no longer silently deletes that block.
- **External file changes keep your caret in place.** When a watched file was rewritten on disk and silently reloaded, the caret quietly jumped to the end of the document, so the next keystroke landed at the bottom. The caret now stays at (or as near as possible to) where it was.

### Changed

- **Crisper explorer icons.** The reload glyph is now a proper ⟳ (and stops at that exact pose), the folder has a real tab, expand/collapse-all are double chevrons, and every close X in the app — panel, folder, tab, search — shares one consistent icon, with the panel-close set apart by a divider.

## v0.5.1 — 2026-05-13

### Fixed

- **Outline highlight finally works in Edit mode.** v0.5.0 claimed the fix but didn't actually land it: a stale-view-ref bug (React StrictMode's dev double-mount destroys the first `EditorView` between the hook's setup and its first tick, leaving the hook reading from a detached DOM forever) meant `view.viewport.from` stayed pinned at 0 no matter how far the user scrolled. The hook now reads the EditorView ref fresh on every event instead of capturing it in a closure, so a re-mounted view is picked up the next time the user interacts. Scroll-event driven now (no perpetual polling); a one-shot 5-second startup interval covers session-restored scrollTop.

## v0.5.0 — 2026-05-13

The Outline now reliably tracks where you are in the doc, in both view modes, in any file.

### Fixed

- **Outline "you are here" highlight now works in every document.** v0.4.15 introduced the highlight, v0.4.16 patched the Tiptap mount race — but the highlight still bailed silently on any file with YAML frontmatter (e.g. the bundled `Welcome.md`). Root cause: without `remark-frontmatter`, the parser was reading the closing `---` of a `---\n…\n---` block as a setext-H2 underline for the YAML body, emitting a phantom depth-2 heading whose text was `"title: …\nauthor: …"`. That phantom lived in the headings array but had no `<h*>` counterpart in the WYSIWYG DOM, so the slug-based mapping walk got stuck on it and every later heading mapped to "no match". Frontmatter now parses as a single `yaml` node and is filtered out of the heading list before mapping starts.
- **Outline highlight now works in Edit mode too.** The first cut bound a `scroll` listener to CodeMirror's `view.scrollDOM`, which wasn't catching scroll events reliably in our shell. Swapped to a `requestAnimationFrame` poll that samples `scrollDOM.scrollTop` once per frame — early-exits when nothing changed, so the steady-state cost is a single property read per frame.

### Changed

- **Outline highlight is now far quieter.** The first treatment was a pink background wash + a 2px brand-red left bar + a font-weight bump — it read as "selected" and pulled the eye away from the document you were reading. Now: no background, no font-weight change, just a thin 1px left bar in muted brand red and a slight text-colour bump for the active row. Just-noticeable-enough when you glance at the Outline; invisible when you're not looking for it.

## v0.4.16 — 2026-05-13

### New

- **Side-by-side and stacked pane splits.** A pair of icons at the right end of the active pane's tab strip opens a second editor pane. Side-by-side gives you the panes left/right; stacked gives you top/bottom. The new pane starts empty so you can pick what to load via "Create blank document / Open file(s)… / Open folder…". Each pane keeps its own tabs, focus, and view-mode toggle; closing the last tab in the secondary pane collapses back to single-column.
- **Keyboard shortcuts for splits.** **⌥⌘\\** toggles a side-by-side split; **⇧⌥⌘\\** toggles a stacked split. Same orientation again collapses back to single. Both shortcuts are now in View → Split Editor.
- **MIT license + open-source repo metadata.** The project now ships a proper MIT `LICENSE` file alongside the source (`github.com/kunsumer/yeogi-md-editor`). Already advertised on the landing page, just formalized in the repo so re-distributors and packagers can do their thing.

### Fixed

- **Outline now reliably highlights the section you're currently reading** in both WYSIWYG and Edit. The first cut of the feature shipped in v0.4.15 had a race: Tiptap's editor mounts asynchronously, and the highlight hook ran its initial DOM lookup before the headings had been rendered, then never retried. Now we retry for the first ~30 frames after the doc opens, and a `MutationObserver` on the ProseMirror root catches heading nodes inserted after the eager lookup so the map stays in sync.

## v0.4.15 — 2026-05-13

### New

- **The Outline panel highlights the section you're currently reading.** A subtle red wash + 2px left bar marks the heading that's at the top of the viewport, so you can tell at a glance where you are in a long doc. Works in both **WYSIWYG** (walks the rendered `<h*>` elements) and **Edit** mode (reads the top line from CodeMirror's scroll viewport). The active row also bumps font weight one notch and forces full text colour, so a deep H4/H5 is still legible when it's the section you're in.
- **Extensionless text files now show in the file explorer.** Files like `.env`, `Dockerfile`, `Makefile`, `LICENSE`, and `Procfile` previously disappeared because the explorer filtered by extension. The folder lister now sniffs the first 4 KB of any extensionless file: if there are no NUL bytes, it surfaces. Extensionless binaries (lock files, compiled blobs) are still filtered out. Files with recognized text extensions are unaffected — they pass through the existing allow-list without any read.

### Fixed

- **Outline highlight no longer drifts when the doc has hidden `<h*>` elements.** YAML frontmatter, raw HTML headings inside table cells, and footnote-section labels can render as DOM `<h*>` elements that don't have a row in the Outline. The first cut paired DOM headings to TOC entries positionally, so one "extra" shifted every later highlight by one row. The pairing is now slug + level, mirroring `jumpToHeading`'s resolution.

## v0.4.14 — 2026-05-11

### Code-signing

- **First release signed with an Apple Developer ID + notarized.** Until now releases were signed with a self-signed cert ("Yeogi Dev Cert"). It was good enough to keep macOS TCC's "you have access to Documents" grant stable across releases (from v0.4.8 onward), but it didn't help with Gatekeeper: every new install still triggered the *"unidentified developer"* warning and required right-click → Open. v0.4.14 swaps in a real **Apple Developer ID Application** identity and runs Apple's notarytool service on every release artifact via Tauri's bundler. After the auto-update lands v0.4.14 you should be able to **just double-click the app to launch it** — no right-click dance, no Gatekeeper warning.
- TCC stability (the Documents permission persisting across releases) is preserved — the bundle identifier `com.yeogi.mdeditor` stays stable, just as it did under the self-signed cert.

## v0.4.13 — 2026-05-07

### Fixed

- **Right-click → "Reload from disk" now actually re-renders the page,** even when the on-disk content is byte-identical to what's already in the editor. Previously, when content hadn't actually changed externally, `setContent` was a no-op and Mermaid diagrams / NodeViews kept their stale render — making Reload feel broken. The right-click action now also bumps a per-document `reloadEpoch` that the WYSIWYG editor keys on, so the editor (and every NodeView inside it) force-remounts on every explicit Reload. The watcher's silent-reload path (external file change, doc not dirty) does **not** bump the epoch, so external edits still update content without disturbing your cursor / scroll / undo history.

## v0.4.12 — 2026-05-07

### Fixed

- **Standalone semicolons inside `sequenceDiagram` notes no longer break the diagram.** v0.4.11 fixed `;<br/>` separators (the LLM "two phrases on separate lines" idiom), but a free-floating `;` *inside* a note body still tripped Mermaid's grammar — `;` is a statement terminator at the top level, so a note like `Note over X: server-side<br/>result inline; loop continues` would prematurely end the note, parse `loop continues` as the start of a new `loop` block, and then choke on the next `else`/`end` with a confusing `got 'else'` error. The renderer now swaps `;` for `,` inside `Note over|left of|right of` text. Source-mode (⌘E) shows your unchanged markdown.

## v0.4.11 — 2026-05-07

### Fixed

- **Mermaid flowchart nodes whose labels contain `{`, `}`, `(`, or `)` now render.** Mermaid's flowchart shape lexer reads `{` inside `[label]` as the start of a rhombus shape (`DIAMOND_START`), so a node like `FastAPI[POST /v1/summaries/{job_id}]` errored out. The renderer now auto-quotes such labels on the way to Mermaid; non-rectangle shapes (cylinders `[(...)]`, subroutines `[[...]]`, stadiums `([...])`) are left alone.
- **`;<br/>` separators inside diagram labels and notes no longer split the diagram.** A common LLM idiom is to write `phrase A;<br/>phrase B` to put two phrases on separate lines inside a label. Mermaid's stateDiagram / flowchart / sequenceDiagram parsers all read `;` as a *statement* terminator, so the label was getting fragmented into ghost nodes and orphan transitions. The preceding `;` is now stripped before the line break — the line break still renders.
- **Self-closing `<br/>` is normalized to `<br>`.** Some Mermaid versions trip on the self-closing form inside sequenceDiagram note text, surfacing as a confusing `got 'else'` parse error several lines past the actual note. Both forms render identically.

All three fixes happen on the way to Mermaid only; your saved markdown stays exactly as written.

## v0.4.10 — 2026-05-07

A follow-up to v0.4.9 that actually finishes the two fixes it claimed.

### Fixed

- **ChatGPT citation tokens are now fully stripped, not just their invisible markers.** The first cut only removed the Private Use Area characters but left the visible label and payload text behind — pasting a ChatGPT response would still leave "filecite turn0file0", `entity ["country","Japan"]`, etc. lying around in the doc with the placeholder boxes gone but the citation label still visible. Now matches whole citation tokens (`cite`, `filecite`, `entity`, `fileid`, `videocite`, `searchresult`, `navigation`, `search`) by both label and known payload shapes (turn IDs / JSON arrays) and removes the entire token. Tight payload matching deliberately avoids consuming ordinary text that happens to sit between two adjacent citations.
- **Mermaid `quadrantChart` data points with arrow-like labels (e.g. `KR->JP pilot`) now render.** The grammar requires labels containing `->`, hyphens, or other special chars to be quoted, but most users (and most LLMs) write them unquoted. The renderer now auto-quotes unquoted data-point labels on the way to Mermaid; your saved markdown is untouched.

### New

- **Edit → "Clean Hidden Citation Markers in Current Document"** — one-shot retroactive cleanup for documents whose content was pasted before the paste-strip feature shipped, or where the auto-strip skipped a malformed/unknown token shape. Shows a "Nothing to clean" alert when there's nothing to do.

## v0.4.9 — 2026-05-07

### New

- **Pasting from ChatGPT no longer leaves stripey placeholder boxes.** ChatGPT brackets in-line citations with invisible Unicode Private Use Area markers (U+E000–U+F8FF). Every other app renders them as font-fallback boxes because no font has glyphs for them. The WYSIWYG editor now strips those characters on paste. New preference: **Edit → Strip Hidden Citation Markers on Paste** (checkbox, default on). Disable it if you have a legitimate reason to preserve PUA codepoints (specialized font work).

### Fixed

- **Mermaid render errors now show the real message.** Mermaid throws a mix of error shapes — Error subclasses, plain `{ str, hash }` objects from the Jison parser, raw strings — and the catch handler used `String(err)`, which produces `[object Object]` for the most common (parser) case. Now extracts whichever message-like field is present (`.message` → `.str` → `.error`) and falls back to JSON. Diagrams that were previously failing with an opaque box will now show the actual parse / render error.

## v0.4.8 — 2026-05-04

### New

- **Right-click a tab → "Reload from disk"** for a per-document reload. Replaces the implicit (and far too destructive) full-webview reload that macOS Tahoe's native right-click menu used to expose. Targets only the right-clicked tab; other open documents are untouched. Hidden for Untitled buffers (no path to reload from). Drops the doc's unsaved changes without a confirmation prompt — the explicit click *is* the confirmation.

### Fixed

- **Right-click → Reload no longer wipes your open documents.** macOS Tahoe redesigned WKWebView's native right-click menu as a floating chip-style panel that included a "Reload" action. Clicking it used to reload the entire webview frame — which unmounted the editor, dropped all in-memory state, and re-read every open tab from disk through session restore. From the user's perspective: "I right-clicked one document, hit Reload, and all my open documents reloaded." The native context menu is now suppressed globally so this can't happen by accident; the new per-tab "Reload from disk" above is the safe replacement. Cut/Copy/Paste from right-click in editor regions is no longer available — ⌘C / ⌘V / ⌘X still work, and the WYSIWYG toolbar covers the formatting actions.

### Code-signing

- **Releases are now signed with a stable identity in CI.** Previously, every release was ad-hoc-signed by the GitHub Actions runner, which gave each version a fresh hash-derived signing identifier. macOS TCC keyed the "Yeogi can access your Documents folder" grant by that identifier, so every release was treated as a *different app* — your Documents permission had to be re-granted on first launch of every version. Releases now import a stable self-signed identity into a temporary keychain on the runner, so the bundle's signing identifier is the same across all future releases. The first signed release (this one) will trigger one final permission prompt as the identifier flips from the old `yeogi_md_editor-<hash>` to the stable `com.yeogi.mdeditor`. After that, the grant persists.

## v0.4.7 — 2026-05-04

A small release focused on **creating new files** from inside the app + clearer error reporting.

### New

- **File → New (⌘N).** Creates an in-memory Untitled buffer in the focused pane. The first ⌘S falls through to Save As so you can pick a destination.
- **Right-click → New File… / New Folder…** in the file-tree row menu and the folder-header menu. The new entry lands in the right place automatically:
  - Right-click on a **folder row** → creates inside that folder (auto-expands if collapsed).
  - Right-click on a **file row** → creates as a sibling in the file's parent directory.
  - Right-click on a **folder-group header** → creates inside that folder root.
  - **New File…** auto-appends `.md` when you don't include an extension and opens the new file in the editor automatically. Files with explicit extensions (e.g. `notes.txt`) are honored as-is.

### Fixed

- **Export to HTML and Print / Export to PDF now show a real error message** when something goes wrong, instead of silently doing nothing. Triggering them with no document open now also shows a clear "Open a Markdown document first" dialog rather than no-op'ing.

### macOS

- **Friendlier permission prompts.** Added `NSDocumentsFolderUsageDescription`, `NSDownloadsFolderUsageDescription`, and `NSDesktopFolderUsageDescription` to the bundled `Info.plist`. When macOS asks for access to one of those folders, the dialog now shows our own explanation ("Yeogi needs access to your Documents folder to open and save your Markdown notes.") instead of the generic OS wording. **Note:** this doesn't change *how often* the prompt appears — that's a function of the app's signing identity, which is still ad-hoc on CI builds. A separate change will move the release workflow to a stable signing identity so the Documents permission grant persists across releases.

## v0.4.6 — 2026-04-28

A focused release on **explorer file management** + **tab ergonomics**.

### New

- **Right-click a file or folder in the explorer.** A context menu appears with **Open in Finder**, **Open in Terminal**, **Rename…**, **Duplicate** (files only — copies as `name (N).ext`), and **Delete**. Same menu on the folder-group header (minus Duplicate, which is files-only). Rename uses the same lightweight `PromptDialog` as new-file/new-folder; Open in Terminal opens Terminal.app at the path's directory.
- **Delete with confirmation.** The new Delete action shows a destructive confirmation dialog with the target's name. For folders, it pre-counts every descendant and surfaces the number ("This will permanently delete `notes` and the 27 items inside it. This cannot be undone."). On confirm, any open tabs whose path is at or under the deleted path are closed in both panes — no stale buffers pointing at vanished files. Folder-root deletes also drop the folder from the explorer.
- **Drag-reorder tabs Chrome-style.** Press and drag a tab to reorder it within its tab strip. The dragged tab follows the cursor with a subtle lift (shadow + slight transparency); the other tabs slide to make room with a smooth 160 ms transform. Implemented with pointer-events instead of HTML5 drag-and-drop because WKWebView's HTML5 DnD is unreliable on macOS — a 4 px movement threshold separates click-to-activate from drag.

### Fixed

- **⌘F always re-focuses the search input,** even when the bar is already open. Previously a second `⌘F` was a no-op because the toggle had nothing to do; now the search bar bumps a focus-sequence counter on every press so the input is always re-focused and re-selected.

### Visual / accessibility

- **`.btn-danger` style.** Destructive primary actions in `ConfirmDialog` (`tone="danger"`) now render with a proper red filled button. Previously the class was referenced but unstyled, so the existing **Help → Reset Welcome.md to Default** dialog showed an unstyled fallback button — that's now fixed too.

## v0.4.5 — 2026-04-27

A focused release on the **Folder Explorer**.

### New

- **Multiple folders open at once.** Click the Open Folder icon to add another folder to the explorer (up to 5 total). Each folder gets its own collapsible header, file tree, and close button. Wiki-link resolution + backlinks still scope to the primary folder; the rest are presentation-only conveniences for working across "notes + project + scratch + reference" layouts. Persisted across launches.
- **Per-folder collapse.** Each folder's chevron toggles its tree on/off. While collapsed, the folder's FileTree is fully unmounted — zero listeners, zero IPC, zero memory cost. Useful for keeping several folders queued up without paying for them all continuously.
- **Selected-tree highlight + scoped expand/collapse.** One folder is "selected" at a time; the toolbar's Expand-all and Collapse-all buttons act only on it. Selection defaults to the folder containing the active document and follows it across tab switches; clicking any folder header sets a manual override. The selected tree gets a brand-red left-border accent + faint background tint, matching the active-tab indicator.
- **Reload button** in the explorer header. Re-fetches every cached folder + subdir from disk so changes made outside the app (another editor, shell `mv`, scaffolding tools) show up without re-picking the folder. Preserves expansion state.

### Fixed

- **Folder Explorer panel no longer disappears when no folder is open.** Closing the last folder used to hide the entire panel even though the user's preference said "show it" — and re-toggling Folder Explorer from the View menu had no effect. The panel now stays visible with a "No folder open" empty state and a Choose folder… button.
- **Expand-all → Collapse-all → re-expand** cycle no longer leaves all subdirectory levels expanded. The collapse-all path now drops the cached subdir contents (root preserved) so a follow-up expand only shows the immediate children, matching CommonMark file-explorer expectations.
- **Stale expand/collapse signals on FileTree remount** are no longer replayed. Collapsing then re-expanding a folder group used to incorrectly re-trigger the last expand-all action because the FileTree's effect re-fired on mount with the still-non-zero seq prop. Each \*Seq prop now stores its mount-time value in a ref and only fires on real changes since then.

## v0.4.4 — 2026-04-24

### New

- **Open more file types alongside your notes.** The folder explorer + Open dialog now surface `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.sh`, `.log`, and `.csv` files in addition to the four markdown extensions. They open in Edit mode (CodeMirror) only — Tiptap's WYSIWYG would mangle non-markdown content, so the WYSIWYG/Edit toggle is hidden for those files and ⌘E becomes a no-op. Save / autosave / file-watcher all work identically. Useful for glancing at a `package.json` or `.zshrc` without leaving the editor.
- **Dot-folders show in the explorer.** Folders starting with `.` (like `.obsidian/`, `.notes/`) used to be filtered out unconditionally; now only `.DS_Store` is excluded so notes-app sidecar conventions are visible. Regular `.dotfile`s are still filtered by the same extension allow-list as everything else.
- **Chrome-style tab shortcuts.** `⌘1`..`⌘8` jump to the corresponding tab of the focused pane; `⌘9` jumps to the last tab regardless of count (matches Chrome / Safari convention).

## v0.4.3 — 2026-04-24

### New

- **Instant link tooltips.** Hovering a link in the WYSIWYG editor or Preview pane now shows the link's title + href immediately instead of waiting for the OS's \~1 s native-tooltip delay. Custom floating tooltip with title on top, href below in monospace; native browser tooltip is suppressed by moving the `title` attribute to a data attribute on first hover.
- **More dark themes.** `View → Appearance → Dark` group adds **One Dark Pro**, **Nord**, **GitHub Dark** (canonical `#0d1117` palette, distinct from the default Dark theme), and **Tokyo Night**. Each pairs a Shiki code-block theme that matches its palette.
- **"Help → Reset Welcome.md to Default"** menu item — overwrites your `~/Documents/Yeogi .MD Editor/Welcome.md` with the bundled seed (the source ships an updated demo doc on every release; this lets you pick up the latest without manually deleting the file). Destructive confirmation prompt warns before replacing local edits.

### Fixed

- **Save-time crash on documents containing tables.** The WYSIWYG table cell serializer's textContent guard threw `TypeError: No default value` in WebKit on cells containing inline math atoms (`$\LaTeX$`), crashing the editor on every keystroke. Replaced the dead leftover with a `cellContent.childCount > 0` check so atom cells round-trip safely.
- **Inline math, wiki-links, and other atom-shaped inline content in table cells** no longer disappear on save. The same fix as above; a cell with `$x^2$` or `[[Note]]` now round-trips with content intact.
- `<details>` **/** `<summary>` **round-trip.** Previously the WYSIWYG serializer dropped the `<details>` wrapper on save, collapsing the disclosure widget to bare content. Now emits a proper HTML block with `[open]` attribute preserved. Click-to-expand inside the editor works via a NodeView that routes summary clicks through a ProseMirror transaction.
- **Footnote** `[^id]` **round-trip.** Footnote references were being serialized as the grotesque `[^1^](#fn-1)` form because the `<sup data-footnote-ref>` HTML matched both Tiptap's footnote-ref node and the Superscript mark + Link mark at the same parse priority. Bumped FootnoteRef / FootnoteSection / FootnoteItem parseHTML priorities so the specialized rules win.
- **Email autolinks** `<x@y>` stay as `<x@y>` on save instead of being converted to `<x@y>`. URL autolinks already round-tripped correctly; this completes the symmetry.
- **Setext headings** `===` **/** `---` survive WYSIWYG round-trips instead of being silently rewritten to ATX `#` / `##`. New `HeadingWithSyntax` extension carries a `syntax` attr through parse/serialize.
- **Hard line breaks** canonicalized to the conventional two-trailing-spaces form on save (was `\\\n`). Both render identically; two-space is the canonical CommonMark form.
- **Definition lists** (`term\n: defn` Pandoc form) round-trip without flattening to inline `term : defn`. New schema nodes for `<dl>` / `<dt>` / `<dd>` plus `markdown-it-deflist` parser. CSS treatment in the WYSIWYG matches the Preview rendering.
- **Tauri event names with dots** (`file.changed`, `watcher.lost`, `preview.contentUpdate`, `editor.closed`) were rejected by Tauri 2's event-name validator, raising "Unhandled Promise Rejection" on every app launch. Renamed all four to `:` separators on both Rust and TS sides.
- **Toolbar responds to selection changes instantly.** Clicking into a table cell or moving the caret across differently-marked text now updates the toolbar's table row and bold/italic/code highlights in the same frame, instead of waiting for some unrelated transaction to trigger a re-render.
- **Finer-grained scroll sync** between WYSIWYG and Edit. Toggling ⌘E now lands on (or near) the exact source line you were on inside the current block, not just the top of the block. Most noticeable in long code blocks where the within-block precision matters.

### Performance

- **4.7× smaller initial bundle.** Vite manualChunks groups React, Tiptap, CodeMirror, and KaTeX into dedicated vendor chunks. The markdown-rendering pipeline (remark + rehype + Shiki) is dynamic-imported at the two surfaces that need it (Export HTML, Print to PDF, Preview pane), so WYSIWYG-only users never pay for it. Main entry chunk dropped from 1,450 kB to 309 kB (479 kB → 92 kB gzipped).

### Developer / release infrastructure

- **GitHub Actions release workflow.** Pushing a `v*` tag now builds the universal bundle on CI, generates `latest.json`, publishes the GitHub Release, and verifies the updater endpoint — replacing the manual `pnpm release:build` + `gh release create` ceremony. Manual flow still works as fallback (`docs/releasing.md`).
- `scripts/api-push.py` (the firewall-bypass squash-push) now defaults its commit-message ref to HEAD instead of requiring a hand-edited SHA before each release.

## v0.4.2 — 2026-04-24

### Fixed

- **Save-time crash on documents with tables.** The WYSIWYG table serializer held a dead `String(cellContent.attrs)` leftover that threw `TypeError: No default value` in WebKit for certain cell content shapes (inline math atoms in particular). That triggered a renderer crash on every keystroke in documents containing such tables. Dead path removed; cell rendering now guards `cellContent?.textContent ?? ""` safely.
- `<details>` **/** `<summary>` **round-trip.** WYSIWYG previously dropped the `<details>` wrapper on save (the serializer only rendered inner children, so `<details><summary>X</summary>…</details>` degraded to bare content and the disclosure was lost). The serializer now emits a proper HTML block (`<details [open]>` + blank line + `<summary>` + body + `</details>`) so the wrapper survives every round trip, and the `open` attribute is preserved.
- **"Click to expand" works inside the editor.** Native `<details>` disclosure doesn't fire in contenteditable — ProseMirror consumes pointerdown for caret placement. A NodeView on `Details` now routes summary clicks through a proper transaction (`setNodeAttribute(pos, "open", !current)`), so the toggle flips the attribute *and* the updated state round-trips to markdown on save.
- **Tauri event names with dots.** Tauri 2 rejects event names containing `.`, which was raising `Unhandled Promise Rejection: invalid args \`event\` for command \`listen\`…`on every app launch. Renamed the four offenders on both Rust and TS sides:`file.changed`→`file:changed`, `watcher.lost`→`watcher:lost`, `preview.contentUpdate`→`preview:content-update`, `editor.closed`→`editor:closed\`.

### Changed

- **Finer-grained scroll sync between WYSIWYG and Edit.** Toggling ⌘E used to anchor to the last heading above the viewport, which could be several screens up in a document with long sections. The anchor set is now all top-level blocks (paragraphs, lists, code fences, tables, blockquotes, thematic breaks, callouts, footnote sections) — the target view lands on or near the exact block you were looking at. Headings still appear in the outline; this only widens the mode-switch snapshot.
- **Welcome / seed document refreshed.** `Welcome.md` now covers more markdown territory out of the box: nested emphasis, backslash line breaks, nested task lists, wiki-link aliases (`[[Note|display]]`) + section links (`[[Note#Heading]]`), table cells with `<br>` line breaks and rich inline content, Rust + diff code fences, richer LaTeX examples (`\boxed`, `\text`, vectors, chemistry arrows), five additional Mermaid diagram types (mindmap, timeline, journey, quadrant chart, git graph), and HTML comment / `<abbr>` / sized `<img>` demos. Existing installs aren't re-seeded — to see the new content, delete `~/Documents/Yeogi .MD Editor/Welcome.md` before next launch.

## v0.4.1 — 2026-04-23

### Changed

- **Light-group themes reshuffled.** GitHub Light was indistinguishable from the default Light palette (both used the same `#0969da` accent and near-identical grays), so it was dropped. The Light group now has five clearly-differentiated options:
  - **Light** — Yeogi's default, neutral grays, GitHub-style blue accent
  - **Atom One Light** — warm-tinted, slightly blue-purple accent
  - **Solarized Light** — warm beige `#fdf6e3`, teal accent — Ethan Schoonover's canonical palette
  - **Ayu Light** — soft warm whites, bright orange accent
  - **Alabaster** — minimalist off-white, pure black text, muted blue accent Dark group unchanged (Dark, Dracula).

## v0.4.0 — 2026-04-23

### New

- **Named themes.** `View → Appearance` now offers a starter set of four curated palettes in addition to **Follow System**:
  - **Light group:** Light, GitHub Light
  - **Dark group:** Dark, Dracula Follow System (default) picks Light or Dark based on `prefers-color-scheme` and flips live when the OS appearance changes. Picking any named theme switches the full palette (sidebars, tab bar, editor, preview, Shiki code-block syntax highlighting, and Mermaid diagrams) and persists across relaunch. The shape supports arbitrary additions — adding more themes in a future release is a mechanical data change.
- **Tutorial refresh.** The first-run tour catches up with v0.3.x features: side-by-side panes (⌘-click folder, right-click tab Open-to-the-Side), Save / Save As (⌘S / ⇧⌘S), Open Recent, Appearance menu, wiki-link pipe form + auto-create + backlinks, and fixes the stale "⌘E = inline code" entry (⌘E now toggles WYSIWYG ↔ Edit).

### Fixed

- **Shiki code-block theme follows the app theme.** Previous releases hardcoded `github-dark`, so code blocks rendered with a dark background even in light mode. Each named theme now specifies its preferred Shiki theme (e.g. Light → `github-light`, Dracula → `dracula`), and the preview pipeline re-renders when the theme changes.

## v0.3.5 — 2026-04-23

### Fixed

- **Dark-mode legibility.** The v0.3.4 dark theme left several surfaces unreadable:
  - **WYSIWYG / Edit segmented control** — active segment rendered as white-on-white in dark mode. Now inverts with the theme (dark pill in light mode, light pill in dark mode) via a `var(--bg)` foreground instead of hardcoded `#fff`.
  - **Tables** — header and striped-row backgrounds were hardcoded light gray (`#eceef1`, `#f6f7f9`). Now use `var(--bg-sidebar)` for headers and a `rgba(125,125,125,0.06)` relative tint for stripes, which reads correctly in both modes.
  - **Inline code pills** (\`\`\`code\`\`\`) — background and foreground were hardcoded light values. Now `var(--bg-hover)` + `var(--text)`.
  - **Mermaid card background** — previously forced `#ffffff`, masking the light-on-light text in dark mode. Now `var(--bg)`.
- **Mermaid diagrams follow the app theme.** The preview pipeline and the WYSIWYG mermaid node both re-read the resolved theme from `html[data-theme]` at render time and initialize mermaid with its built-in `dark` theme when appropriate. PreviewPane and the mermaid node both re-render when the theme preference flips so existing diagrams pick up the new theme without an edit.

## v0.3.4 — 2026-04-23

### New

- **Dark mode.** `View → Appearance` submenu with three radios: **Follow System** (default — follows the OS appearance and updates live if you flip it), **Light**, **Dark**. The dark palette recolors sidebars, tab bar, top bar, editor surface, gutters, and the Markdown preview; the brand red stays identical as the identity color. Preference persists across relaunch. CodeMirror's Edit mode also recolors without a remount (theme is driven off CSS vars the root element controls).
- **File → Save** (`⌘S`) and **File → Save As…** (`⌘⇧S`). Save writes the current buffer to its path (prompting Save As if the doc is untitled). Save As always prompts for a destination; the open document is re-pointed to the new path so subsequent saves go there, and the watcher re-subscribes so external-change detection follows the copy.

## v0.3.3 — 2026-04-23

### New

- **Keyboard shortcut to toggle WYSIWYG ↔ Edit.** `⌘E` flips the focused pane between the rich WYSIWYG renderer and the raw-markdown CodeMirror editor. Matches Obsidian's "Toggle Edit / Reading View" convention; no-op when no document is open.

### Fixed

- **External HTTPS images now display.** Inline `![alt](https://example.com/foo.png)` and raw `<img src="https://...">` tags were blocked by the content-security policy (`img-src` only allowed `self` / `data:` / `blob:` / the Tauri asset bridge). Adding `https:` to `img-src` lets remote images through, while still blocking cleartext `http:` (mixed-content hygiene).

## v0.3.2 — 2026-04-23

### New

- **File → Open Recent** is no longer a stub. The submenu now lists up to 10 recently-opened files (most-recent first, basename shown), plus a **Clear Menu** item at the bottom. Click any entry to open it in the focused pane. The list is deduped, persisted in localStorage, and survives relaunch. When empty, the submenu shows a disabled "(No recent files)" placeholder.

## v0.3.1 — 2026-04-23

### Fixed

- Build is now code-signed with a stable local identity instead of ad-hoc. The on-disk app's code-signing Identifier is now the plist-level `com.yeogi.mdeditor` for every build, where it used to be `yeogi_md_editor-<per-build-hash>`. macOS's TCC (Transparency, Consent, Control) treated each ad-hoc build as a different app and re-asked for Documents-folder access after every auto-update; with a stable identifier the grant persists across updates. (Gatekeeper's "unidentified developer" warning on first install is unchanged — that needs Apple Developer Program notarization, separate upgrade path.)

## v0.3.0 — 2026-04-23

### New

- **Side-by-side documents.** Open two documents in the same window, each with its own tab strip, view-mode toggle (WYSIWYG/Edit), and independent scroll. Trigger via ⌘-click in the Folder panel or right-click a tab → Open to the Right / Left Side. The label is directional — from the right pane it reads "Open to the Left Side." Resize the split by dragging the handle; ratio is persisted and restored on relaunch along with both panes' tabs, active tab, and view mode.
- **Same-doc lock.** When the same document is active in both panes (e.g. raw Markdown on the left, WYSIWYG on the right), the right pane is locked read-only to keep undo coherent. A banner in the right pane explains the rule; edits on the left mirror to the right live.
- **"+" tab menu.** The new-tab button no longer jumps straight to a file picker — it opens a small menu offering "Create blank document" or "Open file(s)…" (matching the New-document idiom in Word / Pages).
- **Create blank document.** Empty-pane state promotes a large icon-led button that opens an untitled in-memory buffer. Fresh editors auto-focus on mount so a blank doc is immediately typeable.
- **Wiki-link piped display.** `[[Target|Display]]` parses and renders; the round-trip to markdown preserves both parts. Single-target `[[Target]]` is unchanged. Malformed forms (`[[Unclosed`, `[[Target|]]`, `[[|Display]]`, nested, multi-pipe) fall through as plain text without crashing.
- **Auto-create missing wiki-link targets.** Clicking `[[Missing Node]]` writes `Missing Node.md` at the folder root (seeded with `# Missing Node`) and opens it — matches Obsidian's create-on-click behavior. Filenames are sanitized against OS-illegal characters.
- **Backlinks (light).** The Outline panel grows a "Backlinks" section when a folder is open. For each other markdown file under the folder that links to the active doc, shows the source's basename + a one-line preview (truncated to 120 chars, centered on the match) + a "+N" badge for additional occurrences in the same source. Click to open. Scan caps at 500 directories.
- **Directional right-click tab menu.** Labels read "Open to the Right Side" on primary tabs and "Open to the Left Side" on secondary tabs so the destination is never ambiguous.
- **Chrome polish.** Tab bar and top bar share the same neutral `#fafafa` as the sidebars, so the app's top chrome reads as one continuous band. Active tab carries a 2-px brand-red indicator (muted gray on the inactive pane). Files panel font matches the Outline's level-1 weight so both sidebars feel like one visual family. Autosave switch is brand-red when on.

### Fixed

- `[[README.md]]` (and other targets that include the `.md` extension) now resolves to the existing `README.md` instead of silently creating a duplicate `README.md.md`. Same fix applies to the backlink scanner.
- Closing a tab that's open in both panes now closes it only on the side you clicked. Previously, the document-store close forwarded to both panes, so the other side lost its view too.
- WYSIWYG pane's `editable` flag syncs when `readOnly` changes (Tiptap only read it at mount before), so same-doc read-only toggles apply live without a remount.
- `setActive` bridge in the documents store now preserves the focused pane instead of stealing focus when the doc happens to live in the non-focused pane.
- Secondary panes holding a different document are immediately editable on click — the old `isFocused` gate required a second click to place a cursor. The hard read-only rule now applies only in the same-doc case, which has its own banner.

## v0.2.5 — 2026-04-23

### New

- Primary-action buttons (Open file(s), Open folder, Install & Restart) and the update banner adopt the brand red (Pantone Red 032 C — `#F7323F`) as their CTA color, matching the app icon. Accent blue is still used for focus rings, caret, text selection, and links so it remains the "live-interaction" signal.

### Fixed

- App icon now sits inside macOS's 824 × 824 safe area on the 1024 × 1024 canvas (per Apple's macOS Big Sur+ template), with 100 px transparent margin on every side. This removes the persistent grey rim the Dock was rendering around the edge: with no artwork pressed against the canvas boundary, there's nothing for the OS to outline.

## v0.2.4 — unreleased

Collapsed into v0.2.5 (the near-black CTA theme was superseded by the brand-red theme before the tag went public).

## v0.2.3 — 2026-04-23

### New

- Empty state (no file open) offers both **Open file(s)…** and **Open folder…** side-by-side, styled identically so neither is the biased "primary" choice. Button widths tightened — less blank padding.
- Opening a folder automatically reveals the Folder Explorer panel if it was hidden, so you don't have to toggle ⌥⌘1 after picking.

### Fixed

- Dock icon fully transparent around the red rounded square. The source goes through an aggressive flood-fill, a despill pass, AND a second flood + despill after the Lanczos upscale — so the anti-aliased ring the resize introduced doesn't bleed as a gray/pink halo.

## v0.2.1 — 2026-04-23

### Fixed

- Confirmed the Tauri auto-updater end-to-end: `v0.2.0` installs notice this release, download the signed `.app.tar.gz`, verify the signature against the baked-in pubkey, swap the bundle, and relaunch. No code changes beyond the version bump; this release exists to validate the pipeline now that the repo, signing key, and manifest endpoint are live.

## v0.2.0 — 2026-04-23

### New

- **Folder Explorer panel.** Open a folder (⌥⌘O / View menu) to browse its markdown files as a tree in a left sidebar. Files open in new tabs; the selected folder persists across restarts.
  - Header actions: open-folder (swap), search (filename filter, case- insensitive, auto-expands matches), expand-all (BFS-loads every sub- directory to a safety cap of 500, then expands), collapse-all, close.
- **Outline panel.** Live table of contents. Click a heading to jump to it (slug-matched against the rendered doc so duplicate headings and nested nodes don't drift the target).
- **Resizable, toggleable sidebars.** Drag to resize; keyboard toggles ⌥⌘1 (Files) and ⌥⌘2 (Outline); ⌘\\ hides both and remembers the previous layout on the next press. Widths persist.
- **Wiki-style links** `[[Target]]`**.** Parse, render, and click-to-open against the active folder — BFS search, exact then case-insensitive match. Round-trips on save. Insert button in the toolbar.
- **Footnotes.** `[^id]` references with `[^id]: body` definitions collected in an auto-rendered section. Insert button auto-suggests the next free id and drops a stub definition you can type into.
- **Subscript / Superscript / Highlight marks** with toolbar buttons and keyboard shortcuts (⌘, ⌘. ⇧⌘H). Supports `H~2~O`, `E=mc^2^`, `==highlight==` syntax.
- **Text alignment** for paragraphs + headings (left / center / right / justify) via toolbar, persisted as inline style in markdown.
- **Table column alignment.** GFM `:---` / `:---:` / `---:` markers now round-trip through save cycles. Toolbar buttons (shown when cursor is inside a table) set the current cell's alignment; the delimiter row carries it across every row on save.
- **Image insertion from URL or local file upload.** Embeds local images as data URLs so documents stay self-contained. Corner handles for resizing; aspect ratio locked by default.
- **Mermaid + LaTeX insert dialogs** with side-by-side live preview, template palettes, and (for LaTeX) a categorized symbol palette.
- **Resizable Mermaid diagrams** that re-flow their layout at the new width (Gantt date ticks especially benefit) instead of scaling.
- **Per-document Autosave toggle** in the top bar. Saves trigger \~500 ms after you stop typing, or every \~2 s during a sustained streak.
- **Close-with-unsaved-changes guard.** Dirty tabs prompt Save / Don't Save / Cancel instead of silently dropping edits.
- **External file-change reconciliation.** If an open file changes on disk, a banner offers Keep or Reload; clean files silently update.
- **Mode-switch scroll preservation.** Toggling WYSIWYG ↔ Edit keeps the heading nearest the viewport top pinned in place.
- **Anchor-link scrolling.** `[text](#heading)` links scroll to the matching heading (slug-matched, no id= attributes required).
- **Universal macOS .dmg** (arm64 + Intel) via `pnpm release:build`.
- **Auto-updater plumbing** (Tauri updater plugin wired, minisign signing keys supported — configured per the docs, UI banner in place).
- **First-run tutorial.** Multi-step walkthrough that also covers wiki- links, footnotes, shortcuts, and the "Open With" default-handler flow.
- **.md file association.** Double-click / "Open With" from Finder routes through the Rust `RunEvent::Opened` bridge into a new tab.
- **Find and Replace** in both modes — CodeMirror's built-in panel for Edit, a ProseMirror-decoration bar for WYSIWYG.
- **Export HTML** + **Print to PDF** (routed via default browser so macOS's "Save as PDF" works reliably in WKWebView).
- **Chrome-style "+" button** at the end of the tab strip, and middle- click to close.

### Fixed

- Mermaid ER diagrams: HTML labels survived DOMPurify by dropping `USE_PROFILES` from the sanitize config.
- Mermaid resize: was previously scaling the SVG (so text grew with the box); now reconfigures per diagram type and re-runs at the new width.
- Mermaid YAML frontmatter lines inside a diagram no longer get mis-detected as the diagram type token.
- Table column alignment survives save/reopen: tiptap-markdown's default Table serializer wiped `:---:` markers on every save, overridden now.
- TOC clicks land on the intended heading even with hidden frontmatter nodes or duplicate heading text: match by slug + level + occurrence order instead of raw DOM index.
- Footnote references render as `<sup>` with a working anchor instead of as literal `[^1]` text.
- Highlight (`==text==`), subscript (`H~2~O`), superscript (`E = mc^2^`) now parse correctly and round-trip on save — they previously rendered as literal delimiter text.
- Print from the menu bar used to silently drop the gesture (WKWebView blocks `window.print()` from IPC); routes through a temp HTML file opened in the default browser now.
- "Unsaved" indicator was showing "Saved" while autosave was off and the buffer was dirty; priority order fixed.
- File-watcher subscription is now reliably re-issued across tab switches and folder changes.
- External-change detection: a clean buffer reloads silently; a dirty one prompts before overwriting user edits.
- Tab session restore is scoped per document so a rapid tab switch during the async mount window can't apply heading positions from doc A to doc B.
- WYSIWYG ↔ Edit mode switch: captured heading is now matched back to the TOC list by slug + level before being used as the scroll target, so mode-switch doesn't drift the viewport when one mode has heading elements the other doesn't.