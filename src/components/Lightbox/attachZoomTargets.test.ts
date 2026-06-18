import { describe, it, expect, vi, afterEach } from "vitest";
import { attachZoomTargets } from "./attachZoomTargets";

function makeHost(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
afterEach(() => { document.body.innerHTML = ""; });

describe("attachZoomTargets", () => {
  it("opens an image target on click", () => {
    const el = makeHost(`<img src="/a.png" alt="A">`);
    const onOpen = vi.fn();
    attachZoomTargets(el, onOpen);
    el.querySelector("img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith({
      image: { src: expect.stringContaining("a.png"), alt: "A" },
    });
  });

  it("opens an svg (mermaid) target on click", () => {
    const el = makeHost(`<div class="mermaid"><svg id="m"><rect/></svg></div>`);
    const onOpen = vi.fn();
    attachZoomTargets(el, onOpen);
    el.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const arg = onOpen.mock.calls[0][0];
    expect("svgEl" in arg && (arg as { svgEl: SVGSVGElement }).svgEl.tagName.toLowerCase()).toBe("svg");
  });

  it("cleanup removes the click handlers", () => {
    const el = makeHost(`<img src="/a.png" alt="A">`);
    const onOpen = vi.fn();
    const cleanup = attachZoomTargets(el, onOpen);
    cleanup();
    el.querySelector("img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
