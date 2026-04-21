# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–7 + Phase 7.5 (added mid-flight) of PLAN.md complete. On `main` branch, HEAD at the session-restore commit.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs`, `watcher.rs` (debounced), `commands.rs` (6 commands). `lib.rs::run()` owns mpsc → `file.changed` / `watcher.lost`, intercepts main-window close.
- Frontend primitives: typed IPC wrappers (`mtime_ms: number` coercion), `decideOnExternalChange`, `useDocuments`, `usePreferences`, `sessionPersistence` (localStorage subscribe + restore).
- Hooks: `useAutosave`, `useWatcherEvents`.
- Shell components: `Editor`, `OpenButtons` (replaces `FolderPicker`; multi-file open + folder open), `FileTree`, `TabBar`, `ConflictBanner`, `StatusBar`.
- App composition: sidebar (OpenButtons + optional FileTree) | TabBar → ConflictBanner (when `active.conflict`) → Editor (flex-1) → StatusBar.
- Session restore: on mount, read `evhan-md-editor:session` from localStorage and replay each path through `openFile`. Write-back is deduped on serialized form so per-keystroke content edits don't churn localStorage.
- Tauri capabilities: `core:default`, `core:window:allow-destroy`, `dialog:default`.
- 16 Rust tests, 24 TS tests (10 test files), `pnpm lint` clean, `cargo build` clean.

## In progress

None. Ready to resume at **Phase 8 — Markdown rendering pipeline** (4 tasks: base unified pipeline + DOMPurify sanitize, add Shiki for code highlighting, add Mermaid for diagrams, inline render-error smoke test). Phase 8 also re-enables `csp` in `tauri.conf.json`.

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; `pub fn run()` lives in `lib.rs`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`".
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to cwd at test time, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored). Committed `src/lib/ipc/types.ts` is frozen with `bigint`. IPC wrappers mask with `as unknown as`.
- **Close flow uses `destroy()` not `close()`:** Rust `on_window_event` unconditionally prevents `CloseRequested`. Tauri 2 API is `getCurrentWindow()`. Needs `core:window:allow-destroy`.
- **Preview-window wiring is forward-looking:** `TabBar` `onClose` calls `invoke("window_close", { label })` if `previewWindowLabel` is set — Phase 9 introduces both. Inert in Phases 7–8.
- **WKWebView DevTools quirk:** Safari Web Inspector does NOT allow top-level `await`. Diagnostic snippets must use an async IIFE or `.then(...)` chain.
- **Session persistence:** localStorage key `evhan-md-editor:session`. Stores `{ paths: string[], activePath: string | null }`. Writes go through `useDocuments.subscribe` with a serialized-string dedupe to avoid per-keystroke writes. Restore on mount silently drops files that fail `fsRead` (NotFound, NotUtf8, etc.).
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — Phase 8 re-enables this; restoring CSP must be paired with audit of any inline scripts/styles.
- **Phase 5 deviations:** used `getCurrentWindow` + `destroy()` (plan had `getCurrent` + `close()`).
- **Phase 6 deviations:** `useWatcherEvents(setWatcherOffline)` passes the stable setter directly.
- **Phase 7 deviations:** `FileTree` Node renders icon and name in separate `<span>`s (so `findByText("name")` works and the icon is `aria-hidden`); `FileTree` imports `DirEntry` from `./lib/ipc/commands` (clean barrel) instead of `./lib/ipc/types`.
- **Phase 7.5 (added 2026-04-21):** OpenButtons replaces FolderPicker; session restore via localStorage. See PLAN.md Phase 7.5 section. `openFile`'s dedupe now reads `useDocuments.getState()` so the restore loop sees live state (not the stale render-time closure).

## Risks

No new runtime risks. The session-restore loop is sequential by design (each `fsRead` + `watcherSubscribe` awaits before the next), which is fine for a small set of recently-open files but would feel slow if a user persisted hundreds. If that becomes a real complaint, parallelize with `Promise.allSettled` and order by persisted index when assembling tabs.

## Next milestone

Phase 8 — markdown rendering pipeline. Restores `csp` in `tauri.conf.json`. Then Phase 9 — preview window.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 8. Read this STATUS.md first.`
