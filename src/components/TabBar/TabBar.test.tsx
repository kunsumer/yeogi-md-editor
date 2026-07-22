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
    lastSaveError: null, autosaveEnabled: false, reloadEpoch: 0,
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

  it("scrolls the newly active tab into view when activation changes", () => {
    // jsdom doesn't implement scrollIntoView — record the element each
    // call is bound to so we can assert which tab was anchored.
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function () {
      scrolled.push(this as Element);
    };
    const props = {
      isFocused: true,
      onActivate: () => {},
      onClose: () => {},
      onOpenToSide: () => {},
      onCreateBlank: () => {},
      onOpenFiles: () => {},
    };
    const { rerender } = render(
      <TabBar pane={pane} documents={documents} {...props} />,
    );
    scrolled.length = 0; // ignore the mount-time anchor
    // A new file opens: appended at the end of the strip and made active.
    rerender(
      <TabBar
        pane={{ ...pane, tabs: [...pane.tabs, "doc-3"], activeTabId: "doc-3" }}
        documents={[...documents, makeDoc("doc-3", "/c.md")]}
        {...props}
      />,
    );
    expect(scrolled[scrolled.length - 1]?.getAttribute("data-tab-id")).toBe("doc-3");
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
