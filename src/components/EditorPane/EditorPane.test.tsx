import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorPane } from "./EditorPane";
import { useDocuments } from "../../state/documents";
import { useLayout } from "../../state/layout";

const noopHandlers = {
  onOpenFiles: vi.fn(),
  onOpenFolder: vi.fn(),
  onCreateBlank: vi.fn(),
  onCloseTab: vi.fn(),
  onActivateTab: vi.fn(),
  onOpenToSide: vi.fn(),
  onSetViewMode: vi.fn(),
  onFocusPane: vi.fn(),
  onSetContent: vi.fn(),
  onSetAutosaveEnabled: vi.fn(),
};

function reset() {
  useDocuments.setState({ documents: [], folder: null });
  useLayout.setState({
    primary: { id: "primary", tabs: [], activeTabId: null, viewMode: "wysiwyg" },
    secondary: null,
    focusedPaneId: "primary",
    paneSplit: 0.5,
  });
}

describe("EditorPane", () => {
  beforeEach(reset);

  it("renders the empty state when the pane has no active tab", () => {
    render(
      <EditorPane
        pane={useLayout.getState().primary}
        isFocused
        documents={[]}
        otherPaneActiveTabId={null}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText(/Create blank document/i)).toBeInTheDocument();
  });

  it("forces readOnly on secondary when both panes show the same active doc", () => {
    useDocuments.getState().openDocument({
      path: "/a.md", content: "same", savedMtime: 1, encoding: "utf-8",
    });
    const docId = useDocuments.getState().documents[0].id;
    useLayout.setState({
      primary: { id: "primary", tabs: [docId], activeTabId: docId, viewMode: "wysiwyg" },
      secondary: { id: "secondary", tabs: [docId], activeTabId: docId, viewMode: "wysiwyg" },
      focusedPaneId: "secondary",
      paneSplit: 0.5,
    });
    const { container } = render(
      <EditorPane
        pane={useLayout.getState().secondary!}
        isFocused
        documents={useDocuments.getState().documents}
        otherPaneActiveTabId={docId}
        {...noopHandlers}
      />,
    );
    // The underlying editor should be mounted with contenteditable="false".
    const editable = container.querySelector("[contenteditable]");
    expect(editable?.getAttribute("contenteditable")).toBe("false");
  });
});
