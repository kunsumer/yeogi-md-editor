import { describe, it, expect, beforeEach } from "vitest";
import { useDocuments } from "./documents";
import { useLayout } from "./layout";

describe("useDocuments", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [] });
  });

  it("openDocument adds a tab, sets active, conflict null", () => {
    const { openDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "hi", savedMtime: 1, encoding: "utf-8" });
    const s = useDocuments.getState();
    expect(s.documents).toHaveLength(1);
    expect(s.documents[0].id).toBe(id);
    expect(s.documents[0].conflict).toBeNull();
  });

  it("setContent marks dirty when content differs from last saved", () => {
    const { openDocument, setContent } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "orig", savedMtime: 1, encoding: "utf-8" });
    setContent(id, "orig edited");
    expect(useDocuments.getState().documents[0].isDirty).toBe(true);
  });

  it("openDocument with the same path returns the existing id, no duplicate", () => {
    const { openDocument } = useDocuments.getState();
    const id1 = openDocument({ path: "/a.md", content: "v1", savedMtime: 1, encoding: "utf-8" });
    const id2 = openDocument({ path: "/a.md", content: "v1", savedMtime: 1, encoding: "utf-8" });
    expect(id2).toBe(id1);
    expect(useDocuments.getState().documents).toHaveLength(1);
    expect(useLayout.getState().primary.activeTabId).toBe(id1);
  });

  it("openDocument allows multiple Untitled (path: null) buffers", () => {
    const { openDocument } = useDocuments.getState();
    const id1 = openDocument({ path: null, content: "", savedMtime: 0, encoding: "utf-8" });
    const id2 = openDocument({ path: null, content: "", savedMtime: 0, encoding: "utf-8" });
    expect(id2).not.toBe(id1);
    expect(useDocuments.getState().documents).toHaveLength(2);
  });

  it("markSaved clears dirty and updates savedMtime", () => {
    const { openDocument, setContent, markSaved } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "orig", savedMtime: 1, encoding: "utf-8" });
    setContent(id, "changed");
    markSaved(id, { content: "changed", mtimeMs: 2 });
    const d = useDocuments.getState().documents[0];
    expect(d.isDirty).toBe(false);
    expect(d.savedMtime).toBe(2);
  });
});

describe("useDocuments → useLayout bridge", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], folder: null });
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

  it("closeDocument removes only the buffer; pane tabs are App-level state", () => {
    // Pane-aware tab removal moved to App.tsx (`requestClosePaneTab`) so that
    // closing a tab in one pane doesn't evict the doc from the other side
    // when case (d) has it in both.
    const { openDocument, closeDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "x", savedMtime: 1, encoding: "utf-8" });
    closeDocument(id);
    expect(useDocuments.getState().documents).toHaveLength(0);
    // Pane state is untouched — callers route the tab removal through
    // useLayout.closeTab themselves.
    expect(useLayout.getState().primary.tabs).toEqual([id]);
  });
});
