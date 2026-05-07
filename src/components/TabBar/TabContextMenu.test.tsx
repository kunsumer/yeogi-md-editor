import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabContextMenu } from "./TabContextMenu";

describe("TabContextMenu", () => {
  it("shows 'Open to the Right Side' when sourcePaneId is primary", () => {
    const onOpenToSide = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        docId="doc-1"
        x={100}
        y={100}
        sourcePaneId="primary"
        hasPath
        onOpenToSide={onOpenToSide}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/open to the right side/i));
    expect(onOpenToSide).toHaveBeenCalledWith("doc-1", "primary");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'Open to the Left Side' when sourcePaneId is secondary", () => {
    const onOpenToSide = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        docId="doc-2"
        x={100}
        y={100}
        sourcePaneId="secondary"
        hasPath
        onOpenToSide={onOpenToSide}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/open to the left side/i));
    expect(onOpenToSide).toHaveBeenCalledWith("doc-2", "secondary");
  });

  it("shows 'Reload from disk' when hasPath + onReload are provided", () => {
    const onReload = vi.fn();
    render(
      <TabContextMenu
        docId="doc-3"
        x={0}
        y={0}
        sourcePaneId="primary"
        hasPath
        onOpenToSide={vi.fn()}
        onReload={onReload}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/reload from disk/i));
    expect(onReload).toHaveBeenCalledWith("doc-3");
  });

  it("hides 'Reload from disk' for path-less Untitled buffers", () => {
    render(
      <TabContextMenu
        docId="doc-4"
        x={0}
        y={0}
        sourcePaneId="primary"
        hasPath={false}
        onOpenToSide={vi.fn()}
        onReload={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByText(/reload from disk/i)).toBeNull();
  });
});
