import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { EditorZoomLayer } from "./EditorZoomLayer";

afterEach(() => { document.body.innerHTML = ""; });

function makeEditor(innerHTML: string): { editor: Editor; dom: HTMLElement } {
  const scroll = document.createElement("div");
  scroll.className = "wysiwyg-scroll";
  const dom = document.createElement("div");
  dom.className = "ProseMirror";
  dom.innerHTML = innerHTML;
  scroll.appendChild(dom);
  document.body.appendChild(scroll);
  return { editor: { view: { dom } } as unknown as Editor, dom };
}

describe("EditorZoomLayer", () => {
  it("shows the button on image hover and opens the image lightbox", () => {
    const { editor, dom } = makeEditor(`<p>x</p><img src="/a.png" alt="A">`);
    render(<EditorZoomLayer editor={editor} />);
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    fireEvent.mouseOver(dom.querySelector("img")!);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("dialog", { name: "Image viewer" })).toBeInTheDocument();
  });

  it("shows the button on mermaid hover and opens the diagram lightbox", () => {
    const { editor, dom } = makeEditor(`<div class="mermaid"><svg id="m"><rect/></svg></div>`);
    render(<EditorZoomLayer editor={editor} />);
    fireEvent.mouseOver(dom.querySelector("svg")!);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("dialog", { name: "Diagram viewer" })).toBeInTheDocument();
  });
});
