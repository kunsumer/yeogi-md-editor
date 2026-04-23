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
        onOpenToSide={onOpenToSide}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/open to the left side/i));
    expect(onOpenToSide).toHaveBeenCalledWith("doc-2", "secondary");
  });
});
