import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConflictBanner } from "./ConflictBanner";

describe("ConflictBanner", () => {
  it("renders three buttons and calls the right handler", async () => {
    const keep = vi.fn();
    const reload = vi.fn();
    const diff = vi.fn();
    render(<ConflictBanner onKeep={keep} onReload={reload} onDiff={diff} />);
    await userEvent.click(screen.getByRole("button", { name: /keep mine/i }));
    await userEvent.click(screen.getByRole("button", { name: /reload disk/i }));
    await userEvent.click(screen.getByRole("button", { name: /show diff/i }));
    expect(keep).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(diff).toHaveBeenCalledOnce();
  });
});
