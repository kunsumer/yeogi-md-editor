import { useEffect, useState } from "react";
import "./LinkTooltip.css";

/**
 * Instant-show tooltip for links inside the editor and preview surfaces.
 *
 * The browser's native `title` tooltip has a 500–1000 ms hardcoded delay
 * (macOS WKWebView is ~1 s) that makes hovering over a markdown
 * `[text](url "title")` link feel sluggish. This component watches for
 * mouseover on `a[href]` elements inside `.wysiwyg-content` or
 * `.preview-content` and renders a positioned tooltip immediately — no
 * delay, no race with the native one.
 *
 * Design choices:
 *  - **Single global instance** mounted at the App root, document-level
 *    mouseover delegation. Avoids per-link listener wiring + deals with
 *    links added later by Tiptap / Preview re-renders for free.
 *  - **Scoped to editor/preview** via `closest('.wysiwyg-content,.preview-content')`
 *    so app-chrome links (folder panel, status bar) keep native tooltip
 *    semantics, in case those grow tooltips later.
 *  - **Consumes the title attribute** on first hover: moves `title` to
 *    `data-tt` and clears the original. That permanently disables the
 *    native tooltip for the link, so we don't get a "double tooltip"
 *    flash when the OS catches up after its delay. Cheap, idempotent,
 *    and leaves the title text discoverable for assistive tech via the
 *    data attribute.
 *  - **Body content:** if the link has a title, show it first (matches
 *    the OS tooltip behavior users expect). Always show the href as a
 *    second line — it's the most useful context for "where am I about to
 *    navigate" and is what most modern editors do.
 */
export function LinkTooltip() {
  const [state, setState] = useState<{
    title: string;
    href: string;
    x: number;
    y: number;
    above: boolean;
  } | null>(null);

  useEffect(() => {
    let activeAnchor: HTMLAnchorElement | null = null;

    function onOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      // Only fire for links inside the editor or preview content roots.
      if (!a.closest(".wysiwyg-content, .preview-content")) return;
      if (a === activeAnchor) return;
      activeAnchor = a;

      // Consume the native title so the OS tooltip doesn't compete with us.
      // Moves to data-tt the first time, then becomes a no-op on subsequent
      // hovers because title is already gone.
      const titleAttr = a.getAttribute("title");
      if (titleAttr) {
        a.setAttribute("data-tt", titleAttr);
        a.removeAttribute("title");
      }
      const title = a.getAttribute("data-tt") ?? "";
      const href = a.getAttribute("href") ?? "";
      // Don't show an empty tooltip — if the link has neither a title nor
      // an href worth surfacing, just bail.
      if (!title && !href) return;

      const rect = a.getBoundingClientRect();
      // Prefer placing the tooltip above the link; flip below if there
      // isn't room (top edge of viewport).
      const above = rect.top > 40;
      const x = Math.max(8, Math.min(window.innerWidth - 8, rect.left + rect.width / 2));
      const y = above ? rect.top - 6 : rect.bottom + 6;
      setState({ title, href, x, y, above });
    }

    function onOut(e: MouseEvent) {
      const related = (e.relatedTarget as HTMLElement | null) ?? null;
      // If the cursor moved to a child of the same anchor, keep showing.
      if (activeAnchor && related && activeAnchor.contains(related)) return;
      activeAnchor = null;
      setState(null);
    }

    function onScroll() {
      // Hide on scroll — the cached coordinates would be wrong, and
      // re-positioning during scroll is jittery.
      activeAnchor = null;
      setState(null);
    }

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("scroll", onScroll, true); // capture for nested scrollers
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  if (!state) return null;

  return (
    <div
      role="tooltip"
      className={`link-tooltip ${state.above ? "is-above" : "is-below"}`}
      style={{
        left: `${state.x}px`,
        top: `${state.y}px`,
      }}
    >
      {state.title && <div className="link-tooltip-title">{state.title}</div>}
      <div className="link-tooltip-href">{state.href}</div>
    </div>
  );
}
