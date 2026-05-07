# TEST_CASES — macOS Markdown Editor (v1)

Testing pyramid: cheap to expensive. Unit and component cover most logic; integration verifies IPC contracts; E2E covers four golden paths only.

## Unit (Vitest, no DOM)

- Markdown pipeline produces expected HTML for: headings, GFM tables, GFM task lists, inline + block math, Mermaid fences (resolves to SVG), fenced code (language → Shiki output), images, links.
- Toolbar-action → CodeMirror-transaction mapping for every action: bold, italic, H1/H2/H3, ul, ol, checkbox, link, inline code, code block, block quote, hr, insert table. Cursor-only and selection-wrapping cases for each.
- Path sanitization: reject absolute paths outside opened folder when path is untrusted input; handle symlinks, long paths, special chars.
- mtime-comparison / conflict-decision function: every combination of (equal / greater / less) × (clean / dirty).
- Scroll-spy heading resolver: given doc + scroll position, returns correct active heading id.
- Find-match counter: count, next, prev, case-sensitivity, regex.

## Component (Vitest + React Testing Library, IPC mocked)

- **FileTree**: renders nested folders, keyboard navigation (up/down/left/right/enter), rename flow, drag-drop into folder.
- **TabBar**: open / close / reorder, dirty dot visibility, middle-click close, keyboard tab switching.
- **Toolbar**: each button dispatches correct transaction against a mock editor state; disabled state when read-only.
- **TOC**: renders heading tree, scroll-spy highlight updates when active heading changes.
- **FindPanel**: open, match count, next / prev, replace one, replace all, close with Escape.
- **StatusBar**: dirty state, save status (`Saved just now` / `Saving…` / `Save failed`), cursor + word count.

## Integration

### Rust (cargo test against `tempfile::TempDir`)
- `fs.read`: returns content + mtime + encoding; errors on missing path, non-UTF-8 content.
- `fs.write`: writes file, returns new mtime; errors on permission-denied, read-only path.
- `fs.create`: creates empty file at path; errors if path exists (unless overwrite flag).
- `fs.rename`: renames atomically; errors if target exists.
- `watcher.subscribe` + `watcher.unsubscribe`: fires `file.changed` on write; debounces rapid-fire changes.
- `export.pdf`: produces non-empty PDF with known-good input HTML.
- `export.html`: writes HTML with inlined styles.

### TS (IPC wrappers against fake Tauri runtime)
- One integration test per conflict case: clean external reload, dirty conflict, watcher loss, move detected.

## E2E (Playwright against `tauri dev`) — golden paths only

1. **Open → edit → autosave.** Open a folder, click a `.md`, type, wait 2.1 s, verify file on disk matches editor content; verify dirty dot clears.
2. **External change.** With a file open and clean, modify the file externally → editor reloads silently and preserves scroll. With the file dirty, modify externally → conflict banner appears with three buttons.
3. **Preview window.** Toggle preview; verify preview window opens; type in main; verify preview updates within 250 ms.
4. **Export PDF.** Open a document with math, Mermaid, and syntax-highlighted code. Export → PDF on disk is non-empty and opens successfully; expected headings appear in the file.

## Accessibility

### Automated (in E2E)
- `axe-core` on the rendered preview for a reference document with all feature kinds. Zero violations.
- Keyboard traversal of file tree, tabs, toolbar, find panel, preview window — no focus traps (except intentional modal ones).
- Every icon-only toolbar button has an `aria-label` including its Cmd-shortcut.
- Escape closes find panel, closes preview window, dismisses banners.

### Manual (release checklist)
- VoiceOver reads toolbar actions, tab titles, dirty state.
- Dynamic Type respected in editor + UI chrome.
- Focus rings visible at system default.

## Performance (manual, release checklist — not CI-gated)

- Cold launch to interactive editor: < 1 s on an M-series Mac.
- Typing latency on a 1 MB file: < 16 ms per keystroke (single frame).
- 10 MB file open: < 3 s to interactive.
- Preview re-render after keystroke: < 200 ms after debounce fires.
