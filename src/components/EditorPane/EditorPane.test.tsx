import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorPane } from "./EditorPane";
import { useDocuments } from "../../state/documents";
import { useLayout } from "../../state/layout";

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
        onOpenFiles={() => {}}
        onOpenFolder={() => {}}
        onCreateBlank={() => {}}
        onCloseTab={() => {}}
        onActivateTab={() => {}}
        onOpenToSide={() => {}}
        onSetViewMode={() => {}}
        onFocusPane={() => {}}
        onSetContent={() => {}}
      />,
    );
    expect(screen.getByText(/Create blank document/i)).toBeInTheDocument();
  });
});
