# Folder Explorer + Outline panels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current left sidebar into two independently toggleable panels (Folder Explorer + Outline) in a draggable three-column layout, add View-menu toggles with `⌥⌘1` / `⌥⌘2`, and persist visibility + widths + last-opened folder across restarts.

**Architecture:** Outer shell becomes a CSS grid (`bodyStyle` in `App.tsx`). Each panel is its own React component wrapped by a shared `AsidePanel` chrome. Visibility + widths live in `usePreferences` (persisted via `zustand/middleware`'s `persist`). Last-opened folder lives in `sessionPersistence` next to open tabs. Resize handles drag a local width and commit to the store on release so we get one `localStorage` write per drag.

**Tech Stack:** React 18 + TypeScript, Zustand (existing + `zustand/middleware` `persist`), Tauri 2 (menu reshape in `src-tauri/src/menu.rs`), vitest + `@testing-library/react`, jsdom (existing test env).

**Spec reference:** `docs/superpowers/specs/2026-04-22-folder-explorer-and-toc-panels-design.md`.

**File map (created / modified):**

Created:
- `src/components/Sidebar/AsidePanel.tsx`
- `src/components/Sidebar/FolderPanel.tsx`
- `src/components/Sidebar/TocPanel.tsx`
- `src/components/Sidebar/ResizeHandle.tsx`
- `src/components/Sidebar/index.ts`
- `src/components/Sidebar/AsidePanel.test.tsx`
- `src/components/Sidebar/FolderPanel.test.tsx`
- `src/components/Sidebar/TocPanel.test.tsx`
- `src/components/Sidebar/ResizeHandle.test.tsx`
- `src/state/preferences.test.ts`

Modified:
- `src/state/preferences.ts` (add fields + persist middleware)
- `src/state/sessionPersistence.ts` (add `folder` field)
- `src/state/sessionPersistence.test.ts` (round-trip folder)
- `src/App.tsx` (replace aside with 3-column grid, wire menus, remove brand header)
- `src-tauri/src/menu.rs` (View menu restructure + `file:close-folder`)
- `src/components/Tutorial/Tutorial.tsx` (two new shortcut rows)
- `src/lib/ipc/commands.ts` (add `fsStat` IPC binding if not present — see Task 2)

---

## Task 1: Preferences — add panel widths, visibility, and localStorage persistence

**Files:**
- Modify: `src/state/preferences.ts`
- Create: `src/state/preferences.test.ts`

- [ ] **Step 1: Read the current preferences file to see what's there**

Run: `cat src/state/preferences.ts`
Expected: a tiny Zustand store with only `autosaveEnabled` + `autosaveDebounceMs` + `setAutosaveEnabled`.

- [ ] **Step 2: Write the failing preferences test**

Create `src/state/preferences.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { usePreferences } from "./preferences";

describe("usePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset zustand store to fresh defaults between tests.
    usePreferences.setState({
      autosaveEnabled: true,
      autosaveDebounceMs: 500,
      folderVisible: true,
      tocVisible: true,
      folderWidth: 260,
      tocWidth: 220,
    });
  });

  it("defaults: folder + toc visible, folder 260px, toc 220px", () => {
    const s = usePreferences.getState();
    expect(s.folderVisible).toBe(true);
    expect(s.tocVisible).toBe(true);
    expect(s.folderWidth).toBe(260);
    expect(s.tocWidth).toBe(220);
  });

  it("clamps folderWidth into [180, 480]", () => {
    const { setFolderWidth } = usePreferences.getState();
    setFolderWidth(50);
    expect(usePreferences.getState().folderWidth).toBe(180);
    setFolderWidth(600);
    expect(usePreferences.getState().folderWidth).toBe(480);
    setFolderWidth(300);
    expect(usePreferences.getState().folderWidth).toBe(300);
  });

  it("clamps tocWidth into [180, 480]", () => {
    const { setTocWidth } = usePreferences.getState();
    setTocWidth(50);
    expect(usePreferences.getState().tocWidth).toBe(180);
    setTocWidth(600);
    expect(usePreferences.getState().tocWidth).toBe(480);
  });

  it("setFolderVisible + setTocVisible toggle the flags", () => {
    const { setFolderVisible, setTocVisible } = usePreferences.getState();
    setFolderVisible(false);
    setTocVisible(false);
    const s = usePreferences.getState();
    expect(s.folderVisible).toBe(false);
    expect(s.tocVisible).toBe(false);
  });

  it("persists changes to localStorage under yeogi-md-editor:prefs", () => {
    usePreferences.getState().setFolderWidth(300);
    const raw = localStorage.getItem("yeogi-md-editor:prefs");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.folderWidth).toBe(300);
  });
});
```

- [ ] **Step 3: Run the failing test**

Run: `pnpm -s test src/state/preferences.test.ts`
Expected: FAIL — `folderVisible` etc. don't exist on the store yet.

- [ ] **Step 4: Implement — extend preferences.ts with new fields + persist middleware**

Rewrite `src/state/preferences.ts`:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Prefs {
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  folderVisible: boolean;
  tocVisible: boolean;
  /** Pixel width of the Folder Explorer panel, clamped [180, 480]. */
  folderWidth: number;
  /** Pixel width of the Outline panel, clamped [180, 480]. */
  tocWidth: number;
  setAutosaveEnabled(v: boolean): void;
  setFolderVisible(v: boolean): void;
  setTocVisible(v: boolean): void;
  setFolderWidth(w: number): void;
  setTocWidth(w: number): void;
}

// Panels narrower than 180 px truncate tree item names aggressively; wider
// than 480 px eats too much of the editor column on a typical laptop screen.
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 480;
const clampWidth = (n: number) =>
  Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.round(n)));

export const usePreferences = create<Prefs>()(
  persist(
    (set) => ({
      autosaveEnabled: true,
      // Short idle debounce so saves feel immediate. useAutosave layers a
      // 2-second max-wait ceiling on top of this for continuous typing.
      autosaveDebounceMs: 500,
      folderVisible: true,
      tocVisible: true,
      folderWidth: 260,
      tocWidth: 220,
      setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
      setFolderVisible: (v) => set({ folderVisible: v }),
      setTocVisible: (v) => set({ tocVisible: v }),
      setFolderWidth: (w) => set({ folderWidth: clampWidth(w) }),
      setTocWidth: (w) => set({ tocWidth: clampWidth(w) }),
    }),
    {
      name: "yeogi-md-editor:prefs",
      storage: createJSONStorage(() => localStorage),
      // Only persist the value fields — setters are rebuilt on load.
      partialize: (s) => ({
        autosaveEnabled: s.autosaveEnabled,
        autosaveDebounceMs: s.autosaveDebounceMs,
        folderVisible: s.folderVisible,
        tocVisible: s.tocVisible,
        folderWidth: s.folderWidth,
        tocWidth: s.tocWidth,
      }),
    },
  ),
);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -s test src/state/preferences.test.ts`
Expected: all 5 assertions PASS.

- [ ] **Step 6: Run the full test suite to confirm nothing else broke**

Run: `pnpm -s tsc --noEmit && pnpm -s lint && pnpm -s test -- --run`
Expected: typecheck + lint clean; all tests pass (44 existing + 5 new = 49+).

- [ ] **Step 7: Commit**

```bash
git add src/state/preferences.ts src/state/preferences.test.ts
git commit -m "feat(prefs): persist panel visibility + widths via zustand persist"
```

---

## Task 2: Session persistence — add `folder` field with fsStat-on-use existence check

**Files:**
- Modify: `src/state/sessionPersistence.ts`
- Modify: `src/state/sessionPersistence.test.ts`
- Modify: `src/lib/ipc/commands.ts` (only if `fsStat` / equivalent isn't already exposed — check)

- [ ] **Step 1: Inspect the current session shape and IPC surface**

Run: `cat src/state/sessionPersistence.ts`
Run: `grep -n 'export async function' src/lib/ipc/commands.ts`

Expected: session stores `{ paths, activePath }`. IPC has `fsRead`, `fsWrite`, `fsList`, etc. Check whether `fsStat` or anything equivalent exists — if not, we'll piggy-back on `fsList` (which errors on missing paths) for the existence check in Task 8 rather than adding new IPC.

- [ ] **Step 2: Write the failing session-persistence test**

Append to `src/state/sessionPersistence.test.ts` (do NOT delete existing tests):

```ts
  it("persists and restores the open folder path", () => {
    const stop = startSessionPersistence();
    try {
      useDocuments.setState({ folder: "/Users/me/Notes" } as unknown as never);
      // Trigger a persistence cycle — the persistence listener flushes on
      // document changes, so nudge documents too.
      useDocuments.getState().openDocument({
        path: "/Users/me/Notes/a.md",
        content: "",
        savedMtime: 0,
        encoding: "utf-8",
      });
      const raw = localStorage.getItem("yeogi-md-editor:session");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.folder).toBe("/Users/me/Notes");
    } finally {
      stop();
    }
  });

  it("loadPersistedSession returns folder: null when absent", () => {
    localStorage.setItem(
      "yeogi-md-editor:session",
      JSON.stringify({ paths: [], activePath: null }),
    );
    const loaded = loadPersistedSession();
    expect(loaded?.folder ?? null).toBeNull();
  });
```

- [ ] **Step 3: Run the failing test**

Run: `pnpm -s test src/state/sessionPersistence.test.ts`
Expected: FAIL — `folder` is not in the persisted shape.

- [ ] **Step 4: Extend `sessionPersistence.ts`**

Modify `src/state/sessionPersistence.ts`:

1. Update the `PersistedSession` type:

```ts
export interface PersistedSession {
  paths: string[];
  activePath: string | null;
  folder: string | null;
}
```

2. Update `snapshot(...)` to include the folder. Since `folder` will live in `useDocuments` as of this change (not App-local state), add it there too:

Modify `src/state/documents.ts` `DocumentsState` interface and the store to include:

```ts
  folder: string | null;
  setFolder(path: string | null): void;
```

...with defaults `folder: null` and `setFolder: (p) => set({ folder: p })`. Insert these alongside `activeId`.

3. In `sessionPersistence.ts`, update `snapshot`:

```ts
function snapshot(state: ReturnType<typeof useDocuments.getState>): PersistedSession {
  return {
    paths: state.documents.map((d) => d.path).filter((p): p is string => p != null),
    activePath: state.documents.find((d) => d.id === state.activeId)?.path ?? null,
    folder: state.folder,
  };
}
```

4. Update `loadPersistedSession` to include `folder` in the returned shape (defaulting to `null` when absent):

```ts
export function loadPersistedSession(): PersistedSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    return {
      paths: Array.isArray(parsed.paths) ? parsed.paths : [],
      activePath: typeof parsed.activePath === "string" ? parsed.activePath : null,
      folder: typeof parsed.folder === "string" ? parsed.folder : null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -s test src/state/sessionPersistence.test.ts`
Expected: PASS, both new tests plus existing ones.

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm -s tsc --noEmit && pnpm -s test -- --run`
Expected: clean typecheck; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/state/sessionPersistence.ts src/state/sessionPersistence.test.ts src/state/documents.ts
git commit -m "feat(session): persist the last-opened folder path alongside tabs"
```

---

## Task 3: AsidePanel — shared panel chrome

**Files:**
- Create: `src/components/Sidebar/AsidePanel.tsx`
- Create: `src/components/Sidebar/AsidePanel.test.tsx`
- Create: `src/components/Sidebar/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar/AsidePanel.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AsidePanel } from "./AsidePanel";

describe("AsidePanel", () => {
  it("renders a title and its children in the body", () => {
    render(
      <AsidePanel title="Folder" ariaLabel="Folder Explorer">
        <div data-testid="child">hello</div>
      </AsidePanel>,
    );
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders an optional right-aligned action slot", () => {
    render(
      <AsidePanel
        title="Folder"
        ariaLabel="Folder Explorer"
        action={<button type="button">Pick…</button>}
      >
        <div />
      </AsidePanel>,
    );
    expect(screen.getByRole("button", { name: "Pick…" })).toBeInTheDocument();
  });

  it("exposes the panel as a complementary landmark with aria-label", () => {
    render(
      <AsidePanel title="Outline" ariaLabel="Outline">
        <div />
      </AsidePanel>,
    );
    expect(screen.getByRole("complementary", { name: "Outline" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm -s test src/components/Sidebar/AsidePanel.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `AsidePanel.tsx`**

Create `src/components/Sidebar/AsidePanel.tsx`:

```tsx
import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Accessible landmark label (visible title may be truncated). */
  ariaLabel: string;
  /** Optional right-aligned content inside the header — a button, menu trigger, etc. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for sidebar panels: a small header bar with a title and
 * optional action slot, plus a scrolling body. Used by FolderPanel and
 * TocPanel so both have identical visual treatment.
 */
export function AsidePanel({ title, ariaLabel, action, children }: Props) {
  return (
    <aside
      role="complementary"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px 8px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={title}
        >
          {title}
        </span>
        {action}
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "8px 8px 12px",
        }}
      >
        {children}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Create the barrel export**

Create `src/components/Sidebar/index.ts`:

```ts
export { AsidePanel } from "./AsidePanel";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -s test src/components/Sidebar/AsidePanel.test.tsx`
Expected: 3 PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm -s tsc --noEmit && pnpm -s lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar/AsidePanel.tsx src/components/Sidebar/AsidePanel.test.tsx src/components/Sidebar/index.ts
git commit -m "feat(sidebar): AsidePanel — shared header/body chrome for sidebar panels"
```

---

## Task 4: FolderPanel — wraps FileTree + empty / pick-folder state

**Files:**
- Create: `src/components/Sidebar/FolderPanel.tsx`
- Create: `src/components/Sidebar/FolderPanel.test.tsx`
- Modify: `src/components/Sidebar/index.ts`
- Modify: `src/components/FileTree/FileTree.tsx` (tiny empty-state addition)

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar/FolderPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderPanel } from "./FolderPanel";

vi.mock("../../lib/ipc/commands", () => ({
  fsList: vi.fn(async () => []),
}));

describe("FolderPanel", () => {
  it("shows an empty state with a Choose folder… button when no folder is set", () => {
    const onPickFolder = vi.fn();
    render(
      <FolderPanel folder={null} onPickFolder={onPickFolder} onOpenFile={() => {}} />,
    );
    expect(screen.getByText(/No folder open/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Choose folder/i });
    fireEvent.click(btn);
    expect(onPickFolder).toHaveBeenCalledTimes(1);
  });

  it("renders the folder basename in the panel header when a folder is set", () => {
    render(
      <FolderPanel
        folder="/Users/me/Notes"
        onPickFolder={() => {}}
        onOpenFile={() => {}}
      />,
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm -s test src/components/Sidebar/FolderPanel.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `FolderPanel.tsx`**

Create `src/components/Sidebar/FolderPanel.tsx`:

```tsx
import { FileTree } from "../FileTree";
import { AsidePanel } from "./AsidePanel";

interface Props {
  /** Absolute filesystem path; null means no folder has been picked yet. */
  folder: string | null;
  /** Called when the user clicks "Choose folder…" — App.tsx owns the dialog. */
  onPickFolder(): void;
  /** Forwarded to FileTree — opens the clicked file as a tab. */
  onOpenFile(path: string): void;
}

export function FolderPanel({ folder, onPickFolder, onOpenFile }: Props) {
  const title = folder ? (folder.split("/").pop() ?? "Folder") : "Folder";
  return (
    <AsidePanel title={title} ariaLabel="Folder Explorer">
      {folder == null ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "24px 8px",
            color: "var(--text-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          <span>No folder open.</span>
          <button type="button" className="btn-primary" onClick={onPickFolder}>
            Choose folder…
          </button>
        </div>
      ) : (
        <FileTree root={folder} onOpenFile={onOpenFile} />
      )}
    </AsidePanel>
  );
}
```

- [ ] **Step 4: Update FileTree to render an "Empty folder." state**

Modify `src/components/FileTree/FileTree.tsx` — find the existing conditional:

```tsx
if (!entries) return <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>Loading…</div>;
```

...and add a sibling conditional immediately below:

```tsx
if (entries.length === 0)
  return (
    <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>
      Empty folder.
    </div>
  );
```

- [ ] **Step 5: Export from the barrel**

Modify `src/components/Sidebar/index.ts`:

```ts
export { AsidePanel } from "./AsidePanel";
export { FolderPanel } from "./FolderPanel";
```

- [ ] **Step 6: Run the test**

Run: `pnpm -s test src/components/Sidebar/FolderPanel.test.tsx`
Expected: 2 PASS.

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm -s tsc --noEmit && pnpm -s lint`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/Sidebar/FolderPanel.tsx src/components/Sidebar/FolderPanel.test.tsx src/components/Sidebar/index.ts src/components/FileTree/FileTree.tsx
git commit -m "feat(sidebar): FolderPanel with empty state + Choose folder… action"
```

---

## Task 5: TocPanel — wraps TOC + empty states

**Files:**
- Create: `src/components/Sidebar/TocPanel.tsx`
- Create: `src/components/Sidebar/TocPanel.test.tsx`
- Modify: `src/components/Sidebar/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar/TocPanel.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TocPanel } from "./TocPanel";

describe("TocPanel", () => {
  it("shows the no-document empty state when no doc is open", () => {
    render(<TocPanel hasDocument={false} headings={[]} onJump={() => {}} />);
    expect(screen.getByText(/No document open/i)).toBeInTheDocument();
  });

  it("shows the no-headings empty state when the document has none", () => {
    render(<TocPanel hasDocument={true} headings={[]} onJump={() => {}} />);
    expect(screen.getByText(/No headings/i)).toBeInTheDocument();
  });

  it("renders each heading as a clickable row", () => {
    render(
      <TocPanel
        hasDocument={true}
        headings={[
          { level: 1, text: "Intro", line: 1 },
          { level: 2, text: "Context", line: 4 },
        ]}
        onJump={() => {}}
      />,
    );
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm -s test src/components/Sidebar/TocPanel.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `TocPanel.tsx`**

Create `src/components/Sidebar/TocPanel.tsx`:

```tsx
import { TOC } from "../TOC";
import type { Heading } from "../../lib/toc";
import { AsidePanel } from "./AsidePanel";

interface Props {
  hasDocument: boolean;
  headings: Heading[];
  onJump(h: Heading, index: number): void;
}

export function TocPanel({ hasDocument, headings, onJump }: Props) {
  const empty = !hasDocument
    ? "No document open."
    : headings.length === 0
      ? "No headings."
      : null;

  return (
    <AsidePanel title="Outline" ariaLabel="Outline">
      {empty ? (
        <div
          style={{
            padding: "16px 8px",
            color: "var(--text-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {empty}
        </div>
      ) : (
        <TOC headings={headings} onJump={onJump} />
      )}
    </AsidePanel>
  );
}
```

- [ ] **Step 4: Export from the barrel**

Modify `src/components/Sidebar/index.ts`:

```ts
export { AsidePanel } from "./AsidePanel";
export { FolderPanel } from "./FolderPanel";
export { TocPanel } from "./TocPanel";
```

- [ ] **Step 5: Run the test**

Run: `pnpm -s test src/components/Sidebar/TocPanel.test.tsx`
Expected: 3 PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm -s tsc --noEmit && pnpm -s lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar/TocPanel.tsx src/components/Sidebar/TocPanel.test.tsx src/components/Sidebar/index.ts
git commit -m "feat(sidebar): TocPanel with no-document + no-headings empty states"
```

---

## Task 6: ResizeHandle — keyboard-accessible draggable divider

**Files:**
- Create: `src/components/Sidebar/ResizeHandle.tsx`
- Create: `src/components/Sidebar/ResizeHandle.test.tsx`
- Modify: `src/components/Sidebar/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/Sidebar/ResizeHandle.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  it("exposes a vertical separator with aria value attrs", () => {
    render(<ResizeHandle width={260} min={180} max={480} onChange={() => {}} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "vertical");
    expect(sep).toHaveAttribute("aria-valuenow", "260");
    expect(sep).toHaveAttribute("aria-valuemin", "180");
    expect(sep).toHaveAttribute("aria-valuemax", "480");
  });

  it("ArrowRight / ArrowLeft nudge width by 16 within [min, max]", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={260} min={180} max={480} onChange={onChange} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(276);
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(244);
  });

  it("Home and End jump to min and max", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={260} min={180} max={480} onChange={onChange} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(180);
    fireEvent.keyDown(sep, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(480);
  });

  it("does not go below min when already at min", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={180} min={180} max={480} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(180);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm -s test src/components/Sidebar/ResizeHandle.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ResizeHandle.tsx`**

Create `src/components/Sidebar/ResizeHandle.tsx`:

```tsx
import { useCallback, useRef } from "react";

interface Props {
  width: number;
  min: number;
  max: number;
  /**
   * Called during drag with a candidate width. Parent decides whether to
   * commit immediately or buffer — most callers just thread it into their
   * render-time width and flush to preferences on pointerup.
   */
  onChange(next: number): void;
  /**
   * Optional — called exactly once when the user finishes dragging (pointer
   * release or keyboard keyup). Use this hook to persist the committed value
   * to localStorage without writing on every pointermove.
   */
  onCommit?(next: number): void;
}

const KEY_STEP = 16;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Thin vertical divider between sidebar columns. Pointer drag updates the
 * adjacent panel's width live; keyboard arrows nudge it in 16 px steps;
 * Home / End jump to the clamp bounds.
 */
export function ResizeHandle({ width, min, max, onChange, onCommit }: Props) {
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      const next = clamp(s.startWidth + (e.clientX - s.startX), min, max);
      onChange(next);
    },
    [min, max, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
      const next = clamp(s.startWidth + (e.clientX - s.startX), min, max);
      dragState.current = null;
      onCommit?.(next);
    },
    [min, max, onCommit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next = width;
      if (e.key === "ArrowLeft") next = clamp(width - KEY_STEP, min, max);
      else if (e.key === "ArrowRight") next = clamp(width + KEY_STEP, min, max);
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      else return;
      e.preventDefault();
      onChange(next);
      onCommit?.(next);
    },
    [width, min, max, onChange, onCommit],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      style={{
        width: 4,
        cursor: "col-resize",
        background: "transparent",
        touchAction: "none",
        userSelect: "none",
      }}
    />
  );
}
```

- [ ] **Step 4: Export from the barrel**

Modify `src/components/Sidebar/index.ts`:

```ts
export { AsidePanel } from "./AsidePanel";
export { FolderPanel } from "./FolderPanel";
export { TocPanel } from "./TocPanel";
export { ResizeHandle } from "./ResizeHandle";
```

- [ ] **Step 5: Run the test**

Run: `pnpm -s test src/components/Sidebar/ResizeHandle.test.tsx`
Expected: 4 PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm -s tsc --noEmit && pnpm -s lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar/ResizeHandle.tsx src/components/Sidebar/ResizeHandle.test.tsx src/components/Sidebar/index.ts
git commit -m "feat(sidebar): ResizeHandle — pointer + keyboard draggable divider"
```

---

## Task 7: App shell — replace single aside with three-column grid

**Files:**
- Modify: `src/App.tsx`

This is the integration task. We rewrite the sidebar block to use the new components, compose widths + visibility from `usePreferences`, remove the brand header, and plumb `folder` from `useDocuments`.

- [ ] **Step 1: Identify the blocks to change**

Run: `grep -n 'asideStyle\|asideHeaderStyle\|asideBodyStyle\|asideSectionLabelStyle\|brandStyle\|{folder &&\|{active && (' src/App.tsx`

Expected: matches around lines 40-100 (style constants), ~517-526 (brand header), ~599-619 (aside body). Note the exact line numbers — they shift as we go.

- [ ] **Step 2: Remove the obsolete style constants**

In `src/App.tsx`, delete these constants (they're no longer used once the aside is replaced):
- `asideStyle`
- `asideHeaderStyle`
- `asideBodyStyle`
- `asideSectionLabelStyle`
- `brandStyle`

Also remove the unused imports `Logo`, `APP_VERSION_LABEL` if nothing else uses them (Tutorial still imports Logo directly from `./Logo`, so the App.tsx import can be dropped). Verify with:

```bash
grep -n 'Logo\|APP_VERSION_LABEL' src/App.tsx
```

If the only references are to the deleted brand block, remove those imports.

- [ ] **Step 3: Wire the new imports**

Near the top of `src/App.tsx` add:

```ts
import { FolderPanel, ResizeHandle, TocPanel } from "./components/Sidebar";
```

- [ ] **Step 4: Replace the `bodyStyle` + `aside` render block**

Find the existing `bodyStyle` definition:

```ts
const bodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: sidebarVisible ? "260px 1fr" : "1fr",
};
```

Replace with:

```ts
// Three-column layout: [Folder] [Outline] [Editor]. Columns collapse when
// their panel is hidden. Widths come from usePreferences so they persist.
const folder = useDocuments((s) => s.folder);
const folderVisible = usePreferences((s) => s.folderVisible);
const tocVisible = usePreferences((s) => s.tocVisible);
const folderWidth = usePreferences((s) => s.folderWidth);
const tocWidth = usePreferences((s) => s.tocWidth);
const { setFolderWidth, setTocWidth } = usePreferences.getState();

const showFolder = folderVisible && folder != null;
const showToc = tocVisible && active != null;

const templateParts: string[] = [];
if (showFolder) templateParts.push(`${folderWidth}px`, "4px");
if (showToc) templateParts.push(`${tocWidth}px`, "4px");
templateParts.push("minmax(320px, 1fr)");

const bodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: templateParts.join(" "),
};
```

- [ ] **Step 5: Replace the `{sidebarVisible && <aside …>}` block with the panel triplet**

Find and delete the entire `{sidebarVisible && (...)}` block. Replace with:

```tsx
{showFolder && (
  <>
    <FolderPanel
      folder={folder}
      onPickFolder={() => pickAndOpenFolder().catch(console.error)}
      onOpenFile={(p) => openFile(p).catch(console.error)}
    />
    <ResizeHandle
      width={folderWidth}
      min={180}
      max={480}
      onChange={setFolderWidth}
    />
  </>
)}
{showToc && (
  <>
    <TocPanel
      hasDocument={active != null}
      headings={headings}
      onJump={(h, i) => jumpToHeading(h.line, i)}
    />
    <ResizeHandle
      width={tocWidth}
      min={180}
      max={480}
      onChange={setTocWidth}
    />
  </>
)}
```

- [ ] **Step 6: Replace `setFolder` call site from App-local state to store**

In App.tsx there's currently:
```ts
const [folder, setFolder] = useState<string | null>(null);
```

Delete that line (folder now comes from `useDocuments` — Step 4 already added the selector). Update every remaining reference:

- `pickAndOpenFolder()` — change `setFolder(picked)` to `useDocuments.getState().setFolder(picked)`.
- Any other read of `folder` now comes from the selector at the top of the component (Step 4).

Run to find all call sites:
```bash
grep -n 'setFolder\|\\bfolder\\b' src/App.tsx
```

- [ ] **Step 7: Typecheck + lint**

Run: `pnpm -s tsc --noEmit && pnpm -s lint`
Expected: clean. If `sidebarVisible` is still referenced elsewhere (e.g., the old `⌘\\` handler), delete those references — they'll be replaced in Task 11.

- [ ] **Step 8: Run the full test suite**

Run: `pnpm -s test -- --run`
Expected: all previous tests pass (no regressions). No new tests added yet in this task — integration is manual.

- [ ] **Step 9: Manual smoke test**

Run: `pnpm tauri dev` (launch in background if preferred)
Verify: when you open a folder via `File → Open Folder…`, the left panel appears with the tree; opening a file shows the outline panel in the middle; each divider drags; widths persist after relaunch.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): three-column layout — FolderPanel + TocPanel with draggable dividers"
```

---

## Task 8: Lazy folder-existence check on startup

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/lib/ipc/commands.ts` (only if `fsList` is the existence check — it already is)

Rationale: if the saved folder was deleted externally between sessions, we drop it silently rather than showing a broken tree.

- [ ] **Step 1: Add the useEffect to App.tsx**

Near the other startup `useEffect`s in App.tsx (look for `loadPersistedSession`):

```ts
// If the persisted folder no longer exists on disk, silently clear it.
// Runs once on mount; session-load precedes this so `folder` is already
// in place by the time we check.
useEffect(() => {
  const f = useDocuments.getState().folder;
  if (!f) return;
  fsList(f).catch(() => {
    useDocuments.getState().setFolder(null);
  });
}, []);
```

If `fsList` isn't imported in App.tsx yet, add:

```ts
import { ensureWelcomeFile, fsList, fsRead, fsWrite, watcherSubscribe } from "./lib/ipc/commands";
```

- [ ] **Step 2: Typecheck + full suite**

Run: `pnpm -s tsc --noEmit && pnpm -s test -- --run`
Expected: clean.

- [ ] **Step 3: Manual smoke test**

Open a folder, quit the app, delete that folder on disk, relaunch. The folder panel should fall back to the empty state (or stay hidden because `showFolder = folderVisible && folder != null`).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(session): drop persisted folder if it no longer exists on startup"
```

---

## Task 9: Rust — View menu restructure

**Files:**
- Modify: `src-tauri/src/menu.rs`

- [ ] **Step 1: Read the current View submenu**

Run: `grep -n 'view:' src-tauri/src/menu.rs`
Expected: existing ids are `view:toggle-sidebar`, `view:cycle-theme`, `view:zoom-*`.

- [ ] **Step 2: Rewrite the `view` submenu block**

In `src-tauri/src/menu.rs`, find the View submenu and replace the body (keep zoom/theme) with:

```rust
    let view = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("view:toggle-folder-panel", "Folder Explorer")
                .accelerator("Alt+CmdOrCtrl+1")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:toggle-toc-panel", "Outline")
                .accelerator("Alt+CmdOrCtrl+2")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:hide-all-sidebars", "Hide Both Sidebars")
                .accelerator("CmdOrCtrl+Backslash")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("view:cycle-theme", "Cycle Theme")
                .accelerator("CmdOrCtrl+T")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("view:zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view:zoom-reset", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .build()?;
```

Note: the old `view:toggle-sidebar` id is gone. The frontend handler for it will be replaced in Task 11.

- [ ] **Step 3: Build-check the Rust side**

Run: `cd src-tauri && cargo check`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/menu.rs
git commit -m "feat(menu): View menu — separate Folder / Outline toggles + Hide Both"
```

---

## Task 10: Rust — add File → Close Folder

**Files:**
- Modify: `src-tauri/src/menu.rs`

- [ ] **Step 1: Insert the item under File**

In `src-tauri/src/menu.rs`, find the File submenu. After `file:close-tab`, add:

```rust
        .separator()
        .item(
            &MenuItemBuilder::with_id("file:close-folder", "Close Folder")
                .build(app)?,
        )
```

No accelerator — this is a rare action.

- [ ] **Step 2: Build-check**

Run: `cd src-tauri && cargo check`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/menu.rs
git commit -m "feat(menu): File → Close Folder"
```

---

## Task 11: Frontend — wire new menu events + ⌘\\ memory

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Find the menu event listener**

Run: `grep -n '"menu"\|case "view:\|case "help:' src/App.tsx`
Expected: a `listen<string>("menu", ...)` block with a switch on `e.payload`.

- [ ] **Step 2: Add a remembered-state ref for ⌘\\**

At the top of the App component, alongside other refs:

```ts
// Remembers the last (folderVisible, tocVisible) pair before Hide Both
// collapsed them, so the second ⌘\ restores the user's setup.
const preHideStateRef = useRef<{ folder: boolean; toc: boolean } | null>(null);
```

- [ ] **Step 3: Add the menu-event cases**

In the `switch (id)` block inside `listen<string>("menu", ...)`, add / replace:

```ts
case "view:toggle-folder-panel": {
  const { folderVisible, setFolderVisible } = usePreferences.getState();
  setFolderVisible(!folderVisible);
  preHideStateRef.current = null;
  break;
}
case "view:toggle-toc-panel": {
  const { tocVisible, setTocVisible } = usePreferences.getState();
  setTocVisible(!tocVisible);
  preHideStateRef.current = null;
  break;
}
case "view:hide-all-sidebars": {
  const { folderVisible, tocVisible, setFolderVisible, setTocVisible } =
    usePreferences.getState();
  if (folderVisible || tocVisible) {
    preHideStateRef.current = { folder: folderVisible, toc: tocVisible };
    setFolderVisible(false);
    setTocVisible(false);
  } else {
    const restore = preHideStateRef.current ?? { folder: true, toc: true };
    setFolderVisible(restore.folder);
    setTocVisible(restore.toc);
    preHideStateRef.current = null;
  }
  break;
}
case "file:close-folder": {
  useDocuments.getState().setFolder(null);
  break;
}
```

Also **delete** any remaining `case "view:toggle-sidebar":` branch.

- [ ] **Step 4: Remove the obsolete `sidebarVisible` local state**

If not already gone in Task 7, delete:

```ts
const [sidebarVisible, setSidebarVisible] = useState(true);
```

and any remaining references.

- [ ] **Step 5: Typecheck + full suite**

Run: `pnpm -s tsc --noEmit && pnpm -s lint && pnpm -s test -- --run`
Expected: clean.

- [ ] **Step 6: Manual smoke test**

- `⌥⌘1` toggles the folder panel (visible / hidden).
- `⌥⌘2` toggles the outline panel.
- `⌘\\` hides both; pressing it again restores both.
- `File → Close Folder` clears the folder; folder panel falls back to "No folder open" (if visible).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire menu events — panel toggles, Hide Both memory, Close Folder"
```

---

## Task 12: Tutorial — two new shortcut rows

**Files:**
- Modify: `src/components/Tutorial/Tutorial.tsx`

- [ ] **Step 1: Locate the shortcuts slide**

Run: `grep -n 'Folder Explorer\|Toggle Sidebar\|tutorial-shortcuts' src/components/Tutorial/Tutorial.tsx`
Expected: the shortcuts grid near the end of `STEPS`.

- [ ] **Step 2: Add the two new rows**

In the `<div className="tutorial-shortcuts">` block, insert just below the existing `⌘\\` row (or near the other View-related shortcuts):

```tsx
<kbd>⌥⌘1</kbd><span>Folder Explorer</span>
<kbd>⌥⌘2</kbd><span>Outline</span>
```

And update the existing `⌘\\` label from `Toggle sidebar` → `Hide both sidebars`.

- [ ] **Step 3: Typecheck + test**

Run: `pnpm -s tsc --noEmit && pnpm -s test -- --run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/Tutorial/Tutorial.tsx
git commit -m "docs(tutorial): add ⌥⌘1 / ⌥⌘2 panel toggles, rename ⌘\\"
```

---

## Task 13: Final verification

- [ ] **Step 1: All tests + lint + typecheck**

Run: `pnpm -s tsc --noEmit && pnpm -s lint && pnpm -s test -- --run`
Expected: typecheck clean; lint clean; test count previous + 14 (5 prefs + 3 AsidePanel + 2 FolderPanel + 3 TocPanel + 4 ResizeHandle — minus `sessionPersistence` 1-2 new tests, so ~+14).

- [ ] **Step 2: Rust build**

Run: `cd src-tauri && cargo check --tests`
Expected: clean.

- [ ] **Step 3: Full smoke-test script**

Launch `pnpm tauri dev`. Walk through each success criterion from the spec (§10):

1. `File → Open Folder…` populates the left panel.
2. Clicking a file in the tree opens it; duplicate click doesn't make a second tab.
3. TOC panel shows active doc's headings; click jumps.
4. `⌥⌘1`, `⌥⌘2`, `⌘\\` toggle as specified.
5. Dragging dividers resizes; widths persist across restart.
6. Restart restores folder + visibility + widths.
7. `File → Close Folder` clears folder; panel falls back to empty state.
8. Type a file that doesn't exist into the session JSON (or delete the folder externally) then relaunch — folder is silently dropped.

- [ ] **Step 4: Commit if any tiny fixes found during smoke test**

```bash
# only if needed
git commit -m "fix(sidebar): <describe>"
```

---

## Notes / known follow-ups (deliberately out of scope)

- **Native menu check-marks** on Folder Explorer / Outline items. Today we rely on the in-app UI to reflect panel visibility. Adding `CheckMenuItemBuilder` + retained handles would require a small Rust refactor; tracked separately.
- **Folder-deletion watcher** that auto-clears the folder when the directory disappears while the app is running.
- **Side-by-side document panes** (second editor column). The three-column grid is already the scaffolding, but splitting the editor itself is its own spec.
