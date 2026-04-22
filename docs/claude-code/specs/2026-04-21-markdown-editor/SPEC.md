# SPEC — macOS Markdown Editor (v1)

Date: 2026-04-21
Status: Design approved; pre-implementation.

## Problem

AI tools generate high volumes of Markdown. Existing readers (Meva) render it beautifully but cannot edit or create files. Existing editors (VS Code, Obsidian) edit well but are heavy, project-oriented, or optimized for code rather than prose. There is no focused, instant, free, Mac-native application that combines Meva-class reading with first-class editing and file creation.

## Goal

Ship a focused, open-source, free macOS desktop application that reads and edits `.md` files, with:
- Meva-class rendering (LaTeX, Mermaid, syntax-highlighted code) in a preview window.
- A source-based editor paired with a Word-style formatting toolbar.
- Instant launch, small binary, no "project setup" — point it at a folder and go.

## Non-goals (v1)

- Cross-platform support. Architecture is Tauri-compatible with Windows/Linux; shipping them is out of scope.
- Mac App Store distribution. Direct download with signing + notarization only.
- Theme customization beyond one light and one dark theme.
- Cross-folder / global search. Only Cmd-F within the active document.
- Collaborative editing, cloud sync, version history, built-in LLM features.
- Journaled crash-recovery. Autosave 2 s ceiling is accepted for v1.
- Sandbox / security-scoped bookmarks. Signed + notarized, not sandboxed.

## Stack

- **Shell:** Tauri (Rust), one process per app instance. Responsible for file I/O, file watcher, window management, native menus, PDF export.
- **UI (main + preview windows):** TypeScript + React in WebKit webviews.
- **Editor component:** CodeMirror 6 (source editor, find, scroll-spy, toolbar transactions).
- **Markdown pipeline:** `unified` + `remark-parse` + `remark-gfm` + `remark-math` → `remark-rehype` + `rehype-katex` + `rehype-shiki` + `rehype-mermaid` → `rehype-stringify`. One pipeline, shared by preview window and HTML/PDF export.
- **Tests:** Vitest (unit + component with React Testing Library), Rust integration tests against `tempfile::TempDir`, Playwright for E2E against `tauri dev`, `axe-core` for accessibility on preview output.
- **IPC:** Tauri commands (request/response) and Tauri events (push). Typed on both sides.

## Scope — feature list

### Reading features
- LaTeX / math rendering (KaTeX).
- Mermaid diagrams rendered as SVG. Graceful inline error when a diagram fails to parse.
- Syntax-highlighted code blocks via Shiki (100+ languages).
- Auto table of contents from headings, with scroll-spy highlight.
- Multi-document tabs, drag-to-reorder, close button, dirty dot.
- Folder browser / file tree sidebar (Cmd-B to toggle).
- Live reload on external file changes, preserving scroll and cursor when the open document is clean.
- In-content search (Cmd-F): next/prev, case-sensitivity, regex. Find + replace included.
- PDF export.
- HTML export (standalone, styles inlined).
- Copy-button on every code block in the preview.
- Light and dark themes (one of each). Active theme follows the macOS system appearance by default; a preference lets the user pin it to light or dark manually.

### Editing features
- Source-only editor. No WYSIWYG, no split source/preview pane.
- Word-style formatting toolbar with: **B**old, *Italic*, H1, H2, H3, unordered list, ordered list, checkbox list, link, inline code, code block, block quote, horizontal rule, insert table. Each action dispatches a CodeMirror transaction that inserts the correct markdown syntax at the cursor or around the selection.
- Undo / redo with a reasonable history depth.
- Autosave default **on**, 2 s debounce after the last keystroke. Preference toggle to turn off.
- When autosave is off, closing a dirty tab or the app prompts: `Save · Don't save · Cancel`.
- When autosave is on, pending debounced writes are synchronously flushed on close.
- Dirty-state indicator in the tab and the status bar.
- New file (Cmd-N), Save / Save As, Open file (Cmd-O), drag-drop from Finder.

### Preview behavior
- Separate macOS window per open document, created on toggle.
- Syncs from the editor at a 200 ms debounce.
- Renders via the shared markdown pipeline — same output as export.
- Can be dragged to a secondary monitor.
- Closing a document tab closes its preview window.
- If the editor window closes while a preview is open, the preview shows a read-only banner; the window can be closed or kept for reference.

## Architecture

**Process model.** One Rust process per app instance. It owns file I/O, a `notify`-based file watcher, window creation, native menu wiring, and PDF export via headless WebKit print. All UI runs in WebKit webviews. Two kinds of windows: **the main editor window** (file tree, tabs, toolbar, editor, TOC, status bar) and **preview windows** (one per document, created on toggle, closeable independently).

**Communication.**
- Tauri IPC commands (typed on both sides): `fs.read`, `fs.write`, `fs.create`, `fs.rename`, `fs.list`, `watcher.subscribe`, `watcher.unsubscribe`, `export.pdf`, `export.html`, `window.openPreview`.
- Tauri events (Rust → UI): `file.changed`, `watcher.lost`, `preview.contentUpdate` (main → preview window).

**Module map.**

```
src/                        # TS/React UI (main webview)
  app/                      # root, providers, global state
  components/
    FileTree/               # folder sidebar, keyboard nav, rename
    TabBar/                 # multi-doc tabs, drag-reorder, close, dirty dot
    Toolbar/                # Word-like formatting actions
    Editor/                 # CodeMirror 6 wrapper + extensions
    TOC/                    # headings list + scroll-spy
    FindPanel/              # Cmd-F find + replace
    StatusBar/              # dirty state, cursor, word count, save status
  preview/                  # preview window entry (separate route)
  lib/
    markdown/               # unified pipeline (shared by preview + export)
    toolbar/                # action → CodeMirror transaction mappings (pure)
    themes/                 # light / dark tokens
    ipc/                    # typed Tauri command wrappers
  state/                    # documents[], activeDocId, watcher subs, prefs
src-tauri/                  # Rust backend
  src/
    main.rs                 # Tauri setup, windows, native menus
    fs.rs                   # read / write / create / rename, UTF-8 detection, path safety
    watcher.rs              # notify-based watcher, mtime tracking
    export.rs               # PDF via headless WebKit print; HTML write
    commands.rs             # #[tauri::command] handlers
  tauri.conf.json
tests/
  unit/                     # Vitest: pipeline, toolbar actions, path sanitization
  component/                # Vitest + RTL: FileTree, Toolbar, TOC, FindPanel
  e2e/                      # Playwright golden paths
```

**Key boundaries.**
- Document model + file I/O live only in `state/` (TS) and `src-tauri/fs.rs` (Rust). Presentation never reads or writes disk directly.
- Toolbar actions are pure functions: `(editorState, action) → editorTransaction`. Testable without mounting anything.
- The markdown pipeline is one module, used by preview, HTML export, and PDF export.

## Data flow

**Document state shape.** `{ id, path, content, savedMtime, isDirty, cursor, scrollTop, encoding }`. All open docs held in a single `documents[]` store in the main window. Dirtiness is `content !== lastSavedContent`.

**Open a file.** Click in file tree (or Cmd-O, or drag-drop) → `fs.read(path)` → Rust returns `{ content, mtime, encoding }` → UI creates a Document, opens a tab, subscribes the watcher to the path, focuses the editor.

**Create a new file.** Cmd-N → in-memory Document with `path=null`, `isDirty=true`. First save triggers Save-As. After save, watcher subscribes.

**Edit + autosave (default on).** CodeMirror `onChange` updates `content`. A 2 s per-document debounce calls `fs.write(path, content)`. Rust writes, returns the new mtime. UI sets `savedMtime`, clears `isDirty`. Close / quit while debounce is pending synchronously flushes the write before the window closes.

**Edit + autosave off.** No write on idle. Dirty state persists. On tab close / window close / quit, if any document is dirty, show `Save · Don't save · Cancel`.

**External change detection.** Watcher fires `file.changed(path, mtime)`. UI compares to `savedMtime`:
- Equal → ignore (our own write echoing back).
- Greater AND clean → silent reload, re-read, preserve scroll + cursor by anchoring to nearest heading / line-hash.
- Greater AND dirty → **conflict banner** in that tab with three buttons: `Keep mine · Reload disk · Show diff`. Never silently overwrite.

**File renamed / moved on disk.** If clean, re-home the tab to the new path silently. If dirty, conflict banner.

**Preview window sync.** Toggle preview → main calls Tauri to open a preview window with `?docId=<id>`. Preview subscribes to `preview.contentUpdate` for that id. Editor changes are debounced 200 ms, then main emits the content → preview runs the pipeline and renders. Closing preview unsubscribes. Closing the tab closes its preview window.

**Export.** Menu → Export → PDF or HTML. UI runs the shared pipeline to produce final HTML. For HTML, Rust inlines styles and writes the file. For PDF, Rust opens headless WebKit, loads the HTML, uses the platform print API to produce the PDF.

**Find + replace.** Cmd-F opens a CodeMirror search panel. Pure UI; no IPC.

## Error handling

- **File I/O errors** (permission denied, disk full, path vanished): Rust returns a typed error. UI shows `"Couldn't save: <reason>" [Retry]` inline in the tab. Dirty state persists. Never a modal for writes; the user may just need to free disk.
- **Binary / non-UTF-8 file on open.** Rust sniffs null bytes in first 4 KB and attempts UTF-8 decode. Failure → modal: `"This doesn't look like a UTF-8 text file. Open read-only anyway? · Cancel"`. Read-only mode disables the editor and toolbar but keeps preview available.
- **Large file warning.** On open of files > 10 MB, show one-time confirmation: `"Large file — typing may lag. Open?"`. No hard cap.
- **Render errors inline.** KaTeX / Mermaid per-block failures render an inline error block in place of the bad content; the rest of the preview stays intact.
- **Watcher loss** (unmount, descriptor exhaustion): Rust emits `watcher.lost`. UI shows a persistent status-bar indicator, `"⚠ file watcher offline — external changes won't reload"`, with a click-to-retry. Does not block editing.
- **Preview orphaned.** If the main window closes or crashes while a preview is open, the preview detects IPC disconnect, shows a read-only banner, disables interaction except close.
- **Export failures.** Typed error → modal `"Export failed: <reason>" [OK]`. Never write an empty file.
- **Startup.** Malformed preferences → load defaults, log once. Missing last-session folder → open to the "No folder open" empty state.
- **Crash safety.** Autosave-off ceiling is the dirty-state protection (confirmation on close). Autosave-on ceiling is 2 s. No per-document journaling in v1.

## User journeys

### Read an existing file
1. Launch → "No folder open" empty state with `Open folder…` button.
2. Open folder → file tree populates.
3. Click a `.md` → opens as active tab, editor focused.
4. Toggle preview → preview window opens; drag to another monitor if desired.

### Edit an existing file
1. Click in the editor, start typing → dirty dot appears on the tab.
2. Stop typing → 2 s later, autosave fires → dirty dot disappears, status bar shows `Saved just now`.
3. External change hits while dirty → conflict banner with three buttons.

### Create a new file
1. Cmd-N → new untitled tab, dirty, no path.
2. Type content → autosave fires after 2 s → Save-As sheet appears on first save.
3. Choose name + location → file written, watcher subscribes, tab title updates.

### Export
1. Menu → Export → PDF or HTML.
2. Save panel → choose path.
3. File written → toast `"Exported to <path>"`. Failures surface as a modal.

## Key UX states

- No folder open (empty state).
- Folder open, no file open.
- File loading (files > 2 MB show a skeleton briefly).
- File loaded, clean.
- File loaded, dirty.
- Save in progress.
- Save failed.
- External change, clean → silent reload.
- External change, dirty → conflict banner.
- File moved / deleted on disk.
- Watcher offline.
- Binary / non-UTF-8 file (read-only).
- Large file warning (> 10 MB).
- Close / quit with dirty tabs (autosave-off only).
- Render errors inline in preview.
- Preview window orphaned (editor closed or crashed).

## Acceptance criteria

### User-visible behavior
1. All 12 listed reading features work end-to-end.
2. All listed editing features work end-to-end. Toolbar buttons insert the correct markdown syntax at cursor or around selection.
3. Autosave default-on writes the file within ~2.1 s of the last keystroke.
4. Autosave-off prompts for save on dirty close.
5. Conflict UI presents three buttons when an external change hits a dirty document. No silent overwrite path exists.
6. Preview window updates within ~250 ms of a keystroke (200 ms debounce + render).
7. PDF and HTML exports retain LaTeX math, Mermaid diagrams, syntax-highlighted code.

### Quality gates
1. Unit + component + integration tests pass in CI.
2. Four E2E golden paths pass locally on a signed dev build.
3. `axe-core` reports no violations on a reference preview document.
4. Cold launch to interactive editor under 1 s on an M-series Mac (manual release check).
5. Typing latency under 16 ms per keystroke on a 1 MB document (manual release check).
6. A 10 MB file opens to interactive state within 3 s (manual release check).
7. Full keyboard traversal works for file tree, tabs, toolbar, find panel, preview window. Every icon-only button has an `aria-label`.

## Risks

- **Tauri + signing + notarization.** First build will likely stumble on entitlements / provisioning; budget a day for this.
- **CodeMirror 6 toolbar transactions.** Community examples exist but building robust selection-wrapping for every action requires careful testing.
- **Mermaid render cost on complex diagrams.** If a document has a 500-node graph, preview may stall. Mitigation: render in a web worker if real documents show the issue.
- **File watcher on huge folders.** `notify` may hit descriptor limits on folders with tens of thousands of files. Fallback to polling if `notify` fails at subscribe time.
- **KaTeX failures.** Ill-formed math throws; wrap per-fence to keep the rest of the preview rendering.

## Rollout / rollback notes

- v1 has no existing users. No rollout risk.
- No proprietary sidecar files — the app reads and writes standard `.md`. A future version can move to a different editor or renderer without migrating user data.
- Export outputs (PDF, HTML) should remain viewable outside the app in perpetuity.
