import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";
import type { Pane } from "../../state/layout";
import type { Document } from "../../state/documents";

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: "doc-1", path: "/a.md", content: "one two three", lastSavedContent: "",
    savedMtime: 1, isDirty: false, encoding: "utf-8", cursor: 0, scrollTop: 0,
    readOnly: false, previewWindowLabel: null, conflict: null,
    saveState: "idle", lastSaveError: null, autosaveEnabled: false,
    ...over,
  };
}

const pane: Pane = { id: "primary", tabs: ["doc-1"], activeTabId: "doc-1", viewMode: "edit" };

describe("TopBar", () => {
  it("renders filename + word count from the active doc", () => {
    render(<TopBar pane={pane} active={makeDoc()} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />);
    expect(screen.getByText("a.md")).toBeInTheDocument();
    expect(screen.getByLabelText(/word count/i).textContent).toMatch(/3 words/);
  });

  it("renders Untitled with 0 words when no active doc", () => {
    render(<TopBar pane={{ ...pane, activeTabId: null, tabs: [] }} active={null} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />);
    expect(screen.getByText("Untitled")).toBeInTheDocument();
    expect(screen.getByLabelText(/word count/i).textContent).toMatch(/0 words/);
  });

  it("reflects pane.viewMode in the toggle", () => {
    render(<TopBar pane={pane} active={makeDoc()} onSetViewMode={() => {}} onSetAutosaveEnabled={() => {}} />);
    const editBtn = screen.getByRole("button", { name: /^Edit$/ });
    expect(editBtn.getAttribute("aria-pressed")).toBe("true");
  });
});
