# PROJECT_PROFILE

## App name
Yeogi .MD Editor

## Target
- platform: macOS
- minimum OS version: 10.13 (`LSMinimumSystemVersion`); universal binary (x86_64 + arm64)
- distribution: direct download from GitHub Releases, signed with an Apple Developer ID identity ("Developer ID Application: Kun Soo Han"), notarized + stapled in CI, Tauri-updater verified via minisign. Gatekeeper accepts first launch without a warning.

## What this repo owns
- windows / scenes: single main window with a primary + optional secondary editor pane (side-by-side); separate preview windows can be spawned per document via `window_open_preview`
- file access scope: NSOpenPanel / NSSavePanel for user-picked files and folders; once a folder is open, descendants are read via `std::fs` directly. macOS TCC gates Documents/Downloads/Desktop access (custom usage descriptions in `src-tauri/Info.plist`).
- file watching: yes — `notify` + `notify-debouncer-full` watch every open document path; events forwarded to the webview as `file:changed` / `watcher:lost` for conflict-banner UX
- markdown parser: `tiptap-markdown` (parses to ProseMirror schema for WYSIWYG); `remark-parse` + `remark-gfm` + `remark-math` (renders to HTML for the Preview / Export pipelines)
- syntax highlighting: Shiki via `@shikijs/rehype` for the rendered pipeline; `lowlight` for in-WYSIWYG code blocks
- preview renderer: `remark` → `rehype` chain (rehype-katex + rehype-raw + rehype-mermaid + rehype-stringify), dynamic-imported on first use to keep the main bundle small

## Stack
- language: TypeScript (frontend) + Rust (Tauri backend)
- UI framework: Tauri 2 + React 18 (WKWebView on macOS)
- editor component: Tiptap (WYSIWYG mode) + CodeMirror 6 (Edit mode); ⌘E flips between them on the same buffer
- state / data library: Zustand (separate stores: `documents`, `layout`, `preferences`)
- test framework: Vitest 4
- UI / integration test framework: `@testing-library/react` for component tests; Playwright is installed but only used ad-hoc
- lint / formatter: `tsc --noEmit` (no ESLint/Prettier wired up)
- build / packaging tool: `tauri build --target universal-apple-darwin`; release flow in `scripts/release-build.sh` + `.github/workflows/release.yml`

## Real commands
- install: `pnpm install --frozen-lockfile`
- dev (run app locally): `pnpm tauri dev`
- build (release / .app bundle): `pnpm release:build` (signs with the Developer ID identity if present in keychain, else ad-hoc with a printed warning)
- lint: `pnpm tsc --noEmit`  (alias: `pnpm lint`)
- typecheck: `pnpm tsc --noEmit`
- unit test: `pnpm vitest run` (or `pnpm test`)
- integration / UI test: `pnpm test:e2e` (Playwright; rarely run, treat as best-effort)
- sign / notarize: signing happens in `release-build.sh` (Developer ID cert). Notarization runs automatically in the CI release workflow (`release.yml`) via the `APPLE_ID` / `APPLE_TEAM_ID` / `APPLE_APP_SPECIFIC_PASSWORD` secrets — Tauri submits to notarytool, waits for the verdict, and staples the ticket. Known failure mode: Apple returns **403 "A required agreement is missing or has expired"** when the Developer Program License Agreement has been updated (or membership lapsed) — the Account Holder must accept it at developer.apple.com/account, then `gh run rerun <run-id> --failed`. (Hit on v0.5.7, 2026-07-22.)

## Risk zones
- file I/O and unsaved changes: autosave is per-document with a debounce (default 800 ms); flush hooks run on `pagehide`. Conflict banner appears when watcher detects external changes to a dirty doc; close/quit prompts unsaved-changes confirmation. Untitled buffers fall through to Save As on first ⌘S.
- destructive actions (delete / overwrite / move): Delete in file-tree right-click pre-counts descendants and shows a `tone="danger"` ConfirmDialog before calling `fs_delete` (recursive `remove_dir_all`). All deletions are permanent (no Trash integration). Reload-from-disk on a dirty doc drops unsaved edits without prompting (the click is the consent).
- sandbox / entitlements: app is unsandboxed. Custom Info.plist with `NS{Documents,Downloads,Desktop}FolderUsageDescription` for friendlier TCC prompts. Not on the App Store.
- large-file handling: WYSIWYG (Tiptap) starts to lag noticeably past ~50 KB on syntax-highlighting-heavy content. Edit mode (CodeMirror) handles much larger files. No streaming / virtualized rendering today.
- accessibility: keyboard shortcuts cover most actions; native menu bar + ARIA on custom widgets (toolbar buttons, dialog `role="dialog"`, alert `role="alert"`); VoiceOver pass not formally audited.
- crash on unsaved state: in-memory documents are written to a session-persistence file every change so a crash recovers the open tab list + dirty content on relaunch.
