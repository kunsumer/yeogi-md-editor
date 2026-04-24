import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AsidePanel } from "./AsidePanel";

describe("AsidePanel", () => {
  it("renders a title and its children in the body", () => {
    render(
      <AsidePanel title="Folder" ariaLabel="Folder Explorer">
        <div data-testid="child">hello</div>
      </AsidePanel>,
    );
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders an optional right-aligned action slot", () => {
    render(
      <AsidePanel
        title="Folder"
        ariaLabel="Folder Explorer"
        action={<button type="button">Pick…</button>}
      >
        <div />
      </AsidePanel>,
    );
    expect(screen.getByRole("button", { name: "Pick…" })).toBeInTheDocument();
  });

  it("exposes the panel as a complementary landmark with aria-label", () => {
    render(
      <AsidePanel title="Outline" ariaLabel="Outline">
        <div />
      </AsidePanel>,
    );
    expect(screen.getByRole("complementary", { name: "Outline" })).toBeInTheDocument();
  });
});
