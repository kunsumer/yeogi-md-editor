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
    useDocuments.setState({ documents: [], activeId: null, folder: null });
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
      expect(persisted).toEqual({ paths: ["/x.md"], activePath: "/x.md", folder: null });
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
      expect(persisted).toEqual({ paths: [], activePath: null, folder: null });
    } finally {
      stop();
    }
  });

  it("loadPersistedSession defends against malformed JSON", () => {
    localStorage.setItem("yeogi-md-editor:session", "{not json");
    expect(loadPersistedSession()).toBeNull();
  });

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
});
