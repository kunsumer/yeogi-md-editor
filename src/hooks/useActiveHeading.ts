import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { Heading } from "../lib/toc";
import type { ViewMode } from "../state/layout";

/**
 * Index of the heading the user is currently inside — the row the
 * Outline panel highlights as "you are here".
 *
 * Two paths, picked by `viewMode`:
 *
 *   WYSIWYG — Walk the rendered `<h1>..<h6>` elements inside
 *     `.wysiwyg-content .ProseMirror` and pick the last one whose top
 *     edge has scrolled past an offset just below the sticky ribbon.
 *
 *   Edit (CodeMirror) — Ask the EditorView for the line at the top
 *     of its scroll viewport (`lineBlockAtHeight(scrollTop)`), then
 *     pick the heading with the largest `heading.line` ≤ that
 *     line. This works regardless of line-wrap or CodeMirror's
 *     virtual scrolling.
 *
 * Both paths RAF-throttle the scroll listener (one layout read per
 * frame). Returns -1 when there is no doc, no headings, the editor
 * isn't mounted yet, or the user has scrolled above the first
 * heading.
 *
 * `headings` content is read through a ref so the listener doesn't
 * rebind on every keystroke; the effect only re-binds when the
 * heading count or the view mode changes.
 */
export function useActiveHeading(
  headings: Heading[],
  viewMode: ViewMode,
  editorViewRef: { current: EditorView | null },
): number {
  const [activeIndex, setActiveIndex] = useState(-1);
  const headingsLen = headings.length;

  // Keep the latest headings array reachable from inside the scroll
  // closure without making it a dep of the binding effect (otherwise
  // the listener would rebind on every keystroke).
  const headingsRef = useRef(headings);
  useEffect(() => {
    headingsRef.current = headings;
  }, [headings]);

  useEffect(() => {
    if (headingsLen === 0) {
      setActiveIndex(-1);
      return;
    }

    let rafId: number | null = null;

    if (viewMode === "wysiwyg") {
      const scroller = document.querySelector<HTMLElement>(".wysiwyg-scroll");
      const root = document.querySelector<HTMLElement>(
        ".wysiwyg-content .ProseMirror",
      );
      if (!scroller || !root) {
        setActiveIndex(-1);
        return;
      }

      function computeWysiwyg() {
        rafId = null;
        if (!scroller || !root) return;
        const sRect = scroller.getBoundingClientRect();
        const threshold = sRect.top + 80;
        const els = root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
        const max = Math.min(els.length, headingsRef.current.length);
        let last = -1;
        for (let i = 0; i < max; i++) {
          if (els[i].getBoundingClientRect().top <= threshold) last = i;
          else break;
        }
        setActiveIndex((prev) => (prev === last ? prev : last));
      }

      function onScroll() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(computeWysiwyg);
      }

      scroller.addEventListener("scroll", onScroll, { passive: true });
      rafId = requestAnimationFrame(computeWysiwyg);

      return () => {
        scroller.removeEventListener("scroll", onScroll);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    // Edit mode — CodeMirror.
    const view = editorViewRef.current;
    if (!view) {
      setActiveIndex(-1);
      return;
    }
    const scroller = view.scrollDOM;

    function computeEdit() {
      rafId = null;
      // The EditorView could be torn down between the scroll event and
      // the next frame; guard against a use-after-destroy.
      if (!view || !view.state) return;
      const block = view.lineBlockAtHeight(scroller.scrollTop);
      const topLine = view.state.doc.lineAt(block.from).number; // 1-indexed
      const hs = headingsRef.current;
      let last = -1;
      for (let i = 0; i < hs.length; i++) {
        if (hs[i].line <= topLine) last = i;
        else break;
      }
      setActiveIndex((prev) => (prev === last ? prev : last));
    }

    function onScroll() {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(computeEdit);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    rafId = requestAnimationFrame(computeEdit);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [headingsLen, viewMode, editorViewRef]);

  return activeIndex;
}
