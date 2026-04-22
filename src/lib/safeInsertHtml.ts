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
  // DROP USE_PROFILES on purpose. Profiles are a restrictive allowlist —
  // when set, DOMPurify ignores anything outside the named profiles. That
  // played badly with mermaid's ER diagrams, whose entity labels live
  // inside <foreignObject><div> HTML islands embedded in SVG. The HTML
  // island inside the SVG got treated as SVG-profile-only and its <div>
  // contents collapsed.
  //
  // DOMPurify's DEFAULT allowlist (no USE_PROFILES) already permits the
  // full HTML + SVG + MathML union and handles foreignObject content
  // correctly. ADD_TAGS + ADD_ATTR add the handful of extras mermaid
  // needs on top. <script>, <iframe>, on*-handlers still get stripped
  // — the security boundary is unchanged.
  return DOMPurify.sanitize(html, {
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

/**
 * Replace children with a sanitized standalone SVG string.
 *
 * The HTML parser doesn't round-trip SVG's foreign-content cleanly — in
 * particular, `<foreignObject><div>…</div></foreignObject>` inner HTML
 * loses its namespace bridge and Mermaid's text labels disappear. For
 * SVG-only inputs (e.g. `mermaid.render()`) parse via `image/svg+xml`
 * after sanitizing, so text and nested XHTML survive intact.
 */
export function safeReplaceChildrenWithSvg(host: HTMLElement, svg: string): void {
  const clean = sanitizeHtml(svg);
  const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
  const el = doc.documentElement;
  // Parse errors surface as a <parsererror> element — fall back to the
  // HTML-parser path so at least the text is visible.
  if (el.tagName.toLowerCase() === "parsererror") {
    safeReplaceChildren(host, svg);
    return;
  }
  host.replaceChildren(el);
}
