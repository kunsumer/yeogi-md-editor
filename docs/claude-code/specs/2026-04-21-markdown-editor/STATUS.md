# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–9 + Phase 7.5 of PLAN.md complete. On `main` branch, HEAD at the CSP commit.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs`, `watcher.rs`, `commands.rs` (8 commands now: 5 fs + watcher_subscribe + window_open_preview + window_close). `lib.rs::run()` owns mpsc → `file.changed` / `watcher.lost`, intercepts main-window close.
- Frontend primitives: typed IPC wrappers, `decideOnExternalChange`, `useDocuments` (path-idempotent `openDocument`), `usePreferences`, `sessionPersistence`.
- Hooks: `useAutosave`, `useWatcherEvents`.
- Markdown pipeline (Phase 8): `renderMarkdown` (parse → GFM → math → rehype + rehypeMermaidInline + rehype-raw → KaTeX → @shikijs/rehype → sanitize → stringify).
- Preview window (Phase 9):
  - `src/lib/safeInsertHtml.ts` — `sanitizeHtml` (DOMPurify) + `safeReplaceChildren` (DOMParser + replaceChildren). The single DOM insertion path for rendered HTML.
  - `preview.html` + `src/preview/main.tsx` + `src/preview/Preview.tsx` — separate Vite entry; Preview listens for `preview.contentUpdate` (filtered by docId), pipes through `renderMarkdown` + `safeReplaceChildren`, attaches Copy buttons to each `<pre>`. Listens for `editor.closed` to show an orphan banner.
  - `vite.config.ts` — `build.rollupOptions.input` map for both entries.
  - Rust `window_open_preview` (idempotent on existing label) + `window_close` commands; `src-tauri/capabilities/preview.json` grants `core:default` to `preview-*` windows.
  - App `togglePreview` is wired to a temporary StatusBar button (Phase 10 moves it into a toolbar). 200 ms debounced `emit("preview.contentUpdate")` on `active.content` change while the preview is open.
  - `app.close-requested` handler now `emit("editor.closed")` before destroying so previews flip to orphan.
- CSP re-enabled in `tauri.conf.json`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: asset: http://asset.localhost; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420 http://localhost:1420`.
- Tauri capabilities: `default` (main window: core + window_destroy + dialog) and `preview` (preview-* windows: core).
- 16 Rust tests, 36 TS tests (12 test files), `pnpm lint` clean, `cargo build` clean, multi-entry `pnpm build` produces both `dist/index.html` and `dist/preview.html`.

## In progress

None. Out-of-plan: Preview mode is now a WYSIWYG editor (Tiptap + StarterKit + TableKit + Image + tiptap-markdown) with a Word-style ribbon. See `src/components/WysiwygEditor/`. Phase 10's CodeMirror toolbar supplants the separate read-only preview entirely — `PreviewPane` component remains on disk but is no longer rendered by `App.tsx`.

Known v1 gaps in WYSIWYG mode (all safely passthrough via `tiptap-markdown` with `html: true`, but not interactively editable):
- KaTeX math (`$…$`, `$$…$$`) — renders as literal text.
- Mermaid code fences — shown as a plain code block; live render only in Edit mode's preview.
- GitHub admonitions (`> [!NOTE]`), footnotes, YAML frontmatter, definition lists, wikilinks, `==highlight==`, `~sub~/^sup^` — round-trip as best-effort plain markdown / blockquote.

Ready to resume at **Phase 10 — Word-like formatting toolbar** for *Edit* mode (CodeMirror transaction helpers + a CM6 toolbar). The WYSIWYG ribbon already covers Preview mode.

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; `pub fn run()` lives in `lib.rs`.
- **ts-rs 8.1 export path quirk:** generated file at `src-tauri/src/lib/ipc/types.ts` (gitignored), committed `src/lib/ipc/types.ts` frozen with `bigint`. IPC wrappers cast.
- **Close flow uses `destroy()` not `close()`:** Tauri 2 API is `getCurrentWindow()`, needs `core:window:allow-destroy`.
- **WKWebView DevTools quirk:** Safari Web Inspector does NOT allow top-level `await`. Use IIFE or `.then(...)`.
- **Session persistence:** localStorage key `evhan-md-editor:session`. `openDocument` is path-idempotent.
- **`@types/react` / `@types/react-dom`** pinned to `^18`.
- **Mermaid + jsdom:** mocked in pipeline.test.ts because jsdom doesn't implement `getBBox`; real-browser behavior must be smoke-tested.
- **CSP is permissive in v1** — Phase 13 will tighten (drop dev-only `ws://localhost:1420 http://localhost:1420`, narrow `asset:` etc.). Inline styles are load-bearing for CodeMirror, Shiki, and the inline `style={{...}}` JSX patterns we use everywhere.
- **Phase 5 deviations:** `getCurrentWindow` + `destroy()`.
- **Phase 6 deviations:** `useWatcherEvents(setWatcherOffline)` passes the stable setter.
- **Phase 7 deviations:** `FileTree` Node uses split spans; imports `DirEntry` from `./lib/ipc/commands`.
- **Phase 7.5:** OpenButtons + session restore, `openFile` uses `getState()` for live-state dedupe.
- **Phase 8 deviations:** swapped `rehype-shiki` for `@shikijs/rehype`; added `rehype-raw` (mermaid SVG bridge); added `@types/hast`; CSP deferred from 8 to 9.
- **Phase 9 deviations from PLAN.md:**
  - The plan placed the preview button "in StatusBar" temporarily (Phase 10 moves it). Wired StatusBar to accept optional `onTogglePreview` + `previewOpen` props rather than poking a button into App's render tree directly. Same end state, cleaner contract.
  - The plan's "extend the close handler" only mentions one branch. Extended all three (autosave-on, clean, confirm-then-destroy) since each one calls `destroy()` independently.

## Risks

- **CSP runtime breakage:** the CSP was set without a manual smoke test. Most likely failure is HMR if the dev URL or port is different on a contributor's machine, or KaTeX fonts loaded over `https:` rather than data:. Easy to relax if it bites; revert is one config flip.
- **Preview window event ordering:** if a preview is opened in the same tick a user closes the app, `editor.closed` may fire before the preview's `listen` resolves. Low-impact (preview just won't show the orphan banner; window will still close eventually).

## Next milestone

Phase 10 — Word-like formatting toolbar (CM6 transaction helpers + Toolbar component, move preview button into the toolbar). Then Phase 11 — TOC + copy-button tests.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 10. Read this STATUS.md first.`
