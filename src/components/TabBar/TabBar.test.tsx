import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TabBar } from "./TabBar";

const docs = [
  { id: "a", title: "One.md", isDirty: false },
  { id: "b", title: "Two.md", isDirty: true },
];

describe("TabBar", () => {
  it("renders one tab per doc and marks dirty ones", () => {
    render(<TabBar docs={docs} activeId="a" onActivate={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("tab", { name: /One\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Two\.md/ })).toHaveAttribute("data-dirty", "true");
  });

  it("activates on click", async () => {
    const onActivate = vi.fn();
    render(<TabBar docs={docs} activeId="a" onActivate={onActivate} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: /Two\.md/ }));
    expect(onActivate).toHaveBeenCalledWith("b");
  });

  it("closes via button", async () => {
    const onClose = vi.fn();
    render(<TabBar docs={docs} activeId="a" onActivate={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getAllByRole("button", { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalledWith("a");
  });
});
