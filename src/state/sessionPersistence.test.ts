import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPersistedSession,
  clearPersistedSession,
  startSessionPersistence,
} from "./sessionPersistence";
import { useDocuments } from "./documents";

describe("sessionPersistence", () => {
  beforeEach(() => {
    clearPersistedSession();
    useDocuments.setState({ documents: [], activeId: null });
  });

  it("loadPersistedSession returns null when nothing is stored", () => {
    expect(loadPersistedSession()).toBeNull();
  });

  it("subscribe writes paths and activePath after openDocument", () => {
    const stop = startSessionPersistence();
    try {
      const id = useDocuments
        .getState()
        .openDocument({ path: "/x.md", content: "hi", savedMtime: 1, encoding: "utf-8" });
      useDocuments.getState().setActive(id);
      const persisted = loadPersistedSession();
      expect(persisted).toEqual({ paths: ["/x.md"], activePath: "/x.md" });
    } finally {
      stop();
    }
  });

  it("ignores docs with null path (Untitled buffers)", () => {
    const stop = startSessionPersistence();
    try {
      useDocuments
        .getState()
        .openDocument({ path: null, content: "hi", savedMtime: 0, encoding: "utf-8" });
      const persisted = loadPersistedSession();
      expect(persisted).toEqual({ paths: [], activePath: null });
    } finally {
      stop();
    }
  });

  it("loadPersistedSession defends against malformed JSON", () => {
    localStorage.setItem("evhan-md-editor:session", "{not json");
    expect(loadPersistedSession()).toBeNull();
  });
});
