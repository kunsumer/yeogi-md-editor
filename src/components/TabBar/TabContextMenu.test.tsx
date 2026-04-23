import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TabContextMenu } from "./TabContextMenu";

describe("TabContextMenu", () => {
  it("shows an 'Open to the Side' item and fires the callback", () => {
    const onOpenToSide = vi.fn();
    const onClose = vi.fn();
    render(
      <TabContextMenu
        docId="doc-1"
        x={100}
        y={100}
        onOpenToSide={onOpenToSide}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText(/open to the side/i));
    expect(onOpenToSide).toHaveBeenCalledWith("doc-1");
    expect(onClose).toHaveBeenCalled();
  });
});
