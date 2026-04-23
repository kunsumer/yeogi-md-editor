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
