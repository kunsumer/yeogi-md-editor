import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPersistedSession,
  clearPersistedSession,
  startSessionPersistence,
} from "./sessionPersistence";
import { useDocuments } from "./documents";
import { useLayout } from "./layout";

describe("sessionPersistence", () => {
  beforeEach(() => {
    clearPersistedSession();
    useDocuments.setState({ documents: [], folder: null });
    useLayout.setState({
      primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
      secondary: null,
      focusedPaneId: "primary",
      paneSplit: 0.5,
    });
  });

  it("loadPersistedSession returns null when nothing is stored", () => {
    expect(loadPersistedSession()).toBeNull();
  });

  it("subscribe writes paths and activePath after openDocument", () => {
    const stop = startSessionPersistence();
    try {
      useDocuments
        .getState()
        .openDocument({ path: "/x.md", content: "hi", savedMtime: 1, encoding: "utf-8" });
      const persisted = loadPersistedSession();
      expect(persisted?.paths).toEqual(["/x.md"]);
      expect(persisted?.activePath).toBe("/x.md");
      expect(persisted?.folder).toBeNull();
      expect(persisted?.layout?.primary?.activeTabPath).toBe("/x.md");
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
      expect(persisted?.paths).toEqual([]);
      expect(persisted?.activePath).toBeNull();
      expect(persisted?.folder).toBeNull();
      expect(persisted?.layout?.primary?.tabPaths).toEqual([]);
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

describe("sessionPersistence — layout", () => {
  beforeEach(() => {
    localStorage.clear();
    useDocuments.setState({ documents: [], folder: null });
    useLayout.setState({
      primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
      secondary: null,
      focusedPaneId: "primary",
      paneSplit: 0.5,
    });
  });

  it("round-trips two-pane layout", () => {
    useDocuments.setState({
      documents: [
        { id: "d1", path: "/a.md", content: "a", lastSavedContent: "a", savedMtime: 1, isDirty: false, encoding: "utf-8", cursor: 0, scrollTop: 0, readOnly: false, previewWindowLabel: null, conflict: null, saveState: "idle", lastSaveError: null, autosaveEnabled: false },
        { id: "d2", path: "/b.md", content: "b", lastSavedContent: "b", savedMtime: 1, isDirty: false, encoding: "utf-8", cursor: 0, scrollTop: 0, readOnly: false, previewWindowLabel: null, conflict: null, saveState: "idle", lastSaveError: null, autosaveEnabled: false },
      ],
      folder: "/repo",
    });
    useLayout.setState({
      primary: { id: "primary", tabs: ["d1"], activeTabId: "d1", viewMode: "edit" },
      secondary: { id: "secondary", tabs: ["d2"], activeTabId: "d2", viewMode: "wysiwyg" },
      focusedPaneId: "secondary",
      paneSplit: 0.6,
    });
    // Trigger a write by starting persistence then touching layout state:
    const stop = startSessionPersistence();
    useLayout.setState({ paneSplit: 0.6 });
    stop();
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
