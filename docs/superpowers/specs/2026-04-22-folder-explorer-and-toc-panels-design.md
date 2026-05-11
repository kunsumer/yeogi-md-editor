# Folder Explorer + Outline panels — design

**Status:** approved, pending implementation plan
**Date:** 2026-04-22
**Scope:** frontend layout, preference + session persistence, menu changes, small Rust menu reshape

## 1. Goal

Let the user open a folder and navigate its files in a tree-like explorer panel that sits to the left of the editor, with an independent outline (TOC) panel to its right, each one independently togglable through the View menu and keyboard shortcuts. Widths are draggable and persist across relaunches. The last-picked folder is remembered across relaunches.

## 2. Layout

Three-column left-stack. Only columns that are *currently visible* contribute to the grid; hidden panels are unmounted (not just `display: none`) so keyboard focus and screen-reader traversal can't land in invisible controls.

```
┌──────────────────────────────────────────────────────────────────────┐
│ TabBar                                                               │
├───────────┬───┬─────────┬───┬──────────────────────────────────────────┤
│ Folder    │ = │ Outline │ = │ TopBar                                 │
│ Explorer  │   │ (TOC)   │   ├──────────────────────────────────────────┤
│           │   │         │   │ Editor (WYSIWYG or Edit) + UpdateBanner│
│           │   │         │   ├──────────────────────────────────────────┤
│           │   │         │   │ StatusBar                              │
└───────────┴───┴─────────┴───┴──────────────────────────────────────────┘
```

`=` are 4-px-wide draggable dividers.

The outer shell is a CSS grid on the existing `bodyStyle` element. `gridTemplateColumns` is computed from visibility + width state:

```ts
const template = [
  showFolder ? `${folderWidth}px` : null,
  showFolder ? "4px" : null,
  showToc    ? `${tocWidth}px`    : null,
  showToc    ? "4px" : null,
  "minmax(320px, 1fr)",
].filter(Boolean).join(" ");
```

`showFolder` and `showToc` combine the user's preference with an intelligent default:

```
showFolder = folderVisible && folder != null
showToc    = tocVisible && active != null
```

The View-menu toggles flip the raw preference; surfaces that don't have content show empty-state placeholders rather than collapsing silently, so turning a panel on with no data gives the user a prompt to act on.

## 3. State + persistence

Four new preferences and one new session field.

| Field              | Type            | Default | Store               |
|--------------------|-----------------|---------|---------------------|
| `folderVisible`    | `boolean`       | `true`  | `usePreferences`    |
| `tocVisible`       | `boolean`       | `true`  | `usePreferences`    |
| `folderWidth`      | `number` (px)   | `260`   | `usePreferences`    |
| `tocWidth`         | `number` (px)   | `220`   | `usePreferences`    |
| `folder`           | `string \| null`| `null`  | `sessionPersistence`|

All widths clamp to `[180, 480]`.

Preferences already persist through localStorage via the existing preferences wiring. `sessionPersistence` currently stores `{ paths, activePath }`; we extend it to `{ paths, activePath, folder }`. The loader stays synchronous — it just reads localStorage. Folder-existence is checked **lazily** in an `App.tsx` `useEffect` after mount: if `fsStat(folder)` rejects or the path is gone, call `setFolder(null)`. Keeping the check out of the startup-critical path avoids an async rewrite of the session loader.

While a divider is being dragged, width state updates every `pointermove`. The localStorage flush is debounced 250 ms so we don't thrash disk during the drag.

## 4. Components

All new components live under `src/components/Sidebar/`.

### `AsidePanel`

Shared chrome: fixed-width rounded container, header bar with a title + optional right-aligned action slot, scrollable body. Both panels use it so their visual treatment is identical.

```tsx
<AsidePanel title="Folder" action={<ChooseFolderButton />}>
  <FileTree root={folder} onOpenFile={…} />
</AsidePanel>
```

### `FolderPanel`

Orchestrates the empty / loading / loaded / missing states around the existing `FileTree`. Owns the "Choose folder…" button. Calls `pickAndOpenFolder()` (already in App.tsx) on click.

States:
- `folder == null` → centered muted text `No folder open.` + primary button `Choose folder…`.
- `folder != null` → header shows the folder basename, body renders `FileTree`.

### `TocPanel`

Wraps the existing `TOC` component with panel chrome. States:
- No document open → muted text `No document open.`
- Document has no headings → muted text `No headings.`
- Otherwise → the existing heading list (forwards `onJump`).

### `ResizeHandle`

4-px-wide `<div role="separator" aria-orientation="vertical" tabIndex={0}>` between columns. Pointer handlers:

```ts
onPointerDown: capture; record startX, startWidth; add pointermove + pointerup on window
onPointerMove(e): new = clamp(startWidth + (e.clientX - startX), 180, 480); onChange(new)
onPointerUp:   release; remove window listeners
```

Keyboard:
- `ArrowLeft` / `ArrowRight` → ±16 px (within clamp)
- `Home` → 180
- `End` → 480

## 5. View menu + shortcuts

Replaces today's "Toggle Sidebar" single item.

```
View
  ✓ Folder Explorer             ⌥⌘1
  ✓ Outline                     ⌥⌘2
    Hide Both Sidebars          ⌘\
    ─────────────────────
    Cycle Theme                 ⌘T
    ─────────────────────
    Zoom In                     ⌘=
    Zoom Out                    ⌘−
    Reset Zoom                  ⌘0
```

- **⌥⌘1** (`view:toggle-folder-panel`) flips `folderVisible`.
- **⌥⌘2** (`view:toggle-toc-panel`) flips `tocVisible`.
- **⌘\\** (`view:hide-all-sidebars`) — if either is on, set both off. If both are off, restore their last-on state (stored in a small ref so the toggle has memory).

Menu check-marks mirror the preference booleans. The Tauri `MenuItemBuilder::checked(…).build()` is set at `build_menu` time; we rebuild the menu when either pref flips (existing precedent: menu is rebuilt only once, but this is the simplest path to keep checkmarks truthful — an alternative is `item.set_checked(true)` via retained item handles if rebuild feels heavy).

**File menu** gains one item:

```
File
  …
  Close Folder                      (disabled when folder == null)
```

`file:close-folder` clears `folder` in session. `folderVisible` is preserved, so the next folder pick renders immediately.

**Tutorial shortcuts slide** adds two rows:

```
⌥⌘1    Folder Explorer
⌥⌘2    Outline
```

## 6. Edge cases

- **Folder deleted externally at startup** → drop the stored path silently; empty state renders. No toast.
- **Folder deleted while the app is running** → the existing `fsList` calls will start erroring. Out of scope for this change; a follow-up can add a per-folder watcher that clears the field on disappearance. Today users will see an error in the tree; they can "Close Folder" to clear.
- **Empty folder picked** → `Empty folder.` muted text inside the panel.
- **No document open but `tocVisible: true`** → Outline panel visible, shows `No document open.`
- **Window narrower than folder + toc + 320 editor min** → editor column hits its `min-width: 320` and the window scrolls horizontally. Panels do not shrink at the editor's expense; hiding a panel is the user's escape hatch.
- **Resize past clamp** → drag stops moving at the clamp; the cursor continues to move but the divider does not.
- **`⌘\\` twice with no prior toggle state** → default restoration is "both on".

## 7. Accessibility

- Each panel is a landmark (`<aside role="complementary" aria-label="Folder Explorer" />` and `aria-label="Outline"`).
- Dividers use `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow={currentWidth}`, `aria-valuemin={180}`, `aria-valuemax={480}`, are `tabIndex={0}`, and respond to keyboard as above.
- Menu items use descriptive labels; the check-mark is exposed via the native toolkit.
- Hidden panels are unmounted; no focus can land in invisible controls.

## 8. Component / file plan

### New files

- `src/components/Sidebar/AsidePanel.tsx`
- `src/components/Sidebar/FolderPanel.tsx`
- `src/components/Sidebar/TocPanel.tsx`
- `src/components/Sidebar/ResizeHandle.tsx`
- `src/components/Sidebar/index.ts` (barrel)

### Modified files

- `src/App.tsx` — replace the single `aside` block with the three-column grid. Wire resize handles to preference setters; hook up `view:toggle-*` / `view:hide-all-sidebars` / `file:close-folder` menu events. Remove the brand header block (lines ≈517–526 today; `Logo.tsx` stays, still used by Tutorial).
- `src/state/preferences.ts` — add the four new fields + setters.
- `src/state/sessionPersistence.ts` — add `folder: string | null` to `PersistedSession`; `fsStat` check on load.
- `src-tauri/src/menu.rs` — View submenu reshape (ids `view:toggle-folder-panel`, `view:toggle-toc-panel`, `view:hide-all-sidebars`), File submenu addition (`file:close-folder`).
- `src/components/Tutorial/Tutorial.tsx` — two new rows in the shortcuts slide.

### Tests

- `src/components/Sidebar/FolderPanel.test.tsx` — empty / loaded states.
- `src/components/Sidebar/TocPanel.test.tsx` — empty / headings-forwarded states.
- `src/components/Sidebar/ResizeHandle.test.tsx` — keyboard arrows clamp correctly.
- `src/state/sessionPersistence.test.ts` — extends existing tests: round-trip of `folder`, drop on non-existent path.

### Deleted / deprecated

- The brand block in `App.tsx`.
- `asideStyle`, `asideHeaderStyle`, `asideBodyStyle`, `asideSectionLabelStyle` constants in `App.tsx` (visual treatments fold into `AsidePanel`).
- The single "Toggle Sidebar" menu item (replaced).

## 9. Out of scope

- Watchers that auto-clear the folder when the directory disappears.
- Side-by-side document panes in the editor column (the user flagged this as a future plan; the three-column grid is already the scaffolding for it, but the split logic itself is a separate spec).
- Per-tab "pinned folder" or multiple folders open simultaneously.
- Reorderable panels / workspaces (Obsidian-style drag between sidebars).
- Activity-bar ribbon (VS Code-style).

## 10. Success criteria

1. Picking a folder via `File → Open Folder…` puts its tree into the left-most panel.
2. Clicking a file in the tree opens it as a tab; no duplicate tab if already open.
3. The TOC panel shows the active document's headings; clicking a heading scrolls the editor to it in its current view mode.
4. `⌥⌘1` toggles the folder panel; `⌥⌘2` toggles the outline panel; `⌘\\` toggles both.
5. Dragging the dividers resizes the adjacent panels. Widths persist across restart.
6. Closing the app and re-opening restores the last folder (if it still exists) and the last visibility + widths.
7. `File → Close Folder` clears the folder; the panel falls back to the empty-state prompt.
8. All tests pass; typecheck + lint clean.
