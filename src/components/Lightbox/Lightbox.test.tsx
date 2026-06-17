import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Lightbox } from "./Lightbox";

describe("Lightbox", () => {
  it("renders an image and zooms in/out via the controls", () => {
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={() => {}} />);
    expect(screen.getByAltText("A")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("double-click toggles between 100% and 200%", () => {
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={() => {}} />);
    const stage = screen.getByAltText("A").parentElement as HTMLElement;
    fireEvent.doubleClick(stage);
    expect(screen.getByText("200%")).toBeInTheDocument();
    fireEvent.doubleClick(stage);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("closes via Escape, the close button, and backdrop click", () => {
    const onClose = vi.fn();
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
