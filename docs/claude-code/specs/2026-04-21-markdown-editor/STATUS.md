# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–5 of PLAN.md complete. On `main` branch, HEAD `75fae20`.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs` (read / write / create / rename / list), `watcher.rs` (debounced over `notify-debouncer-full`), `commands.rs` (6 `#[tauri::command]` wrappers). `lib.rs::run()` owns an mpsc channel that emits `file.changed` / `watcher.lost` to the webview and intercepts main-window `CloseRequested` with `prevent_close()` + `app.close-requested`.
- Frontend primitives: typed IPC wrappers with `mtime_ms: number` coercion, `decideOnExternalChange` pure function, `useDocuments` Zustand store (documents + activeId + per-doc saveState).
- Frontend shell: CodeMirror 6 `Editor`, `FolderPicker`, two-column App with flat .md list + editor pane.
- Autosave + close flow (Phase 5):
  - `src/state/preferences.ts` — `usePreferences` Zustand store (`autosaveEnabled` default true, `autosaveDebounceMs` 2000).
  - `src/hooks/useAutosave.ts` — debounced saver + `flush()`. Ref-latched so the timer always persists the newest content. 3 unit tests.
  - `src/state/flushRef.ts` — module-scoped bridge so the close listener can flush without React plumbing.
  - `App.tsx` — `useAutosave` fed with `fsWrite`, transitions `markSaveStarted → markSaved / markSaveFailed`. `app.close-requested` listener with three branches: flush + destroy (autosave on), destroy (clean), confirm + destroy (dirty, autosave off).
  - `src-tauri/capabilities/default.json` — added `core:window:allow-destroy`.
- 16 Rust tests, 13 TS tests, `pnpm lint` clean, `cargo build` clean.

## In progress

None. Ready to resume at **Phase 6 — External change: silent reload + conflict banner** (2 tasks: `useWatcherEvents` hook that listens for `file.changed`, calls `decideOnExternalChange`, and either silently reloads via `replaceContentFromDisk` or sets a `conflict` on the document; and `ConflictBanner` component that offers "reload from disk" / "keep my changes" actions).

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence — full three-subagent flow for real code or architectural touches; inline-by-controller for verbatim config / YAML / single-flag fixes.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; the Tauri `Builder` lives in `lib.rs::run()`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`". See the Phase 1 preamble (commit `6141a6b`).
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to the test runner's cwd, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored). The committed `src/lib/ipc/types.ts` is frozen with `bigint`. IPC wrappers mask this with `as unknown as` casts.
- **Close flow uses `destroy()` not `close()`:** the Rust `on_window_event` handler unconditionally prevents `CloseRequested`. Calling `window.close()` from the webview would loop; `window.destroy()` skips the `CloseRequested` event entirely. Tauri 2's API is `getCurrentWindow()`, not v1's `getCurrent`. Required the `core:window:allow-destroy` permission.
- **Tauri capabilities** so far: `core:default`, `core:window:allow-destroy`, `dialog:default`. Added as each task needed them; `core:default` does not bundle window-write or plugin-dialog permissions.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — deferred hardening for Phase 8 when the markdown renderer lands.
- **Phase 5 deviations from PLAN.md:**
  - Plan imported `getCurrent` from `@tauri-apps/api/window`; the Tauri 2 API is `getCurrentWindow`. Used that.
  - Plan called `window.close()` in the close handler; replaced with `window.destroy()` to avoid re-triggering `CloseRequested`. Documented in the commit message and above.

## Risks

No new runtime risks from Phase 5. The `useAutosave` effect re-runs on every `save` identity change; in practice `save` only changes when `active` changes, but if a future refactor renders App more aggressively, consider wrapping `save` in `useCallback` with explicit deps to prevent debounce resets on unrelated renders.

## Next milestone

Phase 6 — `useWatcherEvents` + `ConflictBanner`. Then Phase 7 — Tabs, FileTree, StatusBar.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 6. Read this STATUS.md first.`
