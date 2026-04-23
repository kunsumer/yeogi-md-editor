import { describe, it, expect, beforeEach } from "vitest";
import { useDocuments } from "./documents";

describe("useDocuments", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null });
  });

  it("openDocument adds a tab, sets active, conflict null", () => {
    const { openDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "hi", savedMtime: 1, encoding: "utf-8" });
    const s = useDocuments.getState();
    expect(s.documents).toHaveLength(1);
    expect(s.documents[0].id).toBe(id);
    expect(s.activeId).toBe(id);
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
    expect(useDocuments.getState().activeId).toBe(id1);
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
