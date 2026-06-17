# UI_ARCHITECTURE

Stack: **Tauri 2 + React 18 (WKWebView on macOS) + TypeScript frontend, Rust backend.** State via **Zustand**; editors are **Tiptap/ProseMirror** (WYSIWYG) and **CodeMirror 6** (Edit). This document describes how those pieces fit together.

## Window / scene composition
- **Single main window** (`com.yeogi.mdeditor`, label `"main"`). Inside it, a primary editor pane plus an **optional secondary pane** for a side-by-side or stacked split.
- **Separate preview windows** can be spawned per document via the `window_open_preview` command (`src/preview/Preview.tsx`), driven by `preview:content-update` events.
- Native macOS window chrome (traffic-light controls) + a native **menu bar** (`src-tauri/src/menu.rs`).

## Primary layout
A CSS-grid shell in `App.tsx` lays out columns left→right:

```
[ FolderPanel | ResizeHandle | TocPanel | ResizeHandle | editor area ]
```

- **FolderPanel** (`components/Sidebar`) — the file explorer (one or more folder roots, each a `FileTree`). Toggleable.
- **TocPanel** (`components/Sidebar` / `TOC`) — the outline of the active document, highlighting the section in view. Toggleable.
- **editor area** — hosts the primary `EditorPane` and, when split, the secondary one (grid columns for side-by-side, rows for stacked). Each `EditorPane` stacks: `TabBar` → `TopBar` → banners (`ConflictBanner`, `UpdateBanner`) → the editor surface (`WysiwygEditor` or `Editor`).
- A `StatusBar` runs along the bottom.

## State ownership
- **Document model — `state/documents.ts`** (`useDocuments`): the open buffers (content, `lastSavedContent`, `isDirty`, `savedMtime`, `encoding`, `saveState`, per-doc `autosaveEnabled`, `conflict`, `reloadEpoch`), plus the open folder roots. Owns all document lifecycle actions (`openDocument`, `setContent`, `markSaved`, `replaceContentFromDisk`, …).
- **Layout — `state/layout.ts`** (`useLayout`): panes (`primary` / optional `secondary`), each pane's `tabs` + `activeTabId` + `viewMode` (`"wysiwyg" | "edit"`), focused pane, split orientation. Owns tab open/close/reorder and pane splitting.
- **Preferences — `state/preferences.ts`** (`usePreferences`, persisted to `localStorage`): theme, autosave default + debounce, panel visibility + widths, recent files (MRU, capped 10), paste-cleanup toggle.
- **Editor state** lives inside each editor instance (ProseMirror doc + selection for Tiptap; `EditorState` for CodeMirror) — not in Zustand. The buffer's markdown string is the boundary between editor and store.
- **App-level orchestration** (open/save, dialogs, keyboard + menu dispatch, autosave wiring, theme application) lives in `App.tsx`.

## File I/O boundary
The **Rust backend owns the disk**; the frontend never touches `fs` directly.
- Reads/writes/list/rename/copy/delete go through the IPC layer (`src/lib/ipc/commands.ts` → `src-tauri/src/commands.rs` → `src-tauri/src/fs.rs`, plain `std::fs`).
- **Writes are atomic**: `fs::write` writes a temp sibling then `rename`s over the target.
- **Watching**: `src-tauri/src/watcher.rs` (`notify` + debouncer) watches every open document path and emits `file:changed` / `watcher:lost`; the frontend consumes them in `hooks/useWatcherEvents.ts` to drive the conflict banner.
- **Picking**: file/folder open + save dialogs use `@tauri-apps/plugin-dialog` (native NSOpenPanel/NSSavePanel).
- **External open**: a Finder/`open` file-open routes through `RunEvent::Opened` → emits `files-opened` → `App.tsx` opens each, and raises the window.

## Error boundary / crash handling
- **Save states** per document (`idle | saving | saved | failed`) surfaced in the `StatusBar`; failures keep the buffer dirty.
- **External-change reconciliation**: when the watcher reports a change to a *dirty* doc, the `ConflictBanner` offers Keep / Reload; a clean doc reloads silently in place (`replaceContentFromDisk`, caret preserved).
- **Crash recovery**: `state/sessionPersistence.ts` writes the open-tab list + dirty content to a session file on every change; on relaunch the session is restored.
- The macOS native close path is intentionally not intercepted — autosave + the `pagehide` flush (`state/flushRef.ts`) cover unsaved content.

## Command routing
- **Native menu bar** (`menu.rs`) is the primary command surface. It emits a `"menu"` event carrying the item id; `App.tsx` dispatches (~29 cases). The menu is rebuilt + swapped via the `sync_menu_state` command whenever recent-files / theme / paste-pref change.
- **Keyboard shortcuts** (handled in `App.tsx`): ⌘1–8 / ⌘9 tab navigation, ⌘E flips WYSIWYG⇄Edit, ⌘F find, ⌥⌘\ side-by-side split, ⇧⌥⌘\ stacked split, plus the standard menu accelerators.
- No command palette (not a current idiom).

## Undo / redo ownership
Per-editor, never app-level: **Tiptap StarterKit `history`** in WYSIWYG mode, **CodeMirror `history`** in Edit mode. Each pane/buffer has its own undo stack; ⌘Z/⇧⌘Z route to the focused editor.

## Dirty-state tracking and autosave rules
- `isDirty` is derived per document: `content !== lastSavedContent` (set in `documents.setContent`).
- **Autosave** (`hooks/useAutosave.ts`): enabled when the doc has a path, isn't read-only, and its `autosaveEnabled` is on (seeded from the global preference at open time, toggleable per-doc in the `TopBar`). Idle debounce defaults to 500 ms with a 2 s max-wait ceiling so continuous typing still flushes. A `pagehide` flush forces a final write on teardown.
- **Untitled buffers** (no path) don't autosave; the first save falls through to Save As, which assigns a path.

## Module map
```
src/
  App.tsx                 # app shell: grid layout, orchestration, menu/keyboard dispatch, autosave wiring
  main.tsx                # React entry
  state/                  # Zustand stores — the document/layout/preferences model + session persistence
    documents.ts  layout.ts  preferences.ts  sessionPersistence.ts  flushRef.ts
  components/
    Editor/               # CodeMirror 6 (Edit mode)
    WysiwygEditor/        # Tiptap/ProseMirror (WYSIWYG) + nodes/ (Mermaid, ResizableImage, …) + Toolbar
    PreviewPane/          # shared rendered-preview styles (preview-content.css)
    Lightbox/             # fullscreen zoom/pan viewer for images & diagrams
    EditorPane/  TabBar/  TopBar/  StatusBar/  Sidebar/  FileTree/  TOC/
    ConflictBanner/  UpdateBanner/  LinkTooltip/  Tutorial/  ConfirmDialog/
  hooks/                  # useAutosave, useWatcherEvents, useActiveHeading, useBacklinks, useUpdater
  lib/
    ipc/                  # typed wrappers over Tauri commands (the only path to the Rust backend)
    markdown/             # remark→rehype preview pipeline (+ mermaid plugin, wiki-links)
    themes.ts  toc.ts  slug.ts  exportHtml.ts  resolveWikiLink.ts  safeInsertHtml.ts  …
  preview/                # the standalone preview window entry + Preview.tsx
src-tauri/src/
  lib.rs                  # Tauri builder: plugins, menu, watcher thread, RunEvent::Opened
  commands.rs             # #[tauri::command] surface (fs_*, window_*, watcher_subscribe, *_welcome_file, …)
  fs.rs                   # std::fs implementation (atomic write, text sniff, recursive count/delete)
  watcher.rs              # notify-based file watching → file:changed / watcher:lost events
  menu.rs                 # native macOS menu bar (desktop-only)
  types.rs                # shared serde types (FsError, DirEntry, FileRead, …)
```

The boundaries to keep clean: **document model / file I/O** (`state/documents.ts` + `lib/ipc` + `src-tauri`), **editor view** (`components/Editor`, `components/WysiwygEditor`), **preview / rendering** (`lib/markdown`, `components/PreviewPane`, `preview/`), **chrome** (`components/Sidebar|TabBar|TopBar|StatusBar`, `menu.rs`), and **persistence** (`state/preferences.ts`, `state/sessionPersistence.ts`). File I/O and unsaved-state logic must not leak into presentation components.
