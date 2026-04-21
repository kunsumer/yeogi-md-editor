# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–6 of PLAN.md complete. On `main` branch, HEAD `564c4e1`.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs` (read / write / create / rename / list), `watcher.rs` (debounced over `notify-debouncer-full`), `commands.rs` (6 `#[tauri::command]` wrappers). `lib.rs::run()` owns an mpsc channel that emits `file.changed` / `watcher.lost` and intercepts main-window `CloseRequested` with `prevent_close()` + `app.close-requested`.
- Frontend primitives: typed IPC wrappers (with `mtime_ms: number` coercion), `decideOnExternalChange`, `useDocuments` store.
- Frontend shell: CodeMirror 6 `Editor`, `FolderPicker`, two-column App with flat .md list.
- Autosave + close flow (Phase 5): `usePreferences`, `useAutosave` (debounced, with `flush()`), `flushRef` bridge, `app.close-requested` handler with three branches.
- External-change handling (Phase 6):
  - `src/hooks/useWatcherEvents.ts` — subscribes to `file.changed` / `watcher.lost`; per-event, finds the doc by path and runs `decideOnExternalChange`. On `silent-reload` calls `fsRead` + `replaceContentFromDisk`; on `conflict` calls `setConflict`; on `ignore` does nothing (echoes of our own save).
  - `src/components/ConflictBanner/` — `role="alert"` warning strip with `Keep mine` / `Reload disk` / `Show diff` actions. Rendered above the editor when `active.conflict` is non-null.
  - `App.tsx` wires the banner's actions to `setConflict(null) + flush` (keep), `fsRead + replaceContentFromDisk` (reload), and a stub `console.log` (diff — post-v1). Editor lives inside a flex-1 container so the banner pushes it down rather than overlapping.
- 16 Rust tests, 14 TS tests, `pnpm lint` clean, `cargo build` clean.

## In progress

None. Ready to resume at **Phase 7 — Tabs, FileTree, StatusBar** (3 tasks: `TabBar` with close-x per tab, `FileTree` recursive component replacing the flat list, `StatusBar` showing cursor / save state / encoding).

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence — full three-subagent flow for real code / architecture; inline-by-controller for verbatim config / YAML / single-flag fixes.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; `pub fn run()` lives in `lib.rs`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`". See the Phase 1 preamble (commit `6141a6b`).
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to cwd at test time, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored). Committed `src/lib/ipc/types.ts` is frozen with `bigint`. IPC wrappers mask with `as unknown as`.
- **Close flow uses `destroy()` not `close()`:** Rust `on_window_event` unconditionally prevents `CloseRequested`, so `close()` from the webview loops. Tauri 2 API is `getCurrentWindow()`, not v1's `getCurrent`. Needs `core:window:allow-destroy` permission.
- **Tauri capabilities:** `core:default`, `core:window:allow-destroy`, `dialog:default`. Added as each task needed them — `core:default` does not bundle plugin-dialog permissions or window-write permissions.
- **WKWebView DevTools quirk:** Safari Web Inspector (Tauri's embedded inspector on macOS) does NOT allow top-level `await`. Diagnostic snippets shared with the user must be wrapped in an async IIFE or `.then(...)` chain.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — deferred hardening for Phase 8.
- **Phase 5 deviations:** used `getCurrentWindow` + `destroy()` (plan had `getCurrent` + `close()`); both necessary for Tauri 2 correctness.
- **Phase 6 deviations from PLAN.md:**
  - `useWatcherEvents(setWatcherOffline)` passes the stable `useState` setter directly instead of wrapping in `(r) => setWatcherOffline(r)`. Wrapping creates a new callback identity every render, which would resubscribe the watcher listeners constantly with a race window where events could be dropped.
  - Editor was wrapped in a `flex: 1` container so the conflict banner sits above it cleanly — layout tweak, no behavior change.
  - `watcherOffline` state is currently destructured as `[, setWatcherOffline]`; the stored reason is captured but not yet surfaced in UI. That UI lands in Phase 13 (watcher-offline retry) per the plan.

## Risks

No new runtime risks from Phase 6. The `decideOnExternalChange` function is symmetric on `diskMtime === savedMtime` (ignores), so Rust's own-write echoes (where `fsWrite` sets mtime to the write moment and the watcher re-fires with the same mtime) are suppressed correctly. If we ever see spurious "silent-reload" flashes after saves, revisit whether Rust's `fsWrite` returns a mtime that exactly matches the watcher's subsequent report.

## Next milestone

Phase 7 — `TabBar`, `FileTree`, `StatusBar`. Then Phase 8 — markdown rendering pipeline.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 7. Read this STATUS.md first.`
