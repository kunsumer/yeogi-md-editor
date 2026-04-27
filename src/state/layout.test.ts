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

  describe("reorderTabs", () => {
    beforeEach(() => {
      reset();
      useLayout.getState().openInFocusedPane("a");
      useLayout.getState().openInFocusedPane("b");
      useLayout.getState().openInFocusedPane("c");
      useLayout.getState().openInFocusedPane("d");
      // Tabs: [a, b, c, d]
    });

    it("moves a tab earlier in the list (drag c before a)", () => {
      useLayout.getState().reorderTabs("primary", "c", "a");
      expect(useLayout.getState().primary.tabs).toEqual(["c", "a", "b", "d"]);
    });

    it("moves a tab later in the list (drag a before d)", () => {
      useLayout.getState().reorderTabs("primary", "a", "d");
      expect(useLayout.getState().primary.tabs).toEqual(["b", "c", "a", "d"]);
    });

    it("appends to the end when beforeId is null", () => {
      useLayout.getState().reorderTabs("primary", "a", null);
      expect(useLayout.getState().primary.tabs).toEqual(["b", "c", "d", "a"]);
    });

    it("is a no-op when target position equals current position", () => {
      // Dragging "a" "before a" is a self-drop.
      useLayout.getState().reorderTabs("primary", "a", "a");
      expect(useLayout.getState().primary.tabs).toEqual(["a", "b", "c", "d"]);
    });

    it("ignores reorders for unknown tabs (stale events)", () => {
      useLayout.getState().reorderTabs("primary", "ghost", "a");
      useLayout.getState().reorderTabs("primary", "a", "ghost");
      expect(useLayout.getState().primary.tabs).toEqual(["a", "b", "c", "d"]);
    });

    it("does not change activeTabId on reorder", () => {
      useLayout.getState().setActiveTab("primary", "b");
      useLayout.getState().reorderTabs("primary", "b", null);
      const s = useLayout.getState();
      expect(s.primary.tabs).toEqual(["a", "c", "d", "b"]);
      expect(s.primary.activeTabId).toBe("b");
    });
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
