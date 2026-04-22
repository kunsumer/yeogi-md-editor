import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Editor } from "./Editor";

describe("Editor", () => {
  it("renders given content", () => {
    const { container } = render(
      <Editor docId="doc-1" value="# Hi" onChange={() => {}} readOnly={false} onReady={() => {}} />,
    );
    expect(container.querySelector(".cm-editor")).toBeTruthy();
  });
});
