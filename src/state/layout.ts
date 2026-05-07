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
  openToTheSide(docId: string): void;
  /** Open `docId` in the pane OPPOSITE to `sourcePaneId`. From primary →
   *  secondary (creates secondary if null); from secondary → primary. */
  openInOtherPane(sourcePaneId: PaneId, docId: string): void;
  setActiveTab(paneId: PaneId, docId: string): void;
  setFocusedPane(paneId: PaneId): void;
  setViewMode(paneId: PaneId, mode: ViewMode): void;
  closeTab(paneId: PaneId, docId: string): void;
  /**
   * Move `docId` to the slot just before `beforeId` in the given pane,
   * or to the end if `beforeId` is null. Used by tab drag-and-drop.
   * No-op if either id isn't in the pane's tabs (defensive against
   * stale events from cross-pane drags).
   */
  reorderTabs(paneId: PaneId, docId: string, beforeId: string | null): void;
  setPaneSplit(fraction: number): void;
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

  openToTheSide(docId) {
    const { secondary } = get();
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
  },

  openInOtherPane(sourcePaneId, docId) {
    if (sourcePaneId === "primary") {
      // From the left pane: open in secondary (matches openToTheSide).
      get().openToTheSide(docId);
      return;
    }
    // From the right pane: open in primary, which is guaranteed to exist.
    const { primary } = get();
    if (primary.tabs.includes(docId)) {
      setPane(set, "primary", { ...primary, activeTabId: docId });
    } else {
      setPane(set, "primary", {
        ...primary,
        tabs: [...primary.tabs, docId],
        activeTabId: docId,
      });
    }
    set({ focusedPaneId: "primary" });
  },

  setPaneSplit(fraction) {
    const clamped = Math.max(0.2, Math.min(0.8, fraction));
    set({ paneSplit: clamped });
  },

  reorderTabs(paneId, docId, beforeId) {
    const pane = paneId === "primary" ? get().primary : get().secondary;
    if (!pane) return;
    if (!pane.tabs.includes(docId)) return;
    if (beforeId !== null && !pane.tabs.includes(beforeId)) return;
    if (docId === beforeId) return;
    const without = pane.tabs.filter((id) => id !== docId);
    let nextTabs: string[];
    if (beforeId === null) {
      nextTabs = [...without, docId];
    } else {
      const insertAt = without.indexOf(beforeId);
      nextTabs =
        insertAt === -1
          ? [...without, docId]
          : [...without.slice(0, insertAt), docId, ...without.slice(insertAt)];
    }
    if (nextTabs.length === pane.tabs.length &&
        nextTabs.every((id, i) => id === pane.tabs[i])) {
      // No-op: the target position is the same as the source position.
      return;
    }
    setPane(set, paneId, { ...pane, tabs: nextTabs });
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
