import type { ZoomTarget } from "../Lightbox/attachZoomTargets";

/**
 * Map a hovered editor element (an <img> or a `.mermaid` block) to the
 * payload the Lightbox needs, or null if it isn't zoomable (e.g. a Mermaid
 * block still rendering / in an error state, with no <svg> child).
 */
export function zoomTargetFromElement(el: Element): ZoomTarget | null {
  if (el.tagName === "IMG") {
    const img = el as HTMLImageElement;
    return { image: { src: img.currentSrc || img.src, alt: img.alt } };
  }
  if (el.classList.contains("mermaid")) {
    const svg = el.querySelector("svg");
    if (svg) return { svgEl: svg };
  }
  return null;
}
