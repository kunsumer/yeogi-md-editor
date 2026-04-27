# Side-by-Side Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user view and edit two documents at once in the same window, each in its own pane, with per-pane tab strips and view modes.

**Architecture:** A new `useLayout` Zustand store owns pane/layout state (two panes max, per-pane tabs, per-pane view mode, focused pane, split ratio). `useDocuments` loses `activeId` and `Document.viewMode`. UI is refactored so a new `EditorPane` component renders per-pane chrome (TabBar + TopBar + editor + banners); `App.tsx` composes one or two `EditorPane`s with a `ResizeHandle` between them. Trigger gestures: ⌘-click in Folder panel and right-click tab → "Open to the Side." Same-doc-in-both-panes locks secondary read-only to sidestep dual-undo.

**Tech Stack:** Zustand (state), React 18, Vitest + React Testing Library (tests), CodeMirror 6 (Edit), Tiptap 3 (WYSIWYG), Tauri 2 (shell).

**Source spec:** `docs/superpowers/specs/2026-04-23-side-by-side-documents-design.md`

---

## File inventory

**New files**
- `src/state/layout.ts` — new layout store: `Pane`, `LayoutState`, actions.
- `src/state/layout.test.ts` — unit tests for layout store.
- `src/components/EditorPane/EditorPane.tsx` — per-pane wrapper (TabBar + TopBar + banners + editor).
- `src/components/EditorPane/index.ts` — re-export.
- `src/components/EditorPane/EditorPane.test.tsx` — component tests.
- `src/components/TabBar/TabContextMenu.tsx` — right-click tab menu.

**Modified files**
- `src/state/documents.ts` — remove `activeId`, `setActive`, `Document.viewMode`, `setViewMode`.
- `src/state/documents.test.ts` — drop assertions on removed fields.
- `src/state/sessionPersistence.ts` — extend payload with `layout`, add migration for old payloads.
- `src/state/sessionPersistence.test.ts` — round-trip + migration tests.
- `src/components/TabBar/TabBar.tsx` — accept `pane: Pane`, `isFocused: boolean`, call layout actions.
- `src/components/TopBar/TopBar.tsx` — derive everything from `pane.activeTabId`'s doc.
- `src/components/FileTree/FileTree.tsx` — surface modifier key on click so the Folder panel can route ⌘-click to "open to the side."
- `src/components/FileTree/FileTree.test.tsx` — add modifier-click test.
- `src/components/Sidebar/FolderPanel.tsx` — new `onOpenFileToSide` prop; pass `onOpenFile` receiver the modifier.
- `src/App.tsx` — layout grid expands to two panes + resize handle; Outline input switches to focused pane's active doc; ⌘-click and tab-context-menu handlers wired.

**Unchanged**
- `src/components/Editor/*` (CodeMirror)
- `src/components/WysiwygEditor/*` (Tiptap)
- `src/components/Sidebar/TocPanel.tsx` (input changes but component API stays)

---

## Task ordering rationale

Each task must leave the app in a working state (existing tests pass, single-pane UX unchanged until Task 7). This lets us commit and ship partial progress without regressions.

1. **Task 1 — Create `useLayout` (primary only).** Pure state; no UI effect.
2. **Task 2 — Migrate `App.tsx` + consumers to read pane state from `useLayout`.** Both stores are updated in tandem ("dual-write") so nothing else breaks.
3. **Task 3 — Remove `activeId` and `Document.viewMode` from `useDocuments`.** Safe now that every reader is on the layout store.
4. **Task 4 — Add secondary pane + actions to `useLayout`.** Still rendered as single-pane in UI.
5. **Task 5 — Extract `EditorPane` component.** No visual change yet (primary pane only).
6. **Task 6 — Pane-aware `TabBar`.** Muted indicator on inactive pane.
7. **Task 7 — Pane-aware `TopBar`.** Derives from pane prop.
8. **Task 8 — Render secondary pane in `App.tsx` with `ResizeHandle`.** First visible split.
9. **Task 9 — Open-to-the-Side gestures** (⌘-click Folder + right-click tab menu).
10. **Task 10 — Same-doc lock** (secondary read-only when `activeTabId` pair matches).
11. **Task 11 — Outline follows focused pane.**
12. **Task 12 — Session persistence + migration.**
13. **Task 13 — Integration + a11y polish.**

---

## Task 1: Create `useLayout` store (primary only)

**Files:**
- Create: `src/state/layout.ts`
- Create: `src/state/layout.test.ts`

### - [ ] Step 1: Write the failing tests

`src/state/layout.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useLayout } from "./layout";

function reset() {
  useLayout.setState({
    primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
    secondary: null,
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
}

describe("useLayout (primary only)", () => {
  beforeEach(reset);

  it("openInFocusedPane adds a new tab and activates it", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    const s = useLayout.getState();
    expect(s.primary.tabs).toEqual(["doc-1"]);
    expect(s.primary.activeTabId).toBe("doc-1");
  });

  it("openInFocusedPane dedupes within the same pane and re-activates", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    useLayout.getState().openInFocusedPane("doc-2");
    useLayout.getState().openInFocusedPane("doc-1");
    const s = useLayout.getState();
    expect(s.primary.tabs).toEqual(["doc-1", "doc-2"]);
    expect(s.primary.activeTabId).toBe("doc-1");
  });

  it("setActiveTab changes the pane's active tab", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    useLayout.getState().openInFocusedPane("doc-2");
    useLayout.getState().setActiveTab("primary", "doc-1");
    expect(useLayout.getState().primary.activeTabId).toBe("doc-1");
  });

  it("setActiveTab is a no-op for a docId not in the pane", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    useLayout.getState().setActiveTab("primary", "nope");
    expect(useLayout.getState().primary.activeTabId).toBe("doc-1");
  });

  it("setViewMode updates only the targeted pane", () => {
    useLayout.getState().setViewMode("primary", "edit");
    expect(useLayout.getState().primary.viewMode).toBe("edit");
  });

  it("closeTab removes the tab and activates the neighbor", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    useLayout.getState().openInFocusedPane("doc-2");
    useLayout.getState().openInFocusedPane("doc-3");
    useLayout.getState().setActiveTab("primary", "doc-2");
    useLayout.getState().closeTab("primary", "doc-2");
    const s = useLayout.getState();
    expect(s.primary.tabs).toEqual(["doc-1", "doc-3"]);
    expect(s.primary.activeTabId).toBe("doc-3");
  });

  it("closeTab clears activeTabId when the last tab closes in primary", () => {
    useLayout.getState().openInFocusedPane("doc-1");
    useLayout.getState().closeTab("primary", "doc-1");
    expect(useLayout.getState().primary.tabs).toEqual([]);
    expect(useLayout.getState().primary.activeTabId).toBe(null);
  });

  it("setFocusedPane to 'secondary' is a no-op when secondary is null", () => {
    useLayout.getState().setFocusedPane("secondary");
    expect(useLayout.getState().focusedPaneId).toBe("primary");
  });
});
```

### - [ ] Step 2: Run the tests; expect failure

Run: `pnpm test src/state/layout.test.ts`

Expected: `Cannot find module './layout'` or equivalent.

### - [ ] Step 3: Implement the store

`src/state/layout.ts`:

```ts
import { create } from "zustand";

export type PaneId = "primary" | "secondary";
export type ViewMode = "edit" | "wysiwyg";

export interface Pane {
  id: PaneId;
  tabs: string[];
  activeTabId: string | null;
  viewMode: ViewMode;
}

interface LayoutState {
  primary: Pane;
  secondary: Pane | null;
  focusedPaneId: PaneId;
  paneSplit: number;

  openInFocusedPane(docId: string): void;
  setActiveTab(paneId: PaneId, docId: string): void;
  setFocusedPane(paneId: PaneId): void;
  setViewMode(paneId: PaneId, mode: ViewMode): void;
  closeTab(paneId: PaneId, docId: string): void;
}

const emptyPrimary: Pane = {
  id: "primary",
  tabs: [],
  activeTabId: null,
  viewMode: "wysiwyg",
};

function setPane(
  set: (partial: Partial<LayoutState>) => void,
  paneId: PaneId,
  next: Pane,
): void {
  if (paneId === "primary") set({ primary: next });
  else set({ secondary: next });
}

export const useLayout = create<LayoutState>((set, get) => ({
  primary: emptyPrimary,
  secondary: null,
  focusedPaneId: "primary",
  paneSplit: 0.5,

  openInFocusedPane(docId) {
    const { primary, secondary, focusedPaneId } = get();
    if (primary.tabs.includes(docId)) {
      setPane(set, "primary", { ...primary, activeTabId: docId });
      set({ focusedPaneId: "primary" });
      return;
    }
    if (secondary && secondary.tabs.includes(docId)) {
      setPane(set, "secondary", { ...secondary, activeTabId: docId });
      set({ focusedPaneId: "secondary" });
      return;
    }
    const target = focusedPaneId === "primary" ? primary : secondary;
    if (!target) return;
    setPane(set, focusedPaneId, {
      ...target,
      tabs: [...target.tabs, docId],
      activeTabId: docId,
    });
  },

  setActiveTab(paneId, docId) {
    const pane = paneId === "primary" ? get().primary : get().secondary;
    if (!pane || !pane.tabs.includes(docId)) return;
    setPane(set, paneId, { ...pane, activeTabId: docId });
  },

  setFocusedPane(paneId) {
    if (paneId === "secondary" && !get().secondary) return;
    set({ focusedPaneId: paneId });
  },

  setViewMode(paneId, mode) {
    const pane = paneId === "primary" ? get().primary : get().secondary;
    if (!pane) return;
    setPane(set, paneId, { ...pane, viewMode: mode });
  },

  closeTab(paneId, docId) {
    const pane = paneId === "primary" ? get().primary : get().secondary;
    if (!pane) return;
    const idx = pane.tabs.indexOf(docId);
    if (idx === -1) return;
    const tabs = pane.tabs.filter((id) => id !== docId);
    let activeTabId = pane.activeTabId;
    if (activeTabId === docId) {
      activeTabId = tabs[idx] ?? tabs[idx - 1] ?? null;
    }
    if (paneId === "secondary" && tabs.length === 0) {
      set({ secondary: null, focusedPaneId: "primary" });
      return;
    }
    setPane(set, paneId, { ...pane, tabs, activeTabId });
  },
}));
```

### - [ ] Step 4: Run the tests; expect pass

Run: `pnpm test src/state/layout.test.ts`

Expected: all 8 tests pass.

### - [ ] Step 5: Commit

```bash
git add src/state/layout.ts src/state/layout.test.ts
git commit -m "feat(state): create useLayout store (primary pane only)"
```

---

## Task 2: Migrate `App.tsx` and consumers to read pane state from `useLayout`

Keep `useDocuments.activeId` and `Document.viewMode` alive during this task (dual-write) so we can do the refactor without breaking any consumer in a single step. Task 3 removes them.

**Files:**
- Modify: `src/state/documents.ts` — `openDocument`, `setActive`, `closeDocument`, `setViewMode` also call the matching `useLayout` action (dual-write bridge).
- Modify: `src/App.tsx` — read active doc from `useLayout`, read pane view mode from `useLayout`, call `useLayout` actions from click handlers (openFile, requestCloseDocument, setViewMode).

### - [ ] Step 1: Add a failing test for the dual-write bridge

Append to `src/state/documents.test.ts`:

```ts
import { useLayout } from "./layout";

describe("useDocuments → useLayout bridge", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null, folder: null });
    useLayout.setState({
      primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
      secondary: null,
      focusedPaneId: "primary",
      paneSplit: 0.5,
    });
  });

  it("openDocument adds the docId to the focused pane's tabs", () => {
    const { openDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "x", savedMtime: 1, encoding: "utf-8" });
    expect(useLayout.getState().primary.tabs).toEqual([id]);
    expect(useLayout.getState().primary.activeTabId).toBe(id);
  });

  it("setActive is mirrored into layout.setActiveTab", () => {
    const { openDocument, setActive } = useDocuments.getState();
    const id1 = openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
    const id2 = openDocument({ path: "/b.md", content: "b", savedMtime: 1, encoding: "utf-8" });
    setActive(id1);
    expect(useLayout.getState().primary.activeTabId).toBe(id1);
    setActive(id2);
    expect(useLayout.getState().primary.activeTabId).toBe(id2);
  });

  it("closeDocument removes the tab from the pane", () => {
    const { openDocument, closeDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "x", savedMtime: 1, encoding: "utf-8" });
    closeDocument(id);
    expect(useLayout.getState().primary.tabs).toEqual([]);
  });
});
```

### - [ ] Step 2: Run the failing tests

Run: `pnpm test src/state/documents.test.ts`

Expected: the three new tests fail (layout not synced).

### - [ ] Step 3: Wire the bridge in `documents.ts`

In `src/state/documents.ts`:

**(a)** Add the layout import at the top of the file, next to the existing `import { usePreferences } from "./preferences";`:

```ts
import { useLayout } from "./layout";
```

**(b)** In `openDocument`, mirror both the dedupe path and the new-doc path into the layout store. The relevant baseline lines (roughly 68–98 in today's file) become:

```ts
openDocument({ path, content, savedMtime, encoding, readOnly = false }) {
  const autosaveDefault = usePreferences.getState().autosaveEnabled;
  if (path) {
    const existing = get().documents.find((d) => d.path === path);
    if (existing) {
      set({ activeId: existing.id });
      useLayout.getState().openInFocusedPane(existing.id); // NEW
      return existing.id;
    }
  }
  const id = newId();
  const doc: Document = {
    id, path, content, lastSavedContent: content, savedMtime,
    isDirty: false, encoding, cursor: 0, scrollTop: 0, readOnly,
    previewWindowLabel: null, conflict: null, saveState: "idle",
    lastSaveError: null, viewMode: "wysiwyg",
    autosaveEnabled: autosaveDefault,
  };
  set((s) => ({ documents: [...s.documents, doc], activeId: id }));
  useLayout.getState().openInFocusedPane(id); // NEW
  return id;
},
```

**(c)** In `setActive`:

```ts
setActive(id) {
  set({ activeId: id });
  useLayout.getState().openInFocusedPane(id); // dedupes + activates
},
```

**(d)** In `closeDocument`, forward to the layout store after the local update:

```ts
closeDocument(id) {
  set((s) => {
    const documents = s.documents.filter((d) => d.id !== id);
    const activeId = s.activeId === id ? (documents[0]?.id ?? null) : s.activeId;
    return { documents, activeId };
  });
  useLayout.getState().closeTab("primary", id);
  if (useLayout.getState().secondary) {
    useLayout.getState().closeTab("secondary", id);
  }
},
```

**(e)** In `setViewMode`, mirror when the doc is the focused pane's active tab:

```ts
setViewMode(id, mode) {
  set((s) => ({
    documents: s.documents.map((d) => (d.id === id ? { ...d, viewMode: mode } : d)),
  }));
  const { focusedPaneId, primary, secondary } = useLayout.getState();
  const focused = focusedPaneId === "primary" ? primary : secondary;
  if (focused?.activeTabId === id) {
    useLayout.getState().setViewMode(focusedPaneId, mode);
  }
},
```

### - [ ] Step 4: Run tests; expect pass

Run: `pnpm test src/state`

Expected: all documents, layout, preferences, sessionPersistence tests green.

### - [ ] Step 5: Update `App.tsx` to read from `useLayout`

In `src/App.tsx`:

- Replace `const active = documents.find((d) => d.id === activeId) ?? null;` with:

```tsx
const { focusedPaneId, primary, secondary } = useLayout();
const focusedPane = focusedPaneId === "primary" ? primary : secondary;
const activeDocId = focusedPane?.activeTabId ?? null;
const active = documents.find((d) => d.id === activeDocId) ?? null;
```

- Replace `const docAutosaveEnabled = active?.autosaveEnabled ?? autosaveEnabled;` — no change (still derived from `active`).

- For the `viewMode` source (today `active.viewMode`), switch to `focusedPane?.viewMode ?? "wysiwyg"`.

- In the TopBar mount, replace `viewMode={active?.viewMode}` with `viewMode={focusedPane?.viewMode}` and the callback `onSetViewMode={(mode) => useLayout.getState().setViewMode(focusedPaneId, mode)}`.

- In `setViewMode(mode)` (the local function that also captures heading scroll), use `useLayout` instead of `useDocuments.setViewMode`:

```tsx
function setViewMode(mode: ViewMode) {
  if (!active || !focusedPane) return;
  if (focusedPane.viewMode !== mode) {
    const captured = captureTopHeadingIndex(focusedPane.viewMode);
    pendingScrollHeadingRef.current =
      captured != null ? { docId: active.id, index: captured } : null;
  }
  useLayout.getState().setViewMode(focusedPaneId, mode);
}
```

### - [ ] Step 6: Type-check and run the app

Run: `pnpm lint` (runs `tsc --noEmit`)

Expected: no errors.

Run: `pnpm tauri dev` briefly to verify single-pane behavior is unchanged — open a file, switch tabs, toggle WYSIWYG/Edit, close a tab.

### - [ ] Step 7: Commit

```bash
git add src/state/documents.ts src/state/documents.test.ts src/App.tsx
git commit -m "refactor(state): route App through useLayout; dual-write from useDocuments"
```

---

## Task 3: Remove `activeId` and `Document.viewMode` from `useDocuments`

Now that every reader gets pane state from `useLayout`, the bridge in Task 2 is the only remaining writer. Remove the bridge targets themselves.

**Files:**
- Modify: `src/state/documents.ts` — delete `activeId`, `setActive`, `Document.viewMode`, `setViewMode`. Keep the dual-write forwarders (`openDocument`, `closeDocument` still forward to layout).
- Modify: `src/state/documents.test.ts` — drop assertions on `activeId` and `Document.viewMode`.

### - [ ] Step 1: Update failing tests

In `src/state/documents.test.ts`, delete or rewrite the three tests that reference `activeId` / `viewMode`:

```ts
// DELETE the `expect(s.activeId).toBe(id)` line from "openDocument adds a tab"
// DELETE "openDocument with the same path returns the existing id" — it asserts activeId.
//   Replace with equivalent assertion against useLayout:
it("openDocument with the same path returns the existing id, no duplicate", () => {
  const { openDocument } = useDocuments.getState();
  const id1 = openDocument({ path: "/a.md", content: "v1", savedMtime: 1, encoding: "utf-8" });
  const id2 = openDocument({ path: "/a.md", content: "v1", savedMtime: 1, encoding: "utf-8" });
  expect(id2).toBe(id1);
  expect(useDocuments.getState().documents).toHaveLength(1);
  expect(useLayout.getState().primary.activeTabId).toBe(id1);
});
```

### - [ ] Step 2: Run tests; expect failures pointing at removed fields

Run: `pnpm test`

Expected: documents tests fail where they read removed fields.

### - [ ] Step 3: Remove the fields

In `src/state/documents.ts`:

```ts
export interface Document {
  id: string;
  path: string | null;
  content: string;
  lastSavedContent: string;
  savedMtime: number;
  isDirty: boolean;
  encoding: string;
  cursor: number;
  scrollTop: number;
  readOnly: boolean;
  previewWindowLabel: string | null;
  conflict: Conflict | null;
  saveState: "idle" | "saving" | "saved" | "failed";
  lastSaveError: string | null;
  autosaveEnabled: boolean;
  // viewMode removed — now lives on Pane (useLayout)
}

interface DocumentsState {
  documents: Document[];
  folder: string | null;
  // activeId removed — now derived from useLayout
  openDocument(input: { /* unchanged */ }): string;
  closeDocument(id: string): void;
  setFolder(path: string | null): void;
  setContent(id: string, content: string): void;
  markSaveStarted(id: string): void;
  markSaved(id: string, input: { content: string; mtimeMs: number }): void;
  markSaveFailed(id: string, error: string): void;
  setPath(id: string, path: string): void;
  setPreviewWindowLabel(id: string, label: string | null): void;
  setConflict(id: string, conflict: Conflict | null): void;
  setAutosaveEnabled(id: string, enabled: boolean): void;
  replaceContentFromDisk(id: string, input: { content: string; mtimeMs: number }): void;
  // setActive and setViewMode removed
}
```

- Delete `activeId` from initial state.
- Delete `setActive` implementation.
- Delete `setViewMode` implementation.
- In `openDocument`, remove the `viewMode: "wysiwyg"` default initializer on the `doc` object.
- In `closeDocument`, remove the `activeId = ...` logic (just filter documents; layout bridge already handles pane activation).

### - [ ] Step 4: Remove callers

In `src/App.tsx`:
- Replace remaining `useDocuments.getState().setActive(...)` calls with `useLayout.getState().openInFocusedPane(...)` (semantically identical now).
- Remove any `useDocuments((s) => s.activeId)` subscriptions.

Search for stragglers:

```bash
grep -rn "setActive\|activeId\|Document.viewMode\|setViewMode" src/ | grep -v test
```

Rewrite each call site to use `useLayout`.

### - [ ] Step 5: Run typecheck and tests

Run: `pnpm lint && pnpm test`

Expected: all pass.

### - [ ] Step 6: Smoke-test the app

Run: `pnpm tauri dev`

Open a file, switch tabs, toggle mode. Close a tab. Open a folder. Everything behaves as before.

### - [ ] Step 7: Commit

```bash
git add src/state/documents.ts src/state/documents.test.ts src/App.tsx
git commit -m "refactor(state): remove activeId and Document.viewMode (now on useLayout)"
```

---

## Task 4: Extend `useLayout` with secondary pane support

Add `openToTheSide`, secondary-aware `setFocusedPane`, `setPaneSplit`. Still no UI change — rendering secondary comes in Task 8.

**Files:**
- Modify: `src/state/layout.ts`
- Modify: `src/state/layout.test.ts`

### - [ ] Step 1: Write the failing tests

Append to `src/state/layout.test.ts`:

```ts
describe("useLayout (secondary pane)", () => {
  beforeEach(reset);

  it("openToTheSide creates secondary with docId when none exists", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-b");
    const s = useLayout.getState();
    expect(s.secondary).not.toBeNull();
    expect(s.secondary!.tabs).toEqual(["doc-b"]);
    expect(s.secondary!.activeTabId).toBe("doc-b");
    expect(s.focusedPaneId).toBe("secondary");
  });

  it("openToTheSide inserts into existing secondary and focuses it", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-b");
    useLayout.getState().setFocusedPane("primary");
    useLayout.getState().openToTheSide("doc-c");
    const s = useLayout.getState();
    expect(s.secondary!.tabs).toEqual(["doc-b", "doc-c"]);
    expect(s.secondary!.activeTabId).toBe("doc-c");
    expect(s.focusedPaneId).toBe("secondary");
  });

  it("openToTheSide re-focuses an existing tab in the destination pane", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-b");
    useLayout.getState().openToTheSide("doc-c");
    useLayout.getState().openToTheSide("doc-b"); // already in secondary
    const s = useLayout.getState();
    expect(s.secondary!.tabs).toEqual(["doc-b", "doc-c"]);
    expect(s.secondary!.activeTabId).toBe("doc-b");
  });

  it("openToTheSide allows the same doc in both panes (case d)", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-a"); // triggered from primary's tab
    const s = useLayout.getState();
    expect(s.primary.tabs).toEqual(["doc-a"]);
    expect(s.secondary!.tabs).toEqual(["doc-a"]);
    expect(s.focusedPaneId).toBe("secondary");
  });

  it("closeTab on last tab in secondary collapses secondary to null", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-b");
    useLayout.getState().closeTab("secondary", "doc-b");
    const s = useLayout.getState();
    expect(s.secondary).toBeNull();
    expect(s.focusedPaneId).toBe("primary");
  });

  it("setFocusedPane to 'secondary' works when secondary exists", () => {
    useLayout.getState().openInFocusedPane("doc-a");
    useLayout.getState().openToTheSide("doc-b");
    useLayout.getState().setFocusedPane("primary");
    useLayout.getState().setFocusedPane("secondary");
    expect(useLayout.getState().focusedPaneId).toBe("secondary");
  });

  it("setPaneSplit clamps to [0.2, 0.8]", () => {
    useLayout.getState().setPaneSplit(0.05);
    expect(useLayout.getState().paneSplit).toBe(0.2);
    useLayout.getState().setPaneSplit(0.99);
    expect(useLayout.getState().paneSplit).toBe(0.8);
    useLayout.getState().setPaneSplit(0.4);
    expect(useLayout.getState().paneSplit).toBe(0.4);
  });
});
```

### - [ ] Step 2: Run tests; expect failures

Run: `pnpm test src/state/layout.test.ts`

Expected: the new tests fail with "openToTheSide is not a function" and similar.

### - [ ] Step 3: Implement the new actions

Add to the `LayoutState` interface in `src/state/layout.ts`:

```ts
openToTheSide(docId: string): void;
setPaneSplit(fraction: number): void;
```

Add to the store body:

```ts
openToTheSide(docId) {
  const { primary, secondary } = get();
  if (!secondary) {
    set({
      secondary: {
        id: "secondary",
        tabs: [docId],
        activeTabId: docId,
        viewMode: "wysiwyg",
      },
      focusedPaneId: "secondary",
    });
    return;
  }
  if (secondary.tabs.includes(docId)) {
    set({
      secondary: { ...secondary, activeTabId: docId },
      focusedPaneId: "secondary",
    });
    return;
  }
  set({
    secondary: {
      ...secondary,
      tabs: [...secondary.tabs, docId],
      activeTabId: docId,
    },
    focusedPaneId: "secondary",
  });
  // primary untouched — intentional; source tab stays put.
  void primary;
},

setPaneSplit(fraction) {
  const clamped = Math.max(0.2, Math.min(0.8, fraction));
  set({ paneSplit: clamped });
},
```

### - [ ] Step 4: Run tests; expect pass

Run: `pnpm test src/state/layout.test.ts`

Expected: all tests (primary + secondary blocks) pass.

### - [ ] Step 5: Commit

```bash
git add src/state/layout.ts src/state/layout.test.ts
git commit -m "feat(state): add secondary pane actions to useLayout"
```

---

## Task 5: Extract `EditorPane` component

Move the per-pane chrome (TabBar, TopBar, banners, editor) into a dedicated component. This task does NOT yet render a second pane — it just packages the primary pane's JSX into `EditorPane` so Task 8 can render a second instance without code duplication.

**Files:**
- Create: `src/components/EditorPane/EditorPane.tsx`
- Create: `src/components/EditorPane/index.ts`
- Create: `src/components/EditorPane/EditorPane.test.tsx`
- Modify: `src/App.tsx` — mount `<EditorPane pane={primary} isFocused={focusedPaneId === "primary"} ... />` in place of inline TabBar + TopBar + editor JSX.

### - [ ] Step 1: Write a minimal failing component test

`src/components/EditorPane/EditorPane.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorPane } from "./EditorPane";
import { useDocuments } from "../../state/documents";
import { useLayout } from "../../state/layout";

function reset() {
  useDocuments.setState({ documents: [], folder: null });
  useLayout.setState({
    primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
    secondary: null,
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
}

describe("EditorPane", () => {
  beforeEach(reset);

  it("renders the empty state when the pane has no active tab", () => {
    render(
      <EditorPane
        pane={useLayout.getState().primary}
        isFocused
        documents={[]}
        onOpenFiles={() => {}}
        onOpenFolder={() => {}}
        onCloseTab={() => {}}
        onActivateTab={() => {}}
        onOpenToSide={() => {}}
        onSetViewMode={() => {}}
        onFocusPane={() => {}}
        onSetContent={() => {}}
      />,
    );
    expect(screen.getByText(/No file open/i)).toBeInTheDocument();
  });
});
```

### - [ ] Step 2: Run tests; expect failure (module missing)

Run: `pnpm test src/components/EditorPane`

Expected: `Cannot find module './EditorPane'`.

### - [ ] Step 3: Create the component

`src/components/EditorPane/EditorPane.tsx`:

```tsx
import { TabBar } from "../TabBar";
import { TopBar } from "../TopBar";
import { Editor } from "../Editor";
import { WysiwygEditor } from "../WysiwygEditor";
import { ConflictBanner } from "../ConflictBanner";
import { UpdateBanner } from "../UpdateBanner";
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

interface Props {
  pane: Pane;
  isFocused: boolean;
  documents: Document[];
  onOpenFiles(): void;
  onOpenFolder(): void;
  onCloseTab(paneId: "primary" | "secondary", docId: string): void;
  onActivateTab(paneId: "primary" | "secondary", docId: string): void;
  onOpenToSide(docId: string): void;
  onSetViewMode(paneId: "primary" | "secondary", mode: "edit" | "wysiwyg"): void;
  onFocusPane(paneId: "primary" | "secondary"): void;
  onSetContent(docId: string, next: string): void;
  // Additional props (updater status, searchOpen, viewRef, etc.) are wired
  // in Task 7 when TopBar becomes pane-aware; for now we stub them.
}

export function EditorPane({
  pane,
  isFocused,
  documents,
  onOpenFiles,
  onOpenFolder,
  onCloseTab,
  onActivateTab,
  onOpenToSide,
  onSetViewMode,
  onFocusPane,
  onSetContent,
}: Props) {
  const active = documents.find((d) => d.id === pane.activeTabId) ?? null;

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
      onFocus={() => onFocusPane(pane.id)}
      onClick={() => onFocusPane(pane.id)}
      role="region"
      aria-label={pane.id === "primary" ? "Primary pane" : "Secondary pane"}
    >
      <TabBar
        pane={pane}
        isFocused={isFocused}
        documents={documents}
        onActivate={(id) => onActivateTab(pane.id, id)}
        onClose={(id) => onCloseTab(pane.id, id)}
        onOpenToSide={(id) => onOpenToSide(id)}
        onNew={onOpenFiles}
      />
      <TopBar
        pane={pane}
        active={active}
        onSetViewMode={(mode) => onSetViewMode(pane.id, mode)}
      />
      {pane.id === "primary" && <UpdateBanner />}
      {active?.conflict && pane.id === "primary" && <ConflictBanner doc={active} />}
      {active ? (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          {pane.viewMode === "wysiwyg" ? (
            <WysiwygEditor
              key={active.id}
              content={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={active.readOnly || !isFocused}
            />
          ) : (
            <Editor
              docId={active.id}
              value={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={active.readOnly || !isFocused}
            />
          )}
        </div>
      ) : (
        <EmptyState onOpenFiles={onOpenFiles} onOpenFolder={onOpenFolder} />
      )}
    </main>
  );
}

function EmptyState({
  onOpenFiles,
  onOpenFolder,
}: {
  onOpenFiles: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "var(--text-faint)",
        fontSize: 13,
      }}
    >
      <div>No file open.</div>
      <button
        className="btn-primary"
        style={{ minWidth: 130, justifyContent: "center" }}
        onClick={onOpenFiles}
      >
        Open file(s)…
      </button>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>or</div>
      <button
        className="btn-primary"
        style={{ minWidth: 130, justifyContent: "center" }}
        onClick={onOpenFolder}
      >
        Open folder…
      </button>
    </div>
  );
}
```

**Note:** `TabBar` and `TopBar` prop signatures change in Tasks 6 and 7. For Task 5, compile will fail because the existing `TabBar` takes `docs` / `activeId`, not `pane`. **To keep Task 5 shippable, temporarily accept the old props inside `TabBar` as well**, and let `EditorPane` pass through the legacy shape:

At the top of `EditorPane.tsx`, replace the `<TabBar pane={...} ... />` block with the legacy-shaped call until Task 6:

```tsx
<TabBar
  docs={pane.tabs.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? d.path.split("/").pop()! : "Untitled",
      isDirty: !!d?.isDirty,
    };
  })}
  activeId={pane.activeTabId}
  onActivate={(id) => onActivateTab(pane.id, id)}
  onClose={(id) => onCloseTab(pane.id, id)}
  onNew={onOpenFiles}
/>
```

And for `TopBar`, compute the inputs from `pane` and `active` and pass the existing props (filename, wordCount, saveState, etc.). `TopBar`'s API change lands in Task 7.

### - [ ] Step 4: Create the index barrel

`src/components/EditorPane/index.ts`:

```ts
export { EditorPane } from "./EditorPane";
```

### - [ ] Step 5: Replace the inline JSX in `App.tsx`

In the return of `App.tsx`, replace the `<main>...</main>` that contains `<TopBar />`, `<UpdateBanner />`, `<ConflictBanner />`, the active-editor block, the empty state, and `<StatusBar />` with the block below. **Define `paneProps` above the return** so Task 8 can reuse it for the secondary pane:

```tsx
const paneProps = {
  documents,
  onOpenFiles: () => pickAndOpenFiles().catch(console.error),
  onOpenFolder: () => pickAndOpenFolder().catch(console.error),
  onCloseTab: (paneId: "primary" | "secondary", id: string) =>
    requestCloseDocument(id),
  onActivateTab: (paneId: "primary" | "secondary", id: string) =>
    useLayout.getState().setActiveTab(paneId, id),
  onOpenToSide: (id: string) => useLayout.getState().openToTheSide(id),
  onSetViewMode: (paneId: "primary" | "secondary", mode: "edit" | "wysiwyg") => {
    if (paneId === focusedPaneId) setViewMode(mode);
    else useLayout.getState().setViewMode(paneId, mode);
  },
  onFocusPane: (paneId: "primary" | "secondary") =>
    useLayout.getState().setFocusedPane(paneId),
  onSetContent: (id: string, next: string) => setContent(id, next),
};
```

Then:

```tsx
<EditorPane
  pane={primary}
  isFocused={focusedPaneId === "primary"}
  {...paneProps}
/>
```

Keep `<StatusBar />` rendered once at the app shell level (outside the pane).

Keep the TabBar at the app level for this commit too — it renders on top of EditorPane's internal TabBar. Actually no — delete the app-level `<TabBar />` from the return, since EditorPane already renders one. Visually, nothing changes.

### - [ ] Step 6: Typecheck, test, smoke-test

Run: `pnpm lint && pnpm test && pnpm tauri dev`

Expected: compiles, tests pass, single-pane behavior unchanged.

### - [ ] Step 7: Commit

```bash
git add src/components/EditorPane src/App.tsx
git commit -m "refactor(ui): extract EditorPane component (primary pane only)"
```

---

## Task 6: Pane-aware `TabBar`

Make `TabBar` accept `pane: Pane` and `isFocused: boolean`. Derive tabs from `pane.tabs` + the documents map. Muted indicator when not focused.

**Files:**
- Modify: `src/components/TabBar/TabBar.tsx`
- Modify: `src/components/EditorPane/EditorPane.tsx` — switch to new TabBar API.

### - [ ] Step 1: Write the failing test

Append `src/components/TabBar/TabBar.test.tsx` (create if missing):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBar } from "./TabBar";
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

const pane: Pane = {
  id: "primary",
  tabs: ["doc-1", "doc-2"],
  activeTabId: "doc-2",
  viewMode: "wysiwyg",
};
const documents: Document[] = [
  makeDoc("doc-1", "/a.md"),
  makeDoc("doc-2", "/b.md"),
];

function makeDoc(id: string, path: string): Document {
  return {
    id, path, content: "", lastSavedContent: "", savedMtime: 1, isDirty: false,
    encoding: "utf-8", cursor: 0, scrollTop: 0, readOnly: false,
    previewWindowLabel: null, conflict: null, saveState: "idle",
    lastSaveError: null, autosaveEnabled: false,
  };
}

describe("TabBar", () => {
  it("renders a tab per docId in pane.tabs", () => {
    render(
      <TabBar
        pane={pane}
        isFocused
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onNew={() => {}}
      />,
    );
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByText("b.md")).toBeInTheDocument();
  });

  it("marks the active tab selected", () => {
    render(
      <TabBar
        pane={pane}
        isFocused
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onNew={() => {}}
      />,
    );
    const active = screen.getByText("b.md").closest("[role=tab]");
    expect(active?.getAttribute("aria-selected")).toBe("true");
  });

  it("uses muted indicator color when pane is not focused", () => {
    const { container } = render(
      <TabBar
        pane={pane}
        isFocused={false}
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onNew={() => {}}
      />,
    );
    const active = container.querySelector('[aria-selected="true"]') as HTMLElement;
    // Inset box shadow uses --border-strong when inactive, --brand-red when focused.
    expect(active.style.boxShadow).toContain("var(--border-strong");
  });
});
```

### - [ ] Step 2: Run tests; expect failure

Run: `pnpm test src/components/TabBar`

Expected: type/prop errors; tests fail.

### - [ ] Step 3: Rewrite `TabBar.tsx` props

Replace the signature in `src/components/TabBar/TabBar.tsx`:

```tsx
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

interface Props {
  pane: Pane;
  isFocused: boolean;
  documents: Document[];
  onActivate(id: string): void;
  onClose(id: string): void;
  onOpenToSide(id: string): void;
  onNew?: () => void;
}

export function TabBar({
  pane,
  isFocused,
  documents,
  onActivate,
  onClose,
  onOpenToSide,
  onNew,
}: Props) {
  const tabs = pane.tabs.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? d.path.split("/").pop()! : "Untitled",
      isDirty: !!d?.isDirty,
    };
  });
  return (
    <div role="tablist" className="app-tabbar" style={tablistStyle}>
      {tabs.map((d) => {
        const active = d.id === pane.activeTabId;
        return (
          <div
            key={d.id}
            role="tab"
            aria-selected={active}
            data-dirty={d.isDirty ? "true" : "false"}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(d.id);
              }
            }}
            onClick={() => onActivate(d.id)}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tabbar-hover)";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text-muted)";
              }
            }}
            style={tabStyle(active, isFocused)}
          >
            {d.isDirty && <span aria-hidden="true" style={dotStyle} />}
            <span style={titleStyle}>{d.title}</span>
            <button
              aria-label={`Close ${d.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(d.id);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.08)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
              }}
              style={closeBtnStyle}
            >
              ×
            </button>
          </div>
        );
      })}
      {onNew && (
        <button
          type="button"
          aria-label="Open new file"
          title="Open file(s)…"
          onClick={onNew}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tabbar-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
          style={newTabBtnStyle}
        >
          +
        </button>
      )}
    </div>
  );
}
```

Update `tabStyle` to take the focus state (note the full definition — do not edit-by-description):

```tsx
const tabStyle = (active: boolean, isFocused: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  maxWidth: 220,
  height: 32,
  padding: "0 10px 0 14px",
  borderRadius: "6px 6px 0 0",
  background: active ? "var(--bg-tab-active)" : "var(--bg-tab-inactive)",
  color: active ? "var(--text)" : "var(--text-muted)",
  boxShadow: active
    ? `inset 0 2px 0 0 var(${isFocused ? "--brand-red" : "--border-strong"})`
    : "none",
  cursor: "pointer",
  userSelect: "none",
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  whiteSpace: "nowrap",
  transition: "background 120ms, color 120ms",
});
```

The `tablistStyle`, `closeBtnStyle`, `dotStyle`, `titleStyle`, and `newTabBtnStyle` constants keep their current values (see `src/components/TabBar/TabBar.tsx` for the baseline — unchanged).

### - [ ] Step 4: Adapt `EditorPane` to the new props

Replace the legacy `<TabBar>` call in `EditorPane.tsx` with:

```tsx
<TabBar
  pane={pane}
  isFocused={isFocused}
  documents={documents}
  onActivate={(id) => onActivateTab(pane.id, id)}
  onClose={(id) => onCloseTab(pane.id, id)}
  onOpenToSide={(id) => onOpenToSide(id)}
  onNew={onOpenFiles}
/>
```

### - [ ] Step 5: Run tests and typecheck

Run: `pnpm lint && pnpm test`

Expected: all pass.

### - [ ] Step 6: Commit

```bash
git add src/components/TabBar src/components/EditorPane/EditorPane.tsx
git commit -m "refactor(ui): TabBar accepts Pane prop, muted indicator when inactive"
```

---

## Task 7: Pane-aware `TopBar`

Same pattern as Task 6 — accept `pane: Pane` and `active: Document | null`; derive filename / wordCount / saveState / mode toggle / autosave switch from those. Caller (`EditorPane`) owns the conversion.

**Files:**
- Modify: `src/components/TopBar/TopBar.tsx`
- Modify: `src/components/EditorPane/EditorPane.tsx` — wire new props.

### - [ ] Step 1: Write the failing test

`src/components/TopBar/TopBar.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: "doc-1", path: "/a.md", content: "one two three", lastSavedContent: "",
    savedMtime: 1, isDirty: false, encoding: "utf-8", cursor: 0, scrollTop: 0,
    readOnly: false, previewWindowLabel: null, conflict: null,
    saveState: "idle", lastSaveError: null, autosaveEnabled: false,
    ...over,
  };
}

const pane: Pane = { id: "primary", tabs: ["doc-1"], activeTabId: "doc-1", viewMode: "edit" };

describe("TopBar", () => {
  it("renders filename + word count from the active doc", () => {
    render(<TopBar pane={pane} active={makeDoc()} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />);
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByLabelText(/word count/i).textContent).toMatch(/3 words/);
  });

  it("renders Untitled with 0 words when no active doc", () => {
    render(<TopBar pane={{ ...pane, activeTabId: null, tabs: [] }} active={null} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(screen.getByLabelText(/word count/i).textContent).toMatch(/0 words/);
  });

  it("reflects pane.viewMode in the toggle", () => {
    const { container } = render(
      <TopBar pane={pane} active={makeDoc()} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />,
    );
    const editBtn = screen.getByRole("button", { name: /^Edit$/ });
    expect(editBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
```

### - [ ] Step 2: Run tests; expect failure

Run: `pnpm test src/components/TopBar`

Expected: prop mismatch; tests fail.

### - [ ] Step 3: Update `TopBar.tsx` signature

Replace the `Props` interface:

```tsx
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

interface Props {
  pane: Pane;
  active: Document | null;
  onSetViewMode(mode: "edit" | "wysiwyg"): void;
  onSetAutosaveEnabled(enabled: boolean): void;
}
```

Inside the component, derive everything from `active` and `pane`, then render the same markup the baseline file uses. Keep the existing `wrap`, `meta`, `separator`, `segWrap`, `segBtn`, `autosaveWrap`, `switchTrack`, `switchThumb` style constants from `src/components/TopBar/TopBar.tsx` — do not reimplement them; only the props and a few derivations change:

```tsx
export function TopBar({ pane, active, onSetViewMode, onSetAutosaveEnabled }: Props) {
  const filename = active?.path ? active.path.split("/").pop() : "Untitled";
  const wordCount = (active?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  const isDirty = !!active?.isDirty;
  const saveState = active?.saveState ?? "idle";
  const autosaveEnabled = active?.autosaveEnabled ?? false;
  const viewMode = pane.viewMode;

  // Priority: dirty buffer should surface "Unsaved" even when saveState is
  // stale "saved" from a prior write (same as baseline).
  const saveLabel =
    saveState === "saving" ? "Saving…"
    : saveState === "failed" ? "Save failed"
    : isDirty ? "Unsaved"
    : saveState === "saved" ? "Saved"
    : "";

  return (
    <div className="app-topbar" style={wrap}>
      <div style={{ ...meta, color: "var(--text)", fontWeight: 500 }}>
        {isDirty && (
          <span
            aria-label="unsaved changes"
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--accent)", marginRight: 6,
            }}
          />
        )}
        <span style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
          {filename}
        </span>
      </div>
      <div style={separator} />
      <div style={meta}>
        <span aria-label="word count">
          {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
      {saveLabel && (
        <>
          <div style={separator} />
          <div style={meta}>
            <span style={{ color: saveState === "failed" ? "var(--danger)" : undefined }}>
              {saveLabel}
            </span>
          </div>
        </>
      )}
      <div style={{ flex: 1 }} />
      {active && (
        <label style={autosaveWrap} title="Autosave this document on every keystroke (debounced)">
          <span>Autosave</span>
          <button
            type="button"
            role="switch"
            aria-checked={autosaveEnabled}
            aria-label="Toggle autosave for this document"
            onClick={() => onSetAutosaveEnabled(!autosaveEnabled)}
            style={{ ...switchTrack(autosaveEnabled), border: 0, padding: 0 }}
          >
            <span style={switchThumb(autosaveEnabled)} aria-hidden="true" />
          </button>
        </label>
      )}
      <div style={segWrap} role="group" aria-label="View mode">
        <button
          type="button"
          style={segBtn(viewMode === "wysiwyg")}
          onClick={() => onSetViewMode("wysiwyg")}
          aria-pressed={viewMode === "wysiwyg"}
        >
          WYSIWYG
        </button>
        <button
          type="button"
          style={segBtn(viewMode === "edit")}
          onClick={() => onSetViewMode("edit")}
          aria-pressed={viewMode === "edit"}
        >
          Edit
        </button>
      </div>
    </div>
  );
}
```

### - [ ] Step 4: Update `EditorPane` to pass the new shape

In `EditorPane.tsx`:

```tsx
<TopBar
  pane={pane}
  active={active}
  onSetViewMode={(mode) => onSetViewMode(pane.id, mode)}
  onSetAutosaveEnabled={(enabled) =>
    active && useDocuments.getState().setAutosaveEnabled(active.id, enabled)
  }
/>
```

Import `useDocuments` at the top.

### - [ ] Step 5: Run tests and typecheck

Run: `pnpm lint && pnpm test`

Expected: all pass.

### - [ ] Step 6: Commit

```bash
git add src/components/TopBar src/components/EditorPane/EditorPane.tsx
git commit -m "refactor(ui): TopBar derives state from pane + active-doc props"
```

---

## Task 8: Render the secondary pane in `App.tsx` with a resize handle

Mount a second `EditorPane` when `secondary !== null`, add a `ResizeHandle` between the two, compute column widths from `paneSplit`.

**Files:**
- Modify: `src/App.tsx`

### - [ ] Step 1: Write a focused integration test

Append to `src/App.tsx`'s test (create `src/App.test.tsx` if it doesn't exist):

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { useDocuments } from "./state/documents";
import { useLayout } from "./state/layout";

beforeEach(() => {
  useDocuments.setState({ documents: [], folder: null });
  useLayout.setState({
    primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
    secondary: null,
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
});

describe("App — two panes", () => {
  it("renders only primary by default", () => {
    render(<App />);
    expect(screen.getAllByRole("region", { name: /pane/i })).toHaveLength(1);
  });

  it("renders both panes when secondary is set", () => {
    useDocuments.getState().openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
    useDocuments.getState().openDocument({ path: "/b.md", content: "b", savedMtime: 1, encoding: "utf-8" });
    const docs = useDocuments.getState().documents;
    useLayout.setState({
      primary: { id: "primary", tabs: [docs[0].id], activeTabId: docs[0].id, viewMode: "wysiwyg" },
      secondary: { id: "secondary", tabs: [docs[1].id], activeTabId: docs[1].id, viewMode: "wysiwyg" },
      focusedPaneId: "primary",
      paneSplit: 0.5,
    });
    render(<App />);
    expect(screen.getAllByRole("region", { name: /pane/i })).toHaveLength(2);
  });
});
```

### - [ ] Step 2: Run tests; expect failure

Run: `pnpm test src/App`

Expected: "renders both panes" test fails.

### - [ ] Step 3: Update `App.tsx` body

Inside `App()`, extend the layout computation. Replace the `bodyStyle` and the body return block to include both panes and a handle between them:

```tsx
const secondary = useLayout((s) => s.secondary);
const paneSplit = useLayout((s) => s.paneSplit);
const setPaneSplit = useLayout.getState().setPaneSplit;
const focusedPaneId = useLayout((s) => s.focusedPaneId);

// In bodyStyle, build the grid columns:
const templateParts: string[] = [];
if (showFolder) templateParts.push(`${folderWidth}px`, "4px");
if (showToc)    templateParts.push(`${tocWidth}px`, "4px");
if (secondary) {
  // Allocate fractional space between the two panes, proportional to paneSplit.
  templateParts.push(
    `minmax(320px, ${paneSplit}fr)`,
    "4px",
    `minmax(320px, ${1 - paneSplit}fr)`,
  );
} else {
  templateParts.push("minmax(320px, 1fr)");
}
```

For the body return:

```tsx
<div style={bodyStyle}>
  {showFolder && (
    <>
      <FolderPanel {...folderProps} />
      <ResizeHandle width={folderWidth} min={180} max={480} onChange={setFolderWidth} />
    </>
  )}
  {showToc && (
    <>
      <TocPanel {...tocProps} />
      <ResizeHandle width={tocWidth} min={180} max={480} onChange={setTocWidth} />
    </>
  )}
  <EditorPane
    pane={primary}
    isFocused={focusedPaneId === "primary"}
    {...paneProps}
  />
  {secondary && (
    <>
      <ResizeHandle
        width={Math.round(paneSplit * 1000)}
        min={200}
        max={800}
        onChange={(w) => setPaneSplit(w / 1000)}
      />
      <EditorPane
        pane={secondary}
        isFocused={focusedPaneId === "secondary"}
        {...paneProps}
      />
    </>
  )}
</div>
```

The `ResizeHandle` between panes uses a 1000-unit virtual scale mapped back into the 0.0–1.0 fraction; the component itself takes pixels, but we treat it as a fraction lever for now. (A dedicated fractional resize handle is YAGNI for v1.)

### - [ ] Step 4: Run tests and smoke-test

Run: `pnpm test src/App && pnpm tauri dev`

Manually: open two files, in the dev console run

```js
useLayout.getState().openToTheSide(useDocuments.getState().documents[1].id)
```

(or set secondary via Task 9's UI once implemented). Verify both panes render side by side and the handle drags.

### - [ ] Step 5: Commit

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(ui): render secondary pane with resize handle"
```

---

## Task 9: Open-to-the-Side gestures (⌘-click Folder + right-click tab menu)

**Files:**
- Create: `src/components/TabBar/TabContextMenu.tsx`
- Modify: `src/components/TabBar/TabBar.tsx` — intercept right-click, render the context menu.
- Modify: `src/components/FileTree/FileTree.tsx` — pass the native MouseEvent modifier state to `onOpenFile`.
- Modify: `src/components/Sidebar/FolderPanel.tsx` — accept both `onOpenFile(path, { toSide: boolean })` and the derived click handler.
- Modify: `src/App.tsx` — route ⌘-click through `useLayout.openToTheSide`.

### - [ ] Step 1: Write a failing TabContextMenu test

`src/components/TabBar/TabContextMenu.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabContextMenu } from "./TabContextMenu";

describe("TabContextMenu", () => {
  it("shows an 'Open to the Side' item and fires the callback", () => {
    const onOpenToSide = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        docId="doc-1"
        x={100}
        y={100}
        onOpenToSide={onOpenToSide}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/open to the side/i));
    expect(onOpenToSide).toHaveBeenCalledWith("doc-1");
    expect(onClose).toHaveBeenCalled();
  });
});
```

### - [ ] Step 2: Run tests; expect failure

Run: `pnpm test src/components/TabBar/TabContextMenu`

Expected: module not found.

### - [ ] Step 3: Implement `TabContextMenu`

`src/components/TabBar/TabContextMenu.tsx`:

```tsx
import { useEffect, useRef } from "react";

interface Props {
  docId: string;
  x: number;
  y: number;
  onOpenToSide(docId: string): void;
  onClose(): void;
}

export function TabContextMenu({ docId, x, y, onOpenToSide, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: y,
        left: x,
        minWidth: 180,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "4px 0",
        zIndex: 1000,
        fontSize: 13,
      }}
    >
      <button
        type="button"
        role="menuitem"
        style={{
          display: "block",
          width: "100%",
          padding: "6px 12px",
          border: 0,
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => {
          onOpenToSide(docId);
          onClose();
        }}
      >
        Open to the Side
      </button>
    </div>
  );
}
```

### - [ ] Step 4: Wire context menu into `TabBar`

In `TabBar.tsx`, add state and a handler:

```tsx
import { useState } from "react";
import { TabContextMenu } from "./TabContextMenu";

// inside component:
const [ctx, setCtx] = useState<{ docId: string; x: number; y: number } | null>(null);

// on each tab div:
onContextMenu={(e) => {
  e.preventDefault();
  setCtx({ docId: d.id, x: e.clientX, y: e.clientY });
}}

// at the end of the rendered output (after the + button):
{ctx && (
  <TabContextMenu
    docId={ctx.docId}
    x={ctx.x}
    y={ctx.y}
    onOpenToSide={(id) => onOpenToSide(id)}
    onClose={() => setCtx(null)}
  />
)}
```

### - [ ] Step 5: Write a failing FileTree modifier-click test

Append to `src/components/FileTree/FileTree.test.tsx`:

```tsx
it("forwards metaKey on file click", async () => {
  const onOpenFile = vi.fn();
  render(<FileTree root="/root" onOpenFile={onOpenFile} />);
  // Fixture provides `a.md`; simulate ⌘-click.
  const item = await screen.findByText("a.md");
  fireEvent.click(item, { metaKey: true });
  expect(onOpenFile).toHaveBeenCalledWith("/root/a.md", { toSide: true });
});
```

### - [ ] Step 6: Run tests; expect failure

Run: `pnpm test src/components/FileTree`

Expected: `onOpenFile` called with single arg, not the object.

### - [ ] Step 7: Extend `FileTree` onOpenFile signature

In `src/components/FileTree/FileTree.tsx`, change three things:

**(a)** Update the `Props` type:

```tsx
interface Props {
  root: string;
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
}
```

**(b)** Rename the existing `toggle(entry)` function to `handleActivate(entry, e?)` and plumb a modifier-aware file-branch. The directory branch (expand/collapse + `fsList`) keeps its current body verbatim — only the file branch changes:

```tsx
async function handleActivate(
  entry: DirEntry,
  e?: React.MouseEvent | React.KeyboardEvent,
) {
  if (!entry.is_dir) {
    const toSide = !!(e && "metaKey" in e && e.metaKey);
    onOpenFile(entry.path, toSide ? { toSide: true } : undefined);
    return;
  }
  // Directory branch — copy the current body of `toggle()` from the baseline
  // (`src/components/FileTree/FileTree.tsx` before this change), lines that
  // handle the `willExpand` / `setExpanded` / `cache.has(path)` / `fsList`
  // flow. No behavior change there.
  const path = entry.path;
  const willExpand = !expanded.has(path);
  setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });
  if (willExpand && !cache.has(path)) {
    try {
      const entries = await fsList(path);
      setCache((prev) => {
        const m = new Map(prev);
        m.set(path, entries);
        return m;
      });
    } catch (err) {
      console.warn("fsList failed:", path, err);
    }
  }
}
```

**(c)** Update every call site to forward the event. Near line 270 (the `onActivate` on the row):

```tsx
onActivate={(e) => handleActivate(entry, e)}
```

If there are additional click handlers elsewhere in the file that currently call `toggle(entry)`, change those to `handleActivate(entry, e)` as well. Search within the file:

```bash
grep -n "toggle(" src/components/FileTree/FileTree.tsx
```

and rewrite each match.

### - [ ] Step 8: Update `FolderPanel` + `App.tsx`

`FolderPanel.tsx` props:

```tsx
interface Props {
  folder: string | null;
  onPickFolder(): void;
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
  onClose?: () => void;
}
```

No other changes — just pass through.

`App.tsx` openFile wrapper becomes:

```tsx
async function openFile(path: string, opts?: { toSide: boolean }) {
  const existing = useDocuments.getState().documents.find((d) => d.path === path);
  if (existing) {
    if (opts?.toSide) useLayout.getState().openToTheSide(existing.id);
    else useLayout.getState().openInFocusedPane(existing.id);
    return;
  }
  const r = await fsRead(path);
  const id = openDocument({ path, content: r.content, savedMtime: r.mtime_ms, encoding: r.encoding });
  await watcherSubscribe(path);
  if (opts?.toSide) useLayout.getState().openToTheSide(id);
  // else: openDocument's bridge already called openInFocusedPane(id)
}
```

For the tab context menu: in `EditorPane` the `onOpenToSide` handler already calls `useLayout.getState().openToTheSide(id)` from Task 5 — nothing to change.

### - [ ] Step 9: Run tests + smoke

Run: `pnpm lint && pnpm test && pnpm tauri dev`

Manual:
- Right-click any tab → "Open to the Side" → doc opens in secondary pane.
- ⌘-click a file in Folder panel → opens as new tab in secondary (creating it if none).

### - [ ] Step 10: Commit

```bash
git add src/components/TabBar src/components/FileTree src/components/Sidebar/FolderPanel.tsx src/App.tsx
git commit -m "feat(ui): Open-to-the-Side via cmd-click folder and tab context menu"
```

---

## Task 10: Same-doc lock (secondary read-only when activeTabId pair matches)

**Files:**
- Modify: `src/components/EditorPane/EditorPane.tsx`

### - [ ] Step 1: Failing test

Append to `src/components/EditorPane/EditorPane.test.tsx`. Add the `noopHandlers` helper at the top of the file (under the existing imports):

```tsx
import { vi } from "vitest";

const noopHandlers = {
  onOpenFiles: vi.fn(),
  onOpenFolder: vi.fn(),
  onCloseTab: vi.fn(),
  onActivateTab: vi.fn(),
  onOpenToSide: vi.fn(),
  onSetViewMode: vi.fn(),
  onFocusPane: vi.fn(),
  onSetContent: vi.fn(),
};
```

Then the new test:

```tsx
it("forces readOnly on secondary when both panes show the same active doc", () => {
  useDocuments.getState().openDocument({
    path: "/a.md", content: "same", savedMtime: 1, encoding: "utf-8",
  });
  const docId = useDocuments.getState().documents[0].id;
  useLayout.setState({
    primary: { id: "primary", tabs: [docId], activeTabId: docId, viewMode: "wysiwyg" },
    secondary: { id: "secondary", tabs: [docId], activeTabId: docId, viewMode: "wysiwyg" },
    focusedPaneId: "secondary",
    paneSplit: 0.5,
  });
  const { container } = render(
    <EditorPane
      pane={useLayout.getState().secondary!}
      isFocused
      documents={useDocuments.getState().documents}
      otherPaneActiveTabId={docId}
      {...noopHandlers}
    />,
  );
  // The underlying editor should be mounted with contenteditable="false".
  const editable = container.querySelector("[contenteditable]");
  expect(editable?.getAttribute("contenteditable")).toBe("false");
});
```

### - [ ] Step 2: Run; expect failure

Run: `pnpm test src/components/EditorPane`

Expected: editable is `true` (secondary currently editable when focused).

### - [ ] Step 3: Add `otherPaneActiveTabId` prop and apply lock

In `EditorPane.tsx`:

```tsx
interface Props {
  pane: Pane;
  isFocused: boolean;
  documents: Document[];
  otherPaneActiveTabId: string | null; // NEW
  onOpenFiles(): void;
  onOpenFolder(): void;
  onCloseTab(paneId: "primary" | "secondary", docId: string): void;
  onActivateTab(paneId: "primary" | "secondary", docId: string): void;
  onOpenToSide(docId: string): void;
  onSetViewMode(paneId: "primary" | "secondary", mode: "edit" | "wysiwyg"): void;
  onFocusPane(paneId: "primary" | "secondary"): void;
  onSetContent(docId: string, next: string): void;
}
```

Add the new prop to the destructured parameter list, then compute the lock inside the body:

```tsx
const sameDocLock =
  pane.id === "secondary" &&
  active != null &&
  otherPaneActiveTabId === active.id;

const editable = isFocused && !sameDocLock && !active?.readOnly;
```

Replace the editor mounts (`<WysiwygEditor readOnly={active.readOnly || !isFocused} />` and the matching `<Editor ... />`) so `readOnly` is derived from `editable`:

```tsx
readOnly={!editable}
```

Thread `otherPaneActiveTabId` from `App.tsx` (update the two `<EditorPane>` mounts introduced in Task 8 — keep the `ResizeHandle` between them unchanged):

```tsx
<EditorPane
  pane={primary}
  isFocused={focusedPaneId === "primary"}
  otherPaneActiveTabId={secondary?.activeTabId ?? null}
  {...paneProps}
/>
{secondary && (
  <>
    <ResizeHandle
      width={Math.round(paneSplit * 1000)}
      min={200}
      max={800}
      onChange={(w) => setPaneSplit(w / 1000)}
    />
    <EditorPane
      pane={secondary}
      isFocused={focusedPaneId === "secondary"}
      otherPaneActiveTabId={primary.activeTabId}
      {...paneProps}
    />
  </>
)}
```

### - [ ] Step 4: Add the tooltip

In `EditorPane`, when `sameDocLock` is true, render a small banner at the top of the pane:

```tsx
{sameDocLock && (
  <div
    role="status"
    style={{
      fontSize: 11,
      color: "var(--text-muted)",
      padding: "4px 12px",
      background: "var(--bg-sidebar)",
      borderBottom: "1px solid var(--border)",
    }}
  >
    Read-only — edit from the primary pane.
  </div>
)}
```

### - [ ] Step 5: Update pre-existing EditorPane tests for the new required prop

`otherPaneActiveTabId` is now a required prop. The Task 5 test (`"renders the empty state when the pane has no active tab"`) needs `otherPaneActiveTabId={null}` added. Fix it in place:

```tsx
<EditorPane
  pane={useLayout.getState().primary}
  isFocused
  documents={[]}
  otherPaneActiveTabId={null}
  onOpenFiles={() => {}}
  // ... rest of the handler stubs as in Task 5
/>
```

(If you put the `noopHandlers` helper at the top of the file, use `{...noopHandlers}` instead of listing each stub.)

### - [ ] Step 6: Run tests + manual

Run: `pnpm lint && pnpm test && pnpm tauri dev`

Manual: right-click a tab → "Open to the Side" → same doc now in both panes. Confirm secondary's editor ignores typing, primary's works.

### - [ ] Step 7: Commit

```bash
git add src/App.tsx src/components/EditorPane
git commit -m "feat(ui): same-doc lock — secondary is read-only when activeTabIds match"
```

---

## Task 11: Outline follows focused pane

**Files:**
- Modify: `src/App.tsx` — Outline input becomes focused pane's active doc.

### - [ ] Step 1: Observe current behavior

`App.tsx` passes `headings` (computed from `active?.content`) and `onJump` into `TocPanel`. After Task 3, `active` is already derived from the focused pane's `activeTabId`, so this should already be correct. Verify with a test.

### - [ ] Step 2: Add a failing integration test

Append to `src/App.test.tsx`:

```tsx
function makeDoc(id: string, path: string, content: string): Document {
  return {
    id, path, content, lastSavedContent: content,
    savedMtime: 1, isDirty: false, encoding: "utf-8",
    cursor: 0, scrollTop: 0, readOnly: false,
    previewWindowLabel: null, conflict: null,
    saveState: "idle", lastSaveError: null, autosaveEnabled: false,
  };
}

it("Outline switches when focus moves between panes", async () => {
  useDocuments.setState({
    documents: [
      makeDoc("d1", "/a.md", "# Heading A"),
      makeDoc("d2", "/b.md", "# Heading B"),
    ],
    folder: null,
  });
  useLayout.setState({
    primary: { id: "primary", tabs: ["d1"], activeTabId: "d1", viewMode: "wysiwyg" },
    secondary: { id: "secondary", tabs: ["d2"], activeTabId: "d2", viewMode: "wysiwyg" },
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
  usePreferences.setState({ ...usePreferences.getState(), tocVisible: true });
  render(<App />);
  expect(screen.getByText("Heading A")).toBeInTheDocument();
  // Switch focus:
  useLayout.getState().setFocusedPane("secondary");
  await screen.findByText("Heading B");
});
```

### - [ ] Step 3: Run; expect pass if wired correctly, fix otherwise

Run: `pnpm test src/App`

Expected: passes. If it doesn't, inspect `headings = useMemo(..., [active?.content, active?.id])` — it should already rederive on `active` change. If reactivity is missing, ensure `active` is recomputed on every render via `useLayout` subscriptions (Task 3 should have done this).

### - [ ] Step 4: Commit

```bash
git add src/App.test.tsx src/App.tsx
git commit -m "test(ui): outline follows focused pane on pane-switch"
```

---

## Task 12: Session persistence + migration

**Files:**
- Modify: `src/state/sessionPersistence.ts`
- Modify: `src/state/sessionPersistence.test.ts`
- Modify: `src/App.tsx` — restore layout alongside docs on mount.

### - [ ] Step 1: Failing tests

In `src/state/sessionPersistence.test.ts`, add:

```ts
import { useLayout } from "./layout";

describe("sessionPersistence — layout", () => {
  it("round-trips two-pane layout", () => {
    useDocuments.setState({
      documents: [
        { id: "d1", path: "/a.md", /* ... */ } as any,
        { id: "d2", path: "/b.md", /* ... */ } as any,
      ],
      folder: "/repo",
    });
    useLayout.setState({
      primary: { id: "primary", tabs: ["d1"], activeTabId: "d1", viewMode: "edit" },
      secondary: { id: "secondary", tabs: ["d2"], activeTabId: "d2", viewMode: "wysiwyg" },
      focusedPaneId: "secondary",
      paneSplit: 0.6,
    });
    const s = startSessionPersistence();
    s();
    const loaded = loadPersistedSession();
    expect(loaded?.layout?.secondary?.activeTabPath).toBe("/b.md");
    expect(loaded?.layout?.focusedPaneId).toBe("secondary");
    expect(loaded?.layout?.paneSplit).toBe(0.6);
  });

  it("migrates old payload (no layout field) to single-pane primary", () => {
    localStorage.setItem(
      "yeogi-md-editor:session",
      JSON.stringify({ paths: ["/a.md", "/b.md"], activePath: "/b.md", folder: null }),
    );
    const loaded = loadPersistedSession();
    expect(loaded?.layout).toBeDefined();
    expect(loaded?.layout?.secondary).toBeNull();
    expect(loaded?.layout?.primary.tabPaths).toEqual(["/a.md", "/b.md"]);
    expect(loaded?.layout?.primary.activeTabPath).toBe("/b.md");
    expect(loaded?.layout?.focusedPaneId).toBe("primary");
  });
});
```

### - [ ] Step 2: Run tests; expect failures

Run: `pnpm test src/state/sessionPersistence`

Expected: `layout` field missing.

### - [ ] Step 3: Extend the persistence module

Replace contents of `src/state/sessionPersistence.ts`:

```ts
import { useDocuments } from "./documents";
import { useLayout } from "./layout";
import type { ViewMode, PaneId } from "./layout";

const KEY = "yeogi-md-editor:session";

interface PersistedPane {
  tabPaths: string[];
  activeTabPath: string | null;
  viewMode: ViewMode;
}

export interface PersistedLayout {
  primary: PersistedPane;
  secondary: PersistedPane | null;
  focusedPaneId: PaneId;
  paneSplit: number;
}

export interface PersistedSession {
  paths: string[];
  activePath: string | null;
  folder: string | null;
  layout: PersistedLayout;
}

function toPersistedPane(
  pane: { tabs: string[]; activeTabId: string | null; viewMode: ViewMode },
  docs: ReturnType<typeof useDocuments.getState>["documents"],
): PersistedPane {
  const tabPaths = pane.tabs
    .map((id) => docs.find((d) => d.id === id)?.path)
    .filter((p): p is string => typeof p === "string");
  const activeDoc = docs.find((d) => d.id === pane.activeTabId);
  return {
    tabPaths,
    activeTabPath: activeDoc?.path ?? null,
    viewMode: pane.viewMode,
  };
}

function snapshot(): PersistedSession {
  const docs = useDocuments.getState();
  const layout = useLayout.getState();
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const d of docs.documents) {
    if (d.path && !seen.has(d.path)) {
      seen.add(d.path);
      paths.push(d.path);
    }
  }
  const primary = toPersistedPane(layout.primary, docs.documents);
  const secondary = layout.secondary
    ? toPersistedPane(layout.secondary, docs.documents)
    : null;
  return {
    paths,
    activePath: primary.activeTabPath,
    folder: docs.folder,
    layout: {
      primary,
      secondary,
      focusedPaneId: layout.focusedPaneId,
      paneSplit: layout.paneSplit,
    },
  };
}

export function startSessionPersistence(): () => void {
  let last = "";
  const write = () => {
    const data = JSON.stringify(snapshot());
    if (data === last) return;
    last = data;
    try { localStorage.setItem(KEY, data); } catch { /* quota */ }
  };
  const unsubDocs = useDocuments.subscribe(write);
  const unsubLayout = useLayout.subscribe(write);
  return () => { unsubDocs(); unsubLayout(); };
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.paths)) return null;
    const paths = parsed.paths.filter((p: unknown): p is string => typeof p === "string");
    const activePath = typeof parsed.activePath === "string" ? parsed.activePath : null;
    const folder = typeof parsed.folder === "string" ? parsed.folder : null;
    // Migrate older payloads with no `layout` field.
    if (!parsed.layout) {
      return {
        paths, activePath, folder,
        layout: {
          primary: { tabPaths: paths, activeTabPath: activePath, viewMode: "wysiwyg" },
          secondary: null,
          focusedPaneId: "primary",
          paneSplit: 0.5,
        },
      };
    }
    return { paths, activePath, folder, layout: parsed.layout as PersistedLayout };
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
```

### - [ ] Step 4: Restore layout on startup in `App.tsx`

In the session-restore `useEffect` (after `loadPersistedSession()` returns):

```tsx
const persisted = loadPersistedSession();
if (persisted?.folder) useDocuments.getState().setFolder(persisted.folder);

// Re-open each path (existing code).
// AFTER all paths are loaded, rebuild the layout state:
if (persisted?.layout) {
  const docs = useDocuments.getState().documents;
  const pathToId = new Map<string, string>();
  for (const d of docs) if (d.path) pathToId.set(d.path, d.id);

  function buildPane(p: { tabPaths: string[]; activeTabPath: string | null; viewMode: "edit" | "wysiwyg" }, id: "primary" | "secondary") {
    const tabs = p.tabPaths.map((path) => pathToId.get(path)).filter((x): x is string => !!x);
    const activeTabId = p.activeTabPath ? pathToId.get(p.activeTabPath) ?? null : null;
    return { id, tabs, activeTabId, viewMode: p.viewMode };
  }

  const primary = buildPane(persisted.layout.primary, "primary");
  let secondary = persisted.layout.secondary
    ? buildPane(persisted.layout.secondary, "secondary")
    : null;
  if (secondary && secondary.tabs.length === 0) secondary = null;

  let focusedPaneId = persisted.layout.focusedPaneId;
  if (focusedPaneId === "secondary" && !secondary) focusedPaneId = "primary";

  useLayout.setState({
    primary,
    secondary,
    focusedPaneId,
    paneSplit: persisted.layout.paneSplit,
  });
}
```

### - [ ] Step 5: Run tests + smoke

Run: `pnpm lint && pnpm test && pnpm tauri dev`

Manual:
- Open two files, right-click → Open to the Side → secondary has the second file.
- Quit & relaunch: both panes restored with the same tabs and view modes.
- Delete the session key (DevTools → Application → Local Storage) and simulate an old payload: `localStorage.setItem("yeogi-md-editor:session", JSON.stringify({paths:["/a.md"],activePath:"/a.md",folder:null}))` → relaunch → loads single-pane with /a.md in primary.

### - [ ] Step 6: Commit

```bash
git add src/state/sessionPersistence.ts src/state/sessionPersistence.test.ts src/App.tsx
git commit -m "feat(state): persist layout (per-pane tabs, focus, split) with migration"
```

---

## Task 13: Integration + a11y polish

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/EditorPane/EditorPane.tsx` — `role="region"` + `aria-label` already added in Task 5; verify and augment.

### - [ ] Step 1: End-to-end flow tests

Add to `src/App.test.tsx`:

```tsx
it("right-click tab menu: Open to the Side creates secondary", () => {
  useDocuments.getState().openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
  render(<App />);
  const tab = screen.getByText("a.md").closest("[role=tab]")!;
  fireEvent.contextMenu(tab);
  fireEvent.click(screen.getByText(/open to the side/i));
  expect(useLayout.getState().secondary).not.toBeNull();
  expect(useLayout.getState().secondary!.tabs).toContain(
    useDocuments.getState().documents[0].id,
  );
});

it("closing the last tab in secondary collapses to single-pane", () => {
  useDocuments.getState().openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
  useDocuments.getState().openDocument({ path: "/b.md", content: "b", savedMtime: 1, encoding: "utf-8" });
  const docs = useDocuments.getState().documents;
  useLayout.setState({
    primary: { id: "primary", tabs: [docs[0].id], activeTabId: docs[0].id, viewMode: "wysiwyg" },
    secondary: { id: "secondary", tabs: [docs[1].id], activeTabId: docs[1].id, viewMode: "wysiwyg" },
    focusedPaneId: "secondary",
    paneSplit: 0.5,
  });
  render(<App />);
  // Close secondary's only tab
  const closeBtn = screen
    .getAllByLabelText(/close b\.md/i)[0];
  fireEvent.click(closeBtn);
  expect(useLayout.getState().secondary).toBeNull();
  expect(useLayout.getState().focusedPaneId).toBe("primary");
});

it("focus moves when the user clicks into the other pane's body", () => {
  useDocuments.getState().openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
  useDocuments.getState().openDocument({ path: "/b.md", content: "b", savedMtime: 1, encoding: "utf-8" });
  const docs = useDocuments.getState().documents;
  useLayout.setState({
    primary: { id: "primary", tabs: [docs[0].id], activeTabId: docs[0].id, viewMode: "wysiwyg" },
    secondary: { id: "secondary", tabs: [docs[1].id], activeTabId: docs[1].id, viewMode: "wysiwyg" },
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
  render(<App />);
  const regions = screen.getAllByRole("region", { name: /pane/i });
  fireEvent.click(regions[1]);
  expect(useLayout.getState().focusedPaneId).toBe("secondary");
});
```

### - [ ] Step 2: Verify a11y markup

In `EditorPane.tsx`, confirm the `main` element has `role="region"` and a stable `aria-label`. Inspect the rendered tablist scope — each pane's `TabBar` should internally render `role="tablist"` scoped to that pane (TabBar already does this).

Add a `data-testid` attribute on the outer `main` (the same element that already carries `role="region"`, `aria-label`, `onFocus`, `onClick` from Task 5) for test selectors in Task 13:

```tsx
<main
  style={{ /* keep the existing flex-column / minWidth / minHeight / overflow values from Task 5 */ }}
  data-testid={`editor-pane-${pane.id}`}
  role="region"
  aria-label={pane.id === "primary" ? "Primary pane" : "Secondary pane"}
  onFocus={() => onFocusPane(pane.id)}
  onClick={() => onFocusPane(pane.id)}
>
```

### - [ ] Step 3: Run all tests

Run: `pnpm lint && pnpm test`

Expected: all green.

### - [ ] Step 4: Manual regression run

Run: `pnpm tauri dev`

Walk through the full test plan:
- Single-pane: open file, switch tabs, mode toggle, autosave, find/replace — all unchanged.
- Split via right-click tab → Open to the Side → ✅.
- Split via ⌘-click in Folder → ✅.
- Drag the resize handle → widths adjust.
- Same doc in both panes → secondary shows the "Read-only — edit from the primary pane." banner; typing in secondary does nothing; typing in primary updates secondary live.
- Close last tab in secondary → collapses.
- Click into the other pane's body (different doc) → focus shifts; Outline updates.
- Quit → relaunch → two-pane layout restored.

### - [ ] Step 5: Commit

```bash
git add src/App.test.tsx src/components/EditorPane/EditorPane.tsx
git commit -m "test: integration coverage for side-by-side flows; a11y labels"
```

---

## Self-review checklist

- [ ] Spec §Architecture → Task 1, 3, 4 (useLayout schema; docs-store trim).
- [ ] Spec §Focus & editability rules → Task 10 (same-doc lock) + Task 5's `editable={isFocused && ...}`.
- [ ] Spec §Component changes → Tasks 5, 6, 7 (EditorPane, TabBar, TopBar).
- [ ] Spec §Data flow → Tasks 1, 4 (store actions).
- [ ] Spec §Flow 1/2 (open + open-to-the-side) → Task 9.
- [ ] Spec §Flow 3/4 (click tab / editor body) → handled in EditorPane (Task 5) + Task 13 (body-click test).
- [ ] Spec §Flow 5 (typing with shared buffer) → inherent once Task 3 + Task 5 land.
- [ ] Spec §Flow 6 (view mode per pane) → Task 7 + Task 4.
- [ ] Spec §Flow 7 (autosave / save / conflict) → unchanged behavior; conflict-banner suppression in Task 5 (primary-only render).
- [ ] Spec §Session persistence → Task 12 (incl. migration).
- [ ] Spec §Edge case 1 (open-to-side already in other pane) → Task 4 `openToTheSide` dedupe test.
- [ ] Spec §Edge case 2 (closing doc in both panes) → implicit via Task 4 `closeTab` semantics; covered by Task 13 test.
- [ ] Spec §Edge case 3 (conflict banner duplication) → Task 5 (primary-only render).
- [ ] Spec §Edge case 4/5 (dirty, path-rename) → unchanged behavior inherited.
- [ ] Spec §Edge case 6 (Find/Replace per focused pane) → inherent: ⌘F dispatches to `viewRef.current` which is the focused editor.
- [ ] Spec §Edge case 7 (Print/Export HTML per focused pane) → inherent: operates on `active`, which is focused-pane-derived.
- [ ] Spec §Edge case 8 (locked secondary keystrokes) → Task 10 banner + `editable: false`.
- [ ] Spec §Edge case 9 (window too narrow) → Task 8 `minmax(320px, ...fr)`.
- [ ] Spec §Edge case 10/11 (partial / failed restore) → Task 12 migration + fallback.
- [ ] Spec §Testing plan — unit, component, integration, a11y → Tasks 1, 4, 5, 6, 7, 9, 13.

No placeholders; all code blocks self-contained; types referenced consistently (`Pane`, `PaneId`, `ViewMode`, `PersistedLayout`).
