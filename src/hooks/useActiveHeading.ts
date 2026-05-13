import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { Heading } from "../lib/toc";
import type { ViewMode } from "../state/layout";
import { slugify } from "../lib/slug";

/**
 * Index of the heading the user is currently inside — the row the
 * Outline panel highlights as "you are here".
 *
 * Two paths, picked by `viewMode`:
 *
 *   WYSIWYG — Walk the rendered `<h1>..<h6>` elements inside
 *     `.wysiwyg-content .ProseMirror` and pick the last one whose top
 *     edge has scrolled past an offset just below the sticky ribbon.
 *     A DOM-element → headings[] index map is built once per heading
 *     change (slug + level pairing, same logic as `jumpToHeading`) so
 *     frontmatter / table-cell / footnote-section `<h*>` elements that
 *     have no matching TOC row don't shift the highlight.
 *
 *   Edit (CodeMirror) — Ask the EditorView for the line at the top
 *     of its scroll viewport (`lineBlockAtHeight(scrollTop)`), then
 *     pick the heading with the largest `heading.line` ≤ that
 *     line. Works regardless of line-wrap or virtual scrolling.
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

      // Cache: which `<h*>` element corresponds to which entry in
      // headings[]. Rebuilt when the headings array identity changes
      // (App.tsx parses the doc on every keystroke so the array is
      // a fresh reference whenever heading text or order changes).
      // `domToHeadings[i]` is the headings[] index for DOM heading
      // `domEls[i]`, or -1 if that DOM heading has no TOC counterpart
      // (frontmatter, table cells, raw HTML headings, etc.).
      let cachedHeadings: Heading[] | null = null;
      let domEls: HTMLElement[] = [];
      let domToHeadings: number[] = [];

      function rebuildMap() {
        if (!root) return;
        const hs = headingsRef.current;
        domEls = Array.from(
          root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"),
        );
        // Two-pointer walk: both DOM and headings[] follow doc order.
        // DOM may have extras (hidden frontmatter heading, raw-HTML
        // heading inside a table cell, etc.); skip those without
        // advancing j. headings[] shouldn't have entries with no DOM
        // counterpart (every mdast heading renders), so we never need
        // to advance j without consuming a DOM element.
        domToHeadings = new Array(domEls.length).fill(-1);
        let j = 0;
        for (let i = 0; i < domEls.length; i++) {
          if (j >= hs.length) break;
          const tagLevel = Number(domEls[i].tagName.slice(1));
          const domSlug = slugify(domEls[i].textContent ?? "");
          if (tagLevel === hs[j].level && domSlug === slugify(hs[j].text)) {
            domToHeadings[i] = j;
            j++;
          }
          // else: DOM heading is an extra — leave domToHeadings[i] = -1
          // and don't advance j (the next DOM heading may match hs[j]).
        }
        cachedHeadings = hs;
      }

      function computeWysiwyg() {
        rafId = null;
        if (!scroller || !root) return;
        // Rebuild the slug map if the headings array reference has
        // changed since the last frame (typing into a heading rewrites
        // the array; structural changes also force a rebind via the
        // headingsLen dep — but text-only edits don't, so we check
        // identity here).
        if (headingsRef.current !== cachedHeadings) rebuildMap();
        const sRect = scroller.getBoundingClientRect();
        const threshold = sRect.top + 80;
        let last = -1;
        for (let i = 0; i < domEls.length; i++) {
          if (domEls[i].getBoundingClientRect().top <= threshold) {
            if (domToHeadings[i] >= 0) last = domToHeadings[i];
          } else {
            break;
          }
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
