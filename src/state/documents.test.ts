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
