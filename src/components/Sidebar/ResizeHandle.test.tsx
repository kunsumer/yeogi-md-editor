import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  it("exposes a vertical separator with aria value attrs", () => {
    render(<ResizeHandle width={260} min={180} max={480} onChange={() => {}} />);
    const sep = screen.getByRole("separator");
    expect(sep).toHaveAttribute("aria-orientation", "vertical");
    expect(sep).toHaveAttribute("aria-valuenow", "260");
    expect(sep).toHaveAttribute("aria-valuemin", "180");
    expect(sep).toHaveAttribute("aria-valuemax", "480");
  });

  it("ArrowRight / ArrowLeft nudge width by 16 within [min, max]", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={260} min={180} max={480} onChange={onChange} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(276);
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(244);
  });

  it("Home and End jump to min and max", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={260} min={180} max={480} onChange={onChange} />);
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith(180);
    fireEvent.keyDown(sep, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith(480);
  });

  it("does not go below min when already at min", () => {
    const onChange = vi.fn();
    render(<ResizeHandle width={180} min={180} max={480} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(180);
  });
});
