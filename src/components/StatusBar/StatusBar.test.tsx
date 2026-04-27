import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("renders nothing when there's no message to surface", () => {
    const { container } = render(<StatusBar saveState="saved" watcherOffline={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows save-failed warning", () => {
    render(<StatusBar saveState="failed" watcherOffline={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/save failed/i);
  });

  it("shows watcher-offline warning with reason in title", () => {
    render(<StatusBar saveState="saved" watcherOffline="path gone" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/file watcher offline/i);
    expect(alert).toHaveAttribute("title", "path gone");
  });
});
