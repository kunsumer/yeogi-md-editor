import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { useDocuments } from "./state/documents";
import { useLayout } from "./state/layout";

// --- Tauri shims (App.tsx calls listen/open/save/etc which require the
//     Tauri runtime; they are no-ops in jsdom tests) -----------------------

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/path", () => ({
  tempDir: vi.fn(() => Promise.resolve("/tmp")),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("./lib/ipc/commands", () => ({
  ensureWelcomeFile: vi.fn(() => Promise.resolve("/tmp/Welcome.md")),
  fsList: vi.fn(() => Promise.resolve([])),
  fsRead: vi.fn(() => Promise.resolve({ content: "", mtime_ms: 0, encoding: "utf-8" })),
  fsWrite: vi.fn(() => Promise.resolve({ mtime_ms: 0 })),
  watcherSubscribe: vi.fn(() => Promise.resolve()),
}));

vi.mock("./lib/markdown/pipeline", () => ({
  renderMarkdown: vi.fn(() => Promise.resolve("")),
}));

vi.mock("./lib/exportHtml", () => ({
  buildStandaloneHtml: vi.fn(() => ""),
}));

vi.mock("./state/sessionPersistence", () => ({
  loadPersistedSession: vi.fn(() => null),
  startSessionPersistence: vi.fn(() => () => {}),
}));

vi.mock("./hooks/useUpdater", () => ({
  useUpdater: vi.fn(() => ({
    status: { kind: "idle" },
    runCheck: vi.fn(),
    applyUpdate: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

vi.mock("./hooks/useWatcherEvents", () => ({
  useWatcherEvents: vi.fn(),
}));

// -------------------------------------------------------------------------

beforeEach(() => {
  useDocuments.setState({ documents: [], folder: null });
  useLayout.setState({
    primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
    secondary: null,
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
  localStorage.clear();
});

describe("App — two panes", () => {
  it("renders only primary by default", () => {
    render(<App />);
    expect(screen.getAllByRole("region", { name: /pane/i })).toHaveLength(1);
  });

  it("renders both panes when secondary is set", () => {
    useDocuments.getState().openDocument({ path: "/a.md", content: "a", savedMtime: 1, encoding: "utf-8" });
    useDocuments.getState().openDocument({ path: "/b.md", content: "b", savedMtime: 1, encoding: "utf-8" });
    const docs = useDocuments.getState().documents;
    useLayout.setState({
      primary: { id: "primary", tabs: [docs[0].id], activeTabId: docs[0].id, viewMode: "wysiwyg" },
      secondary: { id: "secondary", tabs: [docs[1].id], activeTabId: docs[1].id, viewMode: "wysiwyg" },
      focusedPaneId: "primary",
      paneSplit: 0.5,
    });
    render(<App />);
    expect(screen.getAllByRole("region", { name: /pane/i })).toHaveLength(2);
  });
});

import { usePreferences } from "./state/preferences";
import { act } from "@testing-library/react";

it("Outline switches when focus moves between panes", async () => {
  function makeDoc(id: string, path: string, content: string) {
    return {
      id, path, content, lastSavedContent: content,
      savedMtime: 1, isDirty: false, encoding: "utf-8",
      cursor: 0, scrollTop: 0, readOnly: false,
      previewWindowLabel: null, conflict: null,
      saveState: "idle" as const, lastSaveError: null, autosaveEnabled: false,
    };
  }

  // Suppress the async welcome-file effect so it doesn't race with the test.
  localStorage.setItem("yeogi-md-editor:welcome-shown", "true");

  useDocuments.setState({
    documents: [
      makeDoc("d1", "/a.md", "# Heading A"),
      makeDoc("d2", "/b.md", "# Heading B"),
    ],
    folder: null,
  });
  useLayout.setState({
    primary: { id: "primary", tabs: ["d1"], activeTabId: "d1", viewMode: "wysiwyg" },
    secondary: { id: "secondary", tabs: ["d2"], activeTabId: "d2", viewMode: "wysiwyg" },
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
  usePreferences.setState({
    ...usePreferences.getState(),
    tocVisible: true,
  });

  render(<App />);

  // The TOC panel renders heading links as clickable divs inside the Outline aside.
  expect(screen.getByRole("complementary", { name: /outline/i })).toHaveTextContent("Heading A");

  // Switch focus to secondary pane.
  act(() => {
    useLayout.getState().setFocusedPane("secondary");
  });

  // The outline should now reflect the secondary pane's active document.
  // Re-query the outline after the re-render (it may have remounted).
  const updatedOutline = await screen.findByRole("complementary", { name: /outline/i });
  expect(updatedOutline).toHaveTextContent("Heading B");
});
