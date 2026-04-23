# Side-by-Side Documents — Design Spec

**Date:** 2026-04-23
**Status:** Design approved; pre-implementation.
**Target:** Yeogi .MD Editor v0.3.x (next minor after v0.2.5).

## Goal

Let the user view and edit two documents at once in the same window,
each in its own pane, with independent tab strips and view modes.

## Motivating use cases

Validated with the user during brainstorming:

- **Compare two versions / two similar docs.** Scrolling and reading
  more than editing.
- **Reference while writing.** One pane is source material; the other
  is where the user is actively typing.
- **Same doc, two views.** A single doc opened in two panes with
  different view modes — e.g. raw Markdown in the left pane and
  WYSIWYG in the right.

Explicitly **not** in scope for v1: split-three-ways (VS Code-style
nested splits), drag-out-tab-into-new-window, sync-scrolling between
panes.

## Non-negotiables (anchored to CLAUDE.md)

1. Unsaved-edit safety is unchanged — doc-level dirty tracking and
   autosave continue to work per doc, not per pane.
2. External file-change detection still reliably fires per doc.
3. Keyboard, focus, and VoiceOver flows are explicit for pane
   switching.
4. Single-pane behavior is bit-for-bit unchanged when the secondary
   pane is `null`.

## Architecture

Today's model: one flat `documents[]` array plus an `activeId` on the
document store. Each `Document` carries its own `viewMode`.

New model separates **document state** (buffer, path, dirty, mtime,
conflict) from **layout state** (which pane shows which doc, view
mode per pane, which pane is focused):

```ts
// Document store — existing, with `viewMode` and `activeId` removed.
Document {
  id, path, content, lastSavedContent, savedMtime,
  isDirty, encoding, conflict, saveState, lastSaveError,
  autosaveEnabled,
  // removed: viewMode (now per-pane)
}
documents: Document[]

// NEW — layout store
Pane {
  id: "primary" | "secondary",
  tabs: string[],            // docIds in display order
  activeTabId: string | null,
  viewMode: "edit" | "wysiwyg",
}
Layout {
  primary: Pane,
  secondary: Pane | null,    // null when single-pane (today's default)
  focusedPaneId: "primary" | "secondary",
  paneSplit: number,         // fraction 0.2..0.8, default 0.5
}
```

Two panes max. `secondary === null` corresponds to today's
single-pane layout and must render identically to the current app.
The same `docId` is allowed in both panes' `tabs` arrays — that is
case (d).

Autosave, dirty tracking, save state, conflict state are all
doc-level (unchanged). Editing in one pane updates the shared buffer
and the other pane re-renders for free.

### Focus & editability rules

- When the two panes show **different** docs: both mount real editors.
  Focused pane is editable; inactive pane is mounted with
  `editable: false` (both CodeMirror and Tiptap support this
  directly). Clicking into the inactive pane's editor body shifts
  focus to it.
- When both panes show the **same** doc — meaning
  `primary.activeTabId === secondary.activeTabId` — only the
  **primary** pane is editable. The secondary pane is locked
  read-only even when it has focus for clicks / selection / scroll.
  User-facing rule: "same doc in two panes → edit from the primary."
  This sidesteps the dual-undo-history issue entirely.
- If the secondary pane later switches its active tab to a different
  doc (or closes that tab), the same-doc lock ends and secondary
  becomes editable under the normal focus rules. The lock is a
  function of the *current* activeTabId pair; it is not sticky.

### Undo semantics

Undo stays per-editor-instance. For different-doc panes this is
natural — each pane owns its own doc's undo stack. For same-doc two
panes, only the primary has an editable instance, so undo only
operates there.

## Component changes

**Stays the same:**
- `FolderPanel` — global, single instance, unchanged.
- `OutlinePanel` — global, single instance. Its input changes from
  "active doc" to "focused pane's active doc."
- `Editor` (CodeMirror wrapper) and `WysiwygEditor` (Tiptap wrapper)
  — internals unchanged. Both already accept a `readOnly` prop that
  maps to `editable: false`; we'll reuse it.

**Refactored:**
- `TabBar` — accepts `pane: Pane` and `isFocused: boolean` props
  instead of reading globals. Rendered once per pane (not once
  app-level).
- `TopBar` — accepts `pane: Pane` and the doc derived from
  `pane.activeTabId`. Rendered once per pane. Filename, word count,
  save state, view-mode toggle, autosave switch all derive from that
  pane's active doc.

**New:**
- `EditorPane` — wraps `TabBar + TopBar + (UpdateBanner /
  ConflictBanner slot) + (Editor | WysiwygEditor) + StatusBar-portion`
  for a single pane. Takes `pane` and `isFocused`. Applies the
  focus-aware `editable` flag to its editor. Receives open/close-tab
  handlers from `App.tsx`.
- A vertical drag handle between the two panes, reusing the existing
  `ResizeHandle` component.

**App.tsx layout shift:**

```
Today:
  <TabBar />
  <TopBar />
  <main>
    <FolderPanel? /> <OutlinePanel? /> <editor>
  </main>
  <StatusBar />

After split:
  <main>
    <FolderPanel? />
    <OutlinePanel? />
    <EditorPane pane={primary} isFocused={...} />
    <ResizeHandle? />
    <EditorPane? pane={secondary} isFocused={...} />
  </main>
  <StatusBar />
```

The app-level `TabBar` and `TopBar` disappear — they now live inside
`EditorPane`. `StatusBar` stays global and shows the focused pane's
save state.

## Data flow & ownership

### Stores (three Zustand stores)

- `useDocuments` — doc buffers + file I/O. Same as today minus
  `activeId` and `Document.viewMode`.
- `useLayout` — NEW. Holds `{ primary, secondary, focusedPaneId,
  paneSplit }`.
- `usePreferences` — unchanged (sidebar visibility, sidebar widths,
  global autosave default).

### Key actions on `useLayout`

- `openInFocusedPane(docId)` — adds `docId` to the focused pane's
  `tabs` (if not already present) and sets it as `activeTabId`.
- `openToTheSide(docId)` — if `secondary === null`, creates it with
  `docId` as its only tab. If `secondary` exists, adds `docId` as a
  new tab there (or focuses the existing tab) and sets
  `focusedPaneId = "secondary"`. Source pane's tabs untouched.
- `setFocusedPane(paneId)` — updates `focusedPaneId`.
- `setActiveTab(paneId, docId)` — updates that pane's `activeTabId`.
- `closeTab(paneId, docId)` — removes from `tabs`; activates the
  neighbor tab if there was one; if `paneId === "secondary"` and
  `tabs` becomes empty, sets `secondary = null` and
  `focusedPaneId = "primary"`.
- `setViewMode(paneId, mode)` — updates that pane's `viewMode`.
- `setPaneSplit(fraction)` — persists drag position.

### Flows

1. **Open file (normal click in Folder panel)**
   → `fsRead` → `openDocument` pushes into `documents[]`
   → `useLayout.openInFocusedPane(newDoc.id)`.
   Dedupe rule for this path: if the doc is already a tab in *any*
   pane, do not create a duplicate — focus that pane and activate
   that tab. (This preserves today's single-pane dedupe behavior.)
2. **⌘-click a file in Folder panel** / **right-click tab → Open to
   the Side**
   → same doc-side plumbing, but `useLayout.openToTheSide(newDoc.id)`.
   Dedupe rule for this path: only within the *destination* pane. If
   the doc is already a tab in the destination (the other pane),
   just focus it. If the doc is a tab in the *source* pane (the one
   you triggered from), we still open it in the destination as a
   separate tab — that is case (d). The source tab is untouched.
3. **Click a tab** → `setActiveTab(paneId, docId)` and
   `setFocusedPane(paneId)`.
4. **Click editor body in the non-focused pane** →
   `setFocusedPane(paneId)`. Unless both panes show the same doc —
   then the secondary is locked read-only and the body click does not
   shift focus (the user can still shift focus by clicking the
   secondary's tab).
5. **Type in focused pane** → `setContent(docId, ...)` as today.
   Every pane that shows this doc re-renders from the updated
   content. Only the focused pane's editor (or the primary, in
   same-doc case) is editable; others have `editable: false`.
6. **Toggle view mode** → `setViewMode(paneId, mode)`. Only that
   pane's rendering changes.
7. **Autosave / save status / conflict banner** — all doc-level and
   unchanged. The conflict banner renders in the pane where the doc
   is active; if both panes show it, only the primary renders the
   banner (avoid duplication).

### Session persistence

Serialize `useLayout` alongside today's session payload:

```ts
{
  // existing
  paths: string[],
  activePath: string | null,
  folder: string | null,
  // new
  layout: {
    primary: { tabPaths: string[], activeTabPath: string | null,
               viewMode: "edit" | "wysiwyg" },
    secondary: null | { tabPaths, activeTabPath, viewMode },
    focusedPaneId: "primary" | "secondary",
    paneSplit: number,
  }
}
```

On restore: reload each pane's tabs; if a path fails to load, skip
it. If all of secondary's tabs fail, set `secondary = null`. If
`focusedPaneId === "secondary"` but secondary didn't restore, default
to primary.

`activePath` at the top level is retained for backward compatibility
with existing sessions that don't yet have a `layout` field —
migration logic treats a missing `layout` as "single pane with all
paths in primary, active tab = activePath."

## UX states & flows

See also `docs/claude-code/UX_STATES.md` — this feature adds the
following states:

- **Single-pane** (`secondary === null`) — today's behavior.
- **Split, primary focused** — red indicator bar on primary's active
  tab; muted-gray bar on secondary's active tab.
- **Split, secondary focused** — mirror of above.
- **Split, same doc both panes** — secondary pane has a small
  read-only badge in its tab strip (e.g. a padlock glyph next to the
  tab title) and its editor is `editable: false` permanently.

### Trigger gestures (v1)

- ⌘-click a file in Folder panel → opens in secondary (creating
  secondary if none).
- Right-click a tab → "Open to the Side" context menu entry → opens
  that doc in the other pane.

Explicitly NOT in v1:
- "View → Split Right" menu item / shortcut (can be added later).
- Drag-to-split (tab drag to edge).

### Resize

Drag handle between the two panes. Default 50/50 on first split.
`paneSplit` persisted in `useLayout` (and restored on session
reload). Minimum pane width is enforced in the grid via
`minmax(320px, 1fr)` on each pane — below that total width (640 px),
horizontal scroll applies rather than forcing a collapse.

### Closing

- × on any tab, or middle-click a tab: `closeTab(paneId, docId)`.
- If that was the last tab in secondary, secondary collapses to
  `null`.
- Primary pane never fully closes — its last-tab close returns it to
  the empty state (today's "no file open" view), secondary (if
  present) keeps its tabs.
- ⌘W closes the focused pane's active tab.

### Active-pane indicator

The focused pane's active tab shows the red 2px indicator bar (the
existing inset box-shadow introduced in v0.2.5 chrome polish). The
inactive pane's active tab shows the same bar drawn in muted gray
(`var(--border-strong)` or similar neutral). No other pane-frame
chrome — we do not draw a border around the focused pane itself, to
keep the UI quiet.

## Edge cases

1. **"Open to the Side" for a doc already in the other pane** → no
   duplicate; focus that existing tab.
2. **Closing a doc that's in both panes' tabs** → close only that
   pane's tab. Doc stays in `documents[]` while any pane still has
   it. Zero references → remove from `documents[]`.
3. **External file change (conflict)** → banner renders in whichever
   pane has that doc active. If both, only primary shows the banner.
4. **Save / dirty** — doc-level. Every pane showing that doc shows
   the dirty dot. `⌘S` saves the focused pane's active doc.
5. **Path rename (Save As)** — doc updates; all panes showing that
   doc refresh tab title + TopBar filename.
6. **Find/Replace (`⌘F`)** — scopes to the focused pane's editor.
   Switching focus re-scopes the next `⌘F`.
7. **Print / Export HTML / Print to PDF** menu items — operate on the
   focused pane's active doc.
8. **Keystrokes hitting a locked-read-only secondary** (case d) —
   silently ignored by `editable: false`. A small tooltip near the
   secondary pane header reads "Read-only — edit from the primary
   pane." No modal, no blocking dialog.
9. **Window narrower than 640 px** — minimums enforced via grid
   `minmax(320px, 1fr)`; horizontal scroll takes over at the app
   shell level. Acceptable for v1.
10. **Session restore: secondary had tabs but none loaded** — set
    `secondary = null` on restore.
11. **Session restore: `focusedPaneId === "secondary"` but secondary
    collapsed** — fall back to primary.
12. **Tutorial / first-run** — unaffected; the tutorial always opens
    in primary pane and `secondary === null`.

## Testing

### Unit — `useLayout` store

- `openInFocusedPane` — adds, activates, dedupes.
- `openToTheSide` — creates secondary when none; inserts when
  present; focuses destination pane; dedupes.
- `setFocusedPane` — updates correctly.
- `setActiveTab` — updates pane's activeTabId.
- `closeTab` — neighbor activation logic; secondary collapses when
  last tab closes; primary never collapses.
- `setViewMode` — per-pane, doesn't leak across.
- Session round-trip — serialize, deserialize, equal state.
- Migration — old session (no `layout` field) loads into single-pane
  with all tabs in primary and `activePath → activeTabPath`.

### Component

- `EditorPane` renders TabBar + TopBar + editor with pane prop.
- Active/inactive indicator: focused pane's active tab has red bar;
  inactive pane's has muted bar.
- Same-doc-in-both-panes: secondary's editor `editable === false`
  regardless of focus state.

### Integration

- Right-click tab → Open to the Side → second pane appears with that
  doc active; split ratio 50/50 applied.
- ⌘-click in Folder panel → same effect.
- Click into secondary pane body (different doc) → focus shifts.
- Close last tab in secondary → pane collapses; layout returns to
  single-pane.
- Session restore of a two-pane layout returns both panes with their
  respective tabs and view modes.
- Single-pane regression: with `secondary === null`, the rendered
  DOM and visual layout are unchanged from today (snapshot test on
  the main column).

### Accessibility

- Each pane gets `role="region"` with `aria-label="Primary pane"` /
  `"Secondary pane"`.
- Each pane's tab strip is `role="tablist"`, scoped to that pane
  (not page-global).
- Focused pane is `aria-activedescendant`-friendly; VoiceOver
  announces pane name on focus change.
- Focus ring on editor is visibly distinct from the active-pane red
  indicator.
- All keyboard interactions that work today (tab navigation within
  an editor, ⌘W, ⌘S, ⌘F, tab-switch click) continue to work and
  apply to the focused pane.

## Known limitations (v1)

1. No drag-to-split gesture. Only right-click / ⌘-click trigger.
2. No menu bar entry for "View → Split Right" and no keyboard
   shortcut. Add in a later release.
3. No sync scrolling between panes (deliberately deferred — different
   use cases want different scroll coupling).
4. Same-doc-two-panes is primary-edits-only. "Swap panes" to change
   which instance is the editor is a v1.1 feature.
5. Undo stays per-editor-instance. For the same-doc case this is a
   non-issue (only primary has an editor); for the different-doc
   case each pane's undo is naturally independent.
6. Window shrinks below 640 px in split mode → horizontal scroll; no
   auto-collapse-to-single-pane.

## Open questions

None blocking. All design decisions confirmed during brainstorming on
2026-04-23.

## References

- Brainstorming conversation — 2026-04-23 (this spec's origin).
- `docs/claude-code/UI_ARCHITECTURE.md` — separation of document /
  editor / chrome / persistence concerns; this spec preserves those
  boundaries by introducing a layout store distinct from the doc
  store.
- `docs/claude-code/UX_STATES.md` — file/document states preserved;
  per-pane focus state added.
- v0.2.5 CHANGELOG entry (2026-04-23) — brand-red indicator bar
  reused as the active-pane signal in this design.
