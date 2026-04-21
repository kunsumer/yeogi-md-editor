import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
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
