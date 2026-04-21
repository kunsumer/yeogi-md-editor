import DOMPurify from "dompurify";

// Attributes mermaid's class / flowchart / sequence diagrams rely on that
// aren't in DOMPurify's default SVG profile. Stripping any of these turns
// the diagram into shapes-only (no text, or text collapsed onto origin).
const EXTRA_SVG_ATTRS = [
  "xmlns",
  "xmlns:xlink",
  "transform",
  "text-anchor",
  "dominant-baseline",
  "alignment-baseline",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "marker-end",
  "marker-start",
  "marker-mid",
  "refX",
  "refY",
  "orient",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "patternUnits",
  "patternTransform",
];

// Tags that live inside mermaid's SVG output. foreignObject lets it embed
// HTML-in-SVG labels (used by some diagram types). <style> carries the
// class-based rules (fill:none on edges, text colors, font stacks) that
// mermaid depends on — without it, paths render as black blobs and text
// inherits default styling.
const EXTRA_TAGS = ["foreignObject", "style"];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ADD_TAGS: EXTRA_TAGS,
    ADD_ATTR: EXTRA_SVG_ATTRS,
  });
}

/**
 * Replace an element's children with parsed, sanitized HTML.
 * Uses DOMParser + replaceChildren so no innerHTML or property assignment
 * happens on the host element. Every DOM insertion of markdown-derived
 * HTML must go through this helper.
 */
export function safeReplaceChildren(host: HTMLElement, html: string): void {
  const clean = sanitizeHtml(html);
  const parsed = new DOMParser().parseFromString(clean, "text/html");
  const nodes = Array.from(parsed.body.childNodes);
  host.replaceChildren(...nodes);
}
