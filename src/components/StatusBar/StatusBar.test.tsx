import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("shows dirty + word count + save status", () => {
    render(<StatusBar isDirty saveState="saved" wordCount={42} watcherOffline={null} />);
    expect(screen.getByText(/42 words/)).toBeInTheDocument();
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    expect(screen.getByLabelText(/unsaved changes/i)).toBeInTheDocument();
  });
});
