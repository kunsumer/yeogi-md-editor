# STATUS — macOS Markdown Editor (v1)

## Current state

Phases 0, 1, 2, and 3 of PLAN.md complete. On `main` branch, HEAD `7285d94`.

- Git repo initialized, project moved to `/Users/peter/Documents/evhan-md-editor/` (old path is a symlink).
- Tauri 2 + Vite + React 18 + TypeScript scaffolded.
- Vitest + Playwright + GitHub Actions CI wired.
- Rust backend: `types.rs`, `fs.rs` (read / write / create / rename / list), `watcher.rs` (debounced `Changed` / `Lost` over `notify-debouncer-full`), `commands.rs` (6 `#[tauri::command]` wrappers). `lib.rs::run()` owns an mpsc channel that forwards watcher events to the webview as `file.changed` / `watcher.lost`, and intercepts main-window close with `prevent_close()` + `app.close-requested`. `main.rs` is still a thin shim.
- Frontend primitives (Phase 3):
  - `src/lib/ipc/commands.ts` — typed `fsRead` / `fsWrite` / `fsCreate` / `fsRename` / `fsList` / `watcherSubscribe` wrappers. Clean `FileRead` / `FileWritten` interfaces defined locally with `mtime_ms: number`; the `as unknown as` cast bridges ts-rs' `bigint` typing (runtime wire value is already a JSON number).
  - `src/lib/ipc/events.ts` — `onFileChanged` / `onWatcherLost` listeners with clean `FileChanged` type.
  - `src/lib/ipc/index.ts` — barrel re-exporting commands + events.
  - `src/lib/conflict.ts` — `decideOnExternalChange` pure function: `ignore` / `silent-reload` / `conflict` decision from `(diskMtime, savedMtime, isDirty)`.
  - `src/state/documents.ts` — Zustand `useDocuments` store: documents[] + activeId, `openDocument` / `closeDocument` / `setContent` / `markSaved` / `markSaveFailed` / `replaceContentFromDisk` / `setConflict` / `setPreviewWindowLabel`. `isDirty` is derived from `content !== lastSavedContent` inside `setContent`.
- 16 Rust tests green (`cargo test`): 10 fs integration + 5 ts-rs export-bindings + 1 watcher integration.
- 9 TS tests green (`pnpm test`): 2 IPC wrappers + 4 conflict + 3 documents store.
- `pnpm lint` (`tsc --noEmit`) clean.

## In progress

None. Ready to resume at **Phase 4 — CodeMirror editor + minimum open/edit loop** (2 tasks: `Editor.tsx` component wrapping CM6 with markdown lang + one-dark theme + `onChange` callback, and the minimum shell wiring open/save buttons, Cmd-S, and the editor together through `useDocuments`).

## Decisions carried forward (read before resuming)

- **Execution mode:** `superpowers:subagent-driven-development` with a pragmatic cadence — full three-subagent flow (implementer + spec review + code quality review) for tasks with real code or architectural touches; inline-by-controller for verbatim config / YAML / single-flag fixes.
- **Architecture override to PLAN.md:** `main.rs` stays a thin caller; the Tauri `Builder` lives in `lib.rs::run()`. All plan text that says "rewrite `main.rs`" means "update `lib.rs::run()`". See the Phase 1 preamble added in commit `6141a6b`.
- **ts-rs 8.1 export path quirk:** `#[ts(type = "number")]` on `mtime_ms` works correctly (the generated output has `mtime_ms: number`), BUT ts-rs 8.1 resolves `export_to = "../src/lib/ipc/types.ts"` relative to the test runner's cwd, so it writes to `src-tauri/src/lib/ipc/types.ts` (gitignored via `src-tauri/src/lib/`), not the committed `src/lib/ipc/types.ts`. The committed file is frozen with `mtime_ms: bigint` from the first generation in commit `4ee8d70`. Phase 3 wrappers defend against this by defining clean types locally and casting `as unknown as FileRead / FileWritten`. If Rust types change later, either manually sync the committed file from the stray, or fix the `export_to` resolution.
- **`@types/react` / `@types/react-dom`** pinned to `^18` to match runtime.
- **`vitest run --passWithNoTests`** — was required when no TS tests existed; now that tests exist, the flag is harmless but no longer load-bearing.
- **`"csp": null`** in `tauri.conf.json` — deferred hardening for Phase 8 when the markdown renderer lands.
- **Phase 2 deviations from PLAN.md** (all documented in the Phase 2 completion commits):
  - `watcher_basic.rs` canonicalizes both sides of the path compare — macOS FSEvents emits `/private/var/...` while `TempDir` returns `/var/...`.
  - `watcher.rs` includes `use notify::Watcher as _;` — the trait provides `.watch()` on the debouncer's inner watcher; aliased to `_` to avoid name clash with our `Watcher` struct.
  - `lib.rs` dropped `tauri::Manager` (unused in Tauri 2) and `.plugin(tauri_plugin_opener::init())` (per plan's prescribed `run()` body; dep still in Cargo.toml).

## Risks

See `SPEC.md` → Risks. No new runtime risks from Phase 3. The ts-rs committed/stray mismatch is a development-ergonomics wart, not a correctness risk — the wrappers mask it.

## Next milestone

Phase 4 — CodeMirror editor component and the minimum shell that wires open/save through `useDocuments`. Then Phase 5 — autosave + flush on close + confirmation.

## How to resume

In a new Claude Code session at `/Users/peter/Documents/evhan-md-editor/`, say: `Resume the implementation plan at docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md. We're at Phase 4. Read this STATUS.md first.`
