# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0, 1, 2, 3, and 4 of PLAN.md complete. On `main` branch, HEAD at the Phase 4 shell commit.

- Git repo initialized, project moved to `/Users/peter/Documents/evhan-md-editor/` (old path is a symlink).
- Tauri 2 + Vite + React 18 + TypeScript scaffolded.
- Vitest + Playwright + GitHub Actions CI wired.
- Rust backend: `types.rs`, `fs.rs` (read / write / create / rename / list), `watcher.rs` (debounced `Changed` / `Lost` over `notify-debouncer-full`), `commands.rs` (6 `#[tauri::command]` wrappers). `lib.rs::run()` owns an mpsc channel that forwards watcher events to the webview as `file.changed` / `watcher.lost`, and intercepts main-window close with `prevent_close()` + `app.close-requested`. `main.rs` is still a thin shim.
- Frontend primitives (Phase 3):
  - `src/lib/ipc/{commands,events,index}.ts` — typed wrappers with `mtime_ms: number` at the boundary (`as unknown as` bridges ts-rs' `bigint` typing).
  - `src/lib/conflict.ts` — `decideOnExternalChange` → `ignore` / `silent-reload` / `conflict`.
  - `src/state/documents.ts` — Zustand `useDocuments` store with full document lifecycle.
- Frontend shell (Phase 4):
  - `src/components/Editor/` — CodeMirror 6 wrapper (markdown + one-dark + line numbers + history + search). Mount effect re-runs on `docId` / `readOnly` change; a second effect mirrors external `value` changes back into the view (needed for Phase 5 autosave and Phase 6 silent-reload).
  - `src/components/FolderPicker.tsx` — wraps `plugin-dialog` `open({ directory: true })`.
  - `src/App.tsx` — two-column shell: folder picker / flat .md file list on the left, Editor on the right. `openFile` dedupes by path, calls `fsRead` + `openDocument` + `watcherSubscribe`.
  - `src-tauri/capabilities/default.json` — added `dialog:default`, dropped `opener:default` (plugin is no longer initialized).
- 16 Rust tests green, 10 TS tests green (4 test files, incl. Editor render smoke test), `pnpm lint` clean.

## In progress

None. Ready to resume at **Phase 5 — Autosave + flush on close + confirmation** (3 tasks: `Preferences` + `useAutosave` hook, wiring autosave through `flushRef`, and the close-flow that handles `app.close-requested` with confirm-on-dirty).

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` with a pragmatic cadence — full three-subagent flow (implementer + spec review + code quality review) for tasks with real code or architectural touches; inline-by-controller for verbatim config / YAML / single-flag fixes.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; the Tauri `Builder` lives in `lib.rs::run()`. Treat "rewrite `main.rs`" as "update `lib.rs::run()`". See the Phase 1 preamble (commit `6141a6b`).
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` works, but ts-rs 8.1 resolves `export_to` relative to the test runner's cwd, so the fresh file lands at `src-tauri/src/lib/ipc/types.ts` (gitignored), not the committed `src/lib/ipc/types.ts` (frozen with `bigint`). IPC wrappers in `src/lib/ipc/commands.ts` mask this with clean local types + `as unknown as` cast. If Rust types change later, either manually sync the committed file from the stray or fix `export_to` resolution.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`"csp": null`** in `tauri.conf.json` — deferred hardening for Phase 8 when the markdown renderer lands.
- **Phase 2 deviations from PLAN.md:** `watcher_basic.rs` canonicalizes paths (macOS `/private/var` quirk); `watcher.rs` uses `use notify::Watcher as _;`; `lib.rs` dropped unused `tauri::Manager` and `tauri_plugin_opener` from the builder.
- **Phase 4 deviations from PLAN.md:**
  - `App.tsx` imports `DirEntry` via `./lib/ipc/commands` instead of `./lib/ipc/types`. Identical semantically (`DirEntry` has no `bigint` fields) but keeps all IPC typing funneled through the wrapper module.
  - Added `dialog:default` capability — the plan didn't call this out but Tauri 2 rejects plugin-dialog `open()` without it. Dropped `opener:default` since the plugin was removed from the builder in Phase 2.
- **Not verified in Phase 4 checkpoint:** `pnpm tauri dev` manual click-through (open folder → click .md → edit) was not driven by the controller in this session — opens a native window. Recommended to smoke-test before Phase 5 work touches the save path.

## Risks

See `SPEC.md` → Risks. No new runtime risks from Phase 4. CodeMirror 6 in jsdom passes the smoke render test; CM6's heavier features (measurement, scroll) may need a real browser at Playwright time in Phase 13.

## Next milestone

Phase 5 — `Preferences` + `useAutosave` (debounced save on change, flush on blur / tab switch / close), wiring autosave through `flushRef`, and the close flow that handles `app.close-requested` with confirm-on-dirty. Then Phase 6 — `useWatcherEvents` + `ConflictBanner` using `decideOnExternalChange`.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 5. Read this STATUS.md first.`
