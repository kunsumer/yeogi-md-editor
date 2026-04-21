# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0–7 of PLAN.md complete. On `main` branch, HEAD `de652ef`.

- Tauri 2 + Vite + React 18 + TypeScript + Vitest + Playwright + GitHub Actions CI.
- Rust backend: `types.rs`, `fs.rs` (read / write / create / rename / list), `watcher.rs` (debounced over `notify-debouncer-full`), `commands.rs` (6 `#[tauri::command]` wrappers). `lib.rs::run()` owns an mpsc channel that emits `file.changed` / `watcher.lost` and intercepts main-window `CloseRequested` with `prevent_close()` + `app.close-requested`.
- Frontend primitives: typed IPC wrappers (with `mtime_ms: number` coercion), `decideOnExternalChange`, `useDocuments` store, `usePreferences` store.
- Hooks: `useAutosave` (debounced + `flush()`), `useWatcherEvents` (`file.changed`/`watcher.lost` → `decideOnExternalChange` → `replaceContentFromDisk` or `setConflict`).
- Shell components:
  - `Editor` — CodeMirror 6 (markdown + one-dark + history + search).
  - `FolderPicker` — opens directory dialog.
  - `FileTree` — recursive lazy-expand sidebar, replaced the temporary flat list.
  - `TabBar` — `role=tab` per doc, dirty dot, close button + middle-click close.
  - `ConflictBanner` — `role=alert` warning strip with Keep/Reload/Show diff.
  - `StatusBar` — dirty bullet (aria-label "unsaved changes"), save-state label, word count, watcher-offline warning.
- App composition: TabBar → ConflictBanner (when `active.conflict`) → Editor (in flex-1 container) → StatusBar.
- Tauri capabilities: `core:default`, `core:window:allow-destroy`, `dialog:default`.
- 16 Rust tests, 20 TS tests (9 test files), `pnpm lint` clean, `cargo build` clean.

## In progress

None. Ready to resume at **Phase 8 — Markdown rendering pipeline** (4 tasks: base unified pipeline + DOMPurify sanitize, add Shiki for code highlighting, add Mermaid for diagrams, inline render-error smoke test). Phase 8 also re-enables `csp` in `tauri.conf.json` per the doc.

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` pragmatic cadence — full three-subagent flow for real code / architecture; inline-by-controller for verbatim config / YAML / single-flag fixes.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; `pub fn run()` lives in `lib.rs`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`". See the Phase 1 preamble (commit `6141a6b`).
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to cwd at test time, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored). Committed `src/lib/ipc/types.ts` is frozen with `bigint`. IPC wrappers mask with `as unknown as`.
- **Close flow uses `destroy()` not `close()`:** Rust `on_window_event` unconditionally prevents `CloseRequested`, so `close()` from the webview loops. Tauri 2 API is `getCurrentWindow()`, not v1's `getCurrent`. Needs `core:window:allow-destroy` permission.
- **Preview-window wiring is forward-looking:** `TabBar` `onClose` calls `invoke("window_close", { label })` if `previewWindowLabel` is set. No code currently sets `previewWindowLabel` and the `window_close` Tauri command does not yet exist — Phase 9 adds both. The branch is inert in Phases 7–8.
- **WKWebView DevTools quirk:** Safari Web Inspector (Tauri's embedded inspector on macOS) does NOT allow top-level `await`. Diagnostic snippets must use an async IIFE or `.then(...)` chain.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — Phase 8 re-enables this; restoring CSP must be paired with audit of any inline scripts/styles.
- **Phase 5 deviations:** used `getCurrentWindow` + `destroy()` (plan had `getCurrent` + `close()`).
- **Phase 6 deviations:** `useWatcherEvents(setWatcherOffline)` passes the stable setter directly.
- **Phase 7 deviations from PLAN.md:**
  - `FileTree` Node renders `<span aria-hidden>icon</span> <span>name</span>` instead of `"📁 name"` in one text node. The plan's tests use exact-text matchers (`findByText("sub")`, `findByText("a.md")`) which fail on a combined text node. Splitting into two spans makes the name its own text node; also better for screen readers since the icon is decorative.
  - `FileTree` imports `DirEntry` from `./lib/ipc/commands` instead of `./lib/ipc/types`. Identical semantically (`DirEntry` has no `bigint` fields), but keeps IPC typing funneled through the wrapper module.
  - "No file open" placeholder gained `flex: 1` so the StatusBar still pins to the bottom when nothing is selected.

## Risks

No new runtime risks from Phase 7. The `documents.map` in TabBar runs on every render; for v1 this is fine, but if the tab count grows large the mapped array allocation per render becomes a candidate for memoization.

## Next milestone

Phase 8 — markdown rendering pipeline (unified + remark + rehype + sanitize, then Shiki, then Mermaid, then error smoke test). Restores `csp` in `tauri.conf.json`. Then Phase 9 — preview window.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 8. Read this STATUS.md first.`
