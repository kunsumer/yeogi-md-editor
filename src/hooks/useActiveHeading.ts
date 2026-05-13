import { useEffect, useState } from "react";
import type { Heading } from "../lib/toc";

/**
 * Index of the heading the user is currently "inside" — i.e. the last
 * H1-H6 in the rendered WYSIWYG document whose top edge has scrolled
 * above an offset just below the sticky toolbar ribbon. Drives the
 * active-row highlight in the Outline panel.
 *
 * Returns -1 when:
 *   - no document is open
 *   - the doc has no headings
 *   - the user has scrolled above the first heading
 *   - the editor is in Edit mode (no .wysiwyg-content in the DOM)
 *
 * Scroll handler is RAF-throttled so we only do one set of layout
 * reads per frame, even on a long fast scroll.
 *
 * Maps DOM heading index 1:1 to `headings[]` index. Frontmatter,
 * headings inside table cells, and footnote-section headings can
 * skew this mapping in edge cases — the existing jumpToHeading()
 * code handles those via slug-and-occurrence matching, but for a
 * "good enough" highlight we accept the rare mis-mapping rather than
 * pay that cost on every scroll event.
 */
export function useActiveHeading(headings: Heading[]): number {
  const [activeIndex, setActiveIndex] = useState(-1);
  const headingsLen = headings.length;

  useEffect(() => {
    if (headingsLen === 0) {
      setActiveIndex(-1);
      return;
    }

    const scroller = document.querySelector<HTMLElement>(".wysiwyg-scroll");
    const root = document.querySelector<HTMLElement>(
      ".wysiwyg-content .ProseMirror",
    );
    if (!scroller || !root) {
      setActiveIndex(-1);
      return;
    }

    let rafId: number | null = null;

    function compute() {
      rafId = null;
      // Defensive null-check: hook deps mean these are non-null at bind,
      // but a doc swap mid-frame could in theory remount them away.
      if (!scroller || !root) return;
      const sRect = scroller.getBoundingClientRect();
      // ~ ribbon height + a small lead-in so a heading is "active" a
      // touch before it docks against the very top edge.
      const threshold = sRect.top + 80;
      const els = root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
      const max = Math.min(els.length, headingsLen);
      let last = -1;
      for (let i = 0; i < max; i++) {
        if (els[i].getBoundingClientRect().top <= threshold) {
          last = i;
        } else {
          break;
        }
      }
      setActiveIndex((prev) => (prev === last ? prev : last));
    }

    function onScroll() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(compute);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    // Initial read after layout settles.
    rafId = requestAnimationFrame(compute);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [headingsLen]);

  return activeIndex;
}
