# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–8 + Phase 7.5 of PLAN.md complete. On `main` branch, HEAD `912d44d`.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs`, `watcher.rs` (debounced), `commands.rs` (6 commands). `lib.rs::run()` owns mpsc → `file.changed` / `watcher.lost`, intercepts main-window close.
- Frontend primitives: typed IPC wrappers (`mtime_ms: number`), `decideOnExternalChange`, `useDocuments` (path-idempotent `openDocument`), `usePreferences`, `sessionPersistence` (localStorage subscribe + restore, dedupes paths).
- Hooks: `useAutosave`, `useWatcherEvents`.
- Shell components: `Editor`, `OpenButtons` (multi-file + folder), `FileTree`, `TabBar`, `ConflictBanner`, `StatusBar`.
- Markdown rendering pipeline (Phase 8):
  - `src/lib/markdown/pipeline.ts` — `renderMarkdown(md): Promise<string>`. Pipeline: parse → GFM → math → rehype (allowDangerousHtml:true) → rehypeMermaidInline → rehypeRaw → rehypeKatex (throwOnError:false) → @shikijs/rehype (github-dark) → rehypeSanitize (custom schema whitelisting className/style + SVG tag set) → stringify.
  - `src/lib/markdown/mermaid-plugin.ts` — visits `pre > code.language-mermaid`, calls `mermaid.render`, replaces with `<div class="mermaid">{svg}</div>` or `<pre class="mermaid-error">` on failure.
  - `rehype-raw` re-parses raw nodes (mermaid SVG + raw HTML in source) into proper hast elements before sanitize sees them, so SVG flows through and `<script>` tags get stripped.
  - 5 pipeline tests: GFM tables, KaTeX, script-strip, Mermaid (mocked — jsdom lacks getBBox), Shiki inline-style assertions, malformed-math smoke.
  - Swapped `rehype-shiki@0.0.9` (CommonJS, abandoned, broke under unified 11) for `@shikijs/rehype@4`. Added `rehype-raw` and `@types/hast`.
- App composition: sidebar (OpenButtons + optional FileTree) | TabBar → ConflictBanner (when `active.conflict`) → Editor (flex-1) → StatusBar.
- Tauri capabilities: `core:default`, `core:window:allow-destroy`, `dialog:default`.
- 16 Rust tests, 32 TS tests (11 test files), `pnpm lint` clean, `cargo build` clean.

## In progress

None. Ready to resume at **Phase 9 — Preview window** (4 tasks: `safeReplaceChildren` helper, preview entry + component that calls `renderMarkdown` and pipes through the helper, "Open preview" wiring with 200ms sync debounce, orphan banner + tab-close closes preview). Phase 9 is also the natural moment to re-enable `csp` in `tauri.conf.json` since the preview window is the surface where rendered HTML actually hits the DOM.

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; `pub fn run()` lives in `lib.rs`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`".
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to cwd at test time, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored). Committed `src/lib/ipc/types.ts` is frozen with `bigint`. IPC wrappers mask with `as unknown as`.
- **Close flow uses `destroy()` not `close()`:** Rust `on_window_event` unconditionally prevents `CloseRequested`. Tauri 2 API is `getCurrentWindow()`. Needs `core:window:allow-destroy`.
- **Preview-window wiring is forward-looking:** `TabBar` `onClose` calls `invoke("window_close", { label })` if `previewWindowLabel` is set — Phase 9 introduces both. Inert in Phases 7–8.
- **WKWebView DevTools quirk:** Safari Web Inspector does NOT allow top-level `await`. Diagnostic snippets must use an async IIFE or `.then(...)` chain.
- **Session persistence:** localStorage key `evhan-md-editor:session`. Stores `{ paths, activePath }`. Subscribe writes on `useDocuments` change (deduped by serialized form). Restore silently drops files that fail `fsRead`. `openDocument` is now path-idempotent so concurrent opens (Strict Mode double-mount, repeated clicks) cannot create duplicate tabs.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — restore in Phase 9. Existing UI uses inline styles heavily and CodeMirror injects `<style>` tags dynamically, so the CSP needs `style-src 'self' 'unsafe-inline'` at minimum. Restoring CSP without that audit would break the editor.
- **Mermaid + jsdom:** mermaid is mocked in `pipeline.test.ts` because jsdom doesn't implement `getBBox` etc. Real-browser behavior must be smoke-tested manually in Phase 9.
- **Phase 5 deviations:** `getCurrentWindow` + `destroy()`.
- **Phase 6 deviations:** `useWatcherEvents(setWatcherOffline)` passes the stable setter directly.
- **Phase 7 deviations:** `FileTree` Node renders icon and name in separate `<span>`s; imports `DirEntry` from `./lib/ipc/commands`.
- **Phase 7.5 (added 2026-04-21):** OpenButtons + session restore. `openFile`'s dedupe reads `useDocuments.getState()` (live state).
- **Phase 8 deviations from PLAN.md:**
  - Swapped `rehype-shiki@0.0.9` for `@shikijs/rehype@4` (the old plugin was CommonJS using a removed shiki API). Test asserts inline color styles (the modern API's output) instead of a `class="shiki"` (old API's output).
  - Added `rehype-raw` between mermaid and sanitize. Plan didn't include it; without it, the SVG that mermaid injects as a raw node gets dropped by `rehype-sanitize` and the mermaid block ends up empty.
  - Added `@types/hast` for the `Plugin<[], Root>` cast on rehypeRaw (unified's chain types narrow as plugins stack and rehype-raw's overloads don't infer cleanly).
  - CSP re-enable deferred to Phase 9 (where the preview window is the first surface that actually displays rendered HTML to the DOM).

## Risks

- **Mermaid in WKWebView:** Mermaid's render path uses lots of layout APIs (getBBox, getComputedTextLength, canvas TextMetrics). It works in WebKit, but version-to-version regressions are possible. The `mermaid-error` fallback keeps a bad block from breaking the rest of the page.
- **Shiki bundle size:** `@shikijs/rehype` bundles language grammars and themes. Default config pulls a lot. Phase 13 perf pass should consider lazy-loading per-language grammars.

## Next milestone

Phase 9 — preview window (`safeReplaceChildren` + `Preview` route + open / sync / close wiring). Re-enable CSP. Then Phase 10 — Word-like formatting toolbar.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 9. Read this STATUS.md first.`
