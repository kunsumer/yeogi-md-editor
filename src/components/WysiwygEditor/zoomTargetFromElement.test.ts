import { describe, it, expect } from "vitest";
import { zoomTargetFromElement } from "./zoomTargetFromElement";

function el(html: string): Element {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild as Element;
}

describe("zoomTargetFromElement", () => {
  it("maps an <img> to an image target", () => {
    const t = zoomTargetFromElement(el(`<img src="/a.png" alt="A">`));
    expect(t).toEqual({ image: { src: expect.stringContaining("a.png"), alt: "A" } });
  });

  it("maps a .mermaid block (with svg) to an svg target", () => {
    const t = zoomTargetFromElement(el(`<div class="mermaid"><svg id="m"><rect/></svg></div>`));
    expect(t && "svg" in t && t.svg).toContain("<svg");
  });

  it("returns null for a .mermaid block that has no svg yet", () => {
    expect(zoomTargetFromElement(el(`<div class="mermaid"></div>`))).toBeNull();
  });

  it("returns null for an unrelated element", () => {
    expect(zoomTargetFromElement(el(`<p>hi</p>`))).toBeNull();
  });
});
