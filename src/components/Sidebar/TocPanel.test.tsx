import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TocPanel } from "./TocPanel";

describe("TocPanel", () => {
  it("shows the no-document empty state when no doc is open", () => {
    render(
      <TocPanel
        hasDocument={false}
        headings={[]}
        activeDocPath={null}
        folder={null}
        onJump={() => {}}
        onOpenBacklink={() => {}}
      />);
    expect(screen.getByText(/No document open/i)).toBeInTheDocument();
  });

  it("shows the no-headings empty state when the document has none", () => {
    render(
      <TocPanel
        hasDocument={true}
        headings={[]}
        activeDocPath={null}
        folder={null}
        onJump={() => {}}
        onOpenBacklink={() => {}}
      />);
    expect(screen.getByText(/No headings/i)).toBeInTheDocument();
  });

  it("renders each heading as a clickable row", () => {
    render(
      <TocPanel
        hasDocument={true}
        headings={[
          { level: 1, text: "Intro", line: 1 },
          { level: 2, text: "Context", line: 4 },
        ]}
        activeDocPath={null}
        folder={null}
        onJump={() => {}}
        onOpenBacklink={() => {}}
      />,
    );
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
  });
});
