import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabBar } from "./TabBar";
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

function makeDoc(id: string, path: string): Document {
  return {
    id, path, content: "", lastSavedContent: "", savedMtime: 1, isDirty: false,
    encoding: "utf-8", cursor: 0, scrollTop: 0, readOnly: false,
    previewWindowLabel: null, conflict: null, saveState: "idle",
    lastSaveError: null, autosaveEnabled: false,
  };
}

const pane: Pane = {
  id: "primary",
  tabs: ["doc-1", "doc-2"],
  activeTabId: "doc-2",
  viewMode: "wysiwyg",
};
const documents: Document[] = [makeDoc("doc-1", "/a.md"), makeDoc("doc-2", "/b.md")];

describe("TabBar", () => {
  it("renders a tab per docId in pane.tabs", () => {
    render(
      <TabBar
        pane={pane}
        isFocused
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onCreateBlank={() => {}}
        onOpenFiles={() => {}}
      />,
    );
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByText("b.md")).toBeInTheDocument();
  });

  it("marks the active tab selected", () => {
    render(
      <TabBar
        pane={pane}
        isFocused
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onCreateBlank={() => {}}
        onOpenFiles={() => {}}
      />,
    );
    const active = screen.getByText("b.md").closest("[role=tab]");
    expect(active?.getAttribute("aria-selected")).toBe("true");
  });

  it("uses muted indicator color when pane is not focused", () => {
    const { container } = render(
      <TabBar
        pane={pane}
        isFocused={false}
        documents={documents}
        onActivate={() => {}}
        onClose={() => {}}
        onOpenToSide={() => {}}
        onCreateBlank={() => {}}
        onOpenFiles={() => {}}
      />,
    );
    const active = container.querySelector('[aria-selected="true"]') as HTMLElement;
    // Inset box shadow uses --border-strong when inactive, --brand-red when focused.
    expect(active.style.boxShadow).toContain("var(--border-strong");
  });
});
