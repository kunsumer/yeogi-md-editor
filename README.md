# Yeogi .MD Editor

[![License: MIT](https://img.shields.io/github/license/kunsumer/yeogi-md-editor?color=blue)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/kunsumer/yeogi-md-editor?label=release&color=f7323f)](https://github.com/kunsumer/yeogi-md-editor/releases/latest)
[![Build status](https://img.shields.io/github/actions/workflow/status/kunsumer/yeogi-md-editor/release.yml?label=build)](https://github.com/kunsumer/yeogi-md-editor/actions/workflows/release.yml)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)](https://kunsumer.github.io/yeogi-md-editor/)
[![Downloads](https://img.shields.io/github/downloads/kunsumer/yeogi-md-editor/total)](https://github.com/kunsumer/yeogi-md-editor/releases)

**A free WYSIWYG Markdown editor for macOS.** WYSIWYG editing, side-by-side panes, a real folder tree, drag-reorder tabs, and right-click context menus that actually do work. Code-signed, notarized, and auto-updating.

**Landing page:** <https://kunsumer.github.io/yeogi-md-editor/>
**Download:** [Latest release](https://github.com/kunsumer/yeogi-md-editor/releases/latest) — universal `.dmg` (Apple Silicon + Intel)

---

## What it is

A focused, native-feeling macOS Markdown editor built on Tauri 2 — small bundle, fast launch, no Electron. The goal is to do the seven or eight things you actually want in a Markdown editor really well, and nothing else.

- **Real WYSIWYG editing.** Edit the rendered view directly — not a preview pane, not a split-screen compromise. ⌘E flips the same buffer to a CodeMirror source view when you want to see the raw markdown.
- **Side-by-side panes.** Open two documents next to each other in one window. ⌘\\ splits, ⌘W on a pane closes it.
- **Real folder tree.** Open any folder on disk as your workspace. Up to five folders open at once. Right-click to create / rename / delete / reveal in Finder. Drag files between folders. Extensionless text files (`.env`, `Dockerfile`, `Makefile`, `LICENSE`, `Procfile`, …) show too.
- **Tabs, with the ergonomics you'd expect.** Drag to reorder, ⌘T for a new tab, ⌘W to close, middle-click to close, ⌘⇧T to reopen, "+" button at the end of the strip.
- **Outline / Table of Contents.** Jump to any heading; the row you're currently reading is highlighted as you scroll.
- **Wiki-links.** `[[Page Name]]` resolves against your folder. `[[Page Name#Heading]]` jumps to a specific section. Backlinks panel shows incoming references.
- **Math + Mermaid + GFM tables + footnotes + task lists** — all the GitHub flavors, plus KaTeX-rendered `$math$` and full Mermaid diagrams.
- **Per-document autosave** with a debounce, plus crash recovery: if the app dies with dirty buffers, you get them back on relaunch.
- **External-change reconciliation.** If a file you have open changes on disk, you get a banner with "Keep mine / Reload from disk" instead of a silent overwrite.
- **Apple-notarized auto-updater.** Tauri's signature-verified updater channel; new releases just appear and install on your next launch.

## Install

Download the latest universal `.dmg` from the [releases page](https://github.com/kunsumer/yeogi-md-editor/releases/latest), drag the app into `/Applications`, and double-click. Because the binaries are signed with an Apple Developer ID and notarized, Gatekeeper lets you launch without the "unidentified developer" warning.

Once installed, the app updates itself — no need to come back here for newer versions.

**System requirements:** macOS 10.13 or later. Apple Silicon and Intel both supported (universal binary).

## Screenshots

The [landing page](https://kunsumer.github.io/yeogi-md-editor/) has a fuller carousel with a click-to-enlarge lightbox. A few highlights live in [`site/screenshots/`](site/screenshots/):

- [`00-side-by-side.png`](site/screenshots/00-side-by-side.png) — two documents open in one window
- [`02-right-click-menu.png`](site/screenshots/02-right-click-menu.png) — file-tree context menu
- [`03-tabs.png`](site/screenshots/03-tabs.png) — drag-reorder tabs
- [`04-math-mermaid.png`](site/screenshots/04-math-mermaid.png) — KaTeX + Mermaid

## Tech stack

- **Tauri 2** — Rust backend, native WKWebView frontend on macOS. Small binaries, no Electron.
- **React 18** + **TypeScript** + **Zustand** for the UI and state.
- **Tiptap** (ProseMirror) for the WYSIWYG editor, **CodeMirror 6** for the source-mode editor. ⌘E flips between them on the same buffer.
- **remark / rehype** pipeline for the rendering side (GFM + math + Mermaid + Shiki syntax highlighting).
- **notify** + **notify-debouncer-full** on the Rust side watching every open document for external changes.

## Building from source

```bash
pnpm install --frozen-lockfile
pnpm tauri dev          # run the app locally
pnpm tsc --noEmit       # typecheck
pnpm vitest run         # unit tests
```

A release build is a single command (it produces a universal `.dmg` + signed updater tarball):

```bash
pnpm release:build
```

Without signing env vars present it falls through to an ad-hoc-signed bundle, useful for local testing.

## Project layout

- `src/` — React frontend (editor, document model, file-tree, outline, …)
- `src-tauri/` — Rust backend (file I/O, watchers, IPC commands, build config)
- `docs/claude-code/` — operating contract, UI architecture, UX states, performance budgets, governance — the spec the codebase is built against
- `docs/releasing.md` — the full release walkthrough (keys, secrets, notarization, troubleshooting)
- `site/` — the GitHub Pages landing page
- `CHANGELOG.md` — user-visible changes per release

## Releasing

Releases are tag-driven: pushing a `v*` tag (e.g. `v0.4.15`) triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds the universal bundle on a `macos-latest` runner, code-signs with the Apple Developer ID identity, submits the `.app` to Apple's `notarytool` service, staples the ticket, and attaches the `.dmg` + `.app.tar.gz` + `.sig` + `latest.json` to a new GitHub Release.

Full walkthrough — required secrets, key generation, manifest template, troubleshooting — lives at [`docs/releasing.md`](docs/releasing.md).

For local dev releases:

```bash
pnpm release:keygen     # first-time setup; generates ~/.tauri/yeogi-update.key
pnpm release:steps      # prints the version-bump + signing checklist
pnpm release:build      # produces a universal (arm64 + Intel) .dmg + .app.tar.gz + .sig
```

## Contributing

This is a small project with an opinionated direction (see `docs/claude-code/PROJECT_PROFILE.md`), but PRs and issues are welcome. Before submitting a behavior change:

1. Open an issue first if it's user-visible — happy to discuss scope before code lands.
2. Run `pnpm tsc --noEmit` and `pnpm vitest run` locally; both should pass.
3. Touch the spec under `docs/claude-code/specs/` if you're materially changing user-facing behavior.

## Credits

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [Tiptap](https://tiptap.dev/), [CodeMirror](https://codemirror.net/), [remark](https://remark.js.org/) / [rehype](https://github.com/rehypejs/rehype), [Shiki](https://shiki.style/), [Mermaid](https://mermaid.js.org/), and [KaTeX](https://katex.org/).
