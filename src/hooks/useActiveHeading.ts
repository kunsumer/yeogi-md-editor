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
 *
 * Tiptap's `useEditor` and CodeMirror's mount are both async — the
 * DOM elements / EditorView we need may not exist when this effect
 * first runs. We try once eagerly, then fall back to a short rAF
 * poll (~30 frames, half a second) so the listener attaches as soon
 * as the editor lands in the DOM.
 */
// Set `window.__yeogiTocDebug = true` in DevTools to log every step of
// the active-heading hook. Off by default — production users won't see
// anything. Throwaway diagnostic instrumentation; trim once Edit-mode
// highlight is verified working.
function debug(...args: unknown[]) {
  if (typeof window !== "undefined" && (window as unknown as { __yeogiTocDebug?: boolean }).__yeogiTocDebug) {
    // eslint-disable-next-line no-console
    console.log("[useActiveHeading]", ...args);
  }
}

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
    debug("effect re-run", { headingsLen, viewMode, viewRefCurrent: editorViewRef.current ? "set" : "null" });
    if (headingsLen === 0) {
      setActiveIndex(-1);
      return;
    }

    let detach: (() => void) | null = null;
    let pollRafId: number | null = null;
    let pollAttempts = 0;

    function tryBind(): boolean {
      if (viewMode === "wysiwyg") {
        const scroller = document.querySelector<HTMLElement>(".wysiwyg-scroll");
        const root = document.querySelector<HTMLElement>(
          ".wysiwyg-content .ProseMirror",
        );
        if (!scroller || !root) {
          debug("WYSIWYG tryBind FAIL", { scroller: !!scroller, root: !!root });
          return false;
        }
        debug("WYSIWYG bind OK");
        detach = bindWysiwyg(scroller, root, headingsRef, setActiveIndex);
        return true;
      }
      // Don't capture the view in a closure — StrictMode (and any
      // future re-mount path) can destroy it between bind and tick.
      // bindEdit reads `editorViewRef.current` on every tick instead,
      // so it always sees the live view in the DOM.
      const view = editorViewRef.current;
      if (!view) {
        debug("Edit tryBind FAIL — view ref is null");
        return false;
      }
      debug("Edit bind OK", {
        viewportFrom: view.viewport?.from,
        scrollTop: view.scrollDOM?.scrollTop,
        docLines: view.state?.doc.lines,
      });
      detach = bindEdit(editorViewRef, headingsRef, setActiveIndex);
      return true;
    }

    if (!tryBind()) {
      // Editor isn't in the DOM yet (Tiptap's `useEditor` is async; the
      // CodeMirror EditorView ref populates from a child effect). Poll
      // a handful of frames — typically lands on frame 1 or 2 — then
      // give up to avoid hanging onto an rAF forever for a dead pane.
      const pollOnce = () => {
        pollRafId = null;
        if (tryBind()) return;
        if (pollAttempts++ < 30) {
          pollRafId = requestAnimationFrame(pollOnce);
        }
      };
      pollRafId = requestAnimationFrame(pollOnce);
    }

    return () => {
      if (pollRafId !== null) cancelAnimationFrame(pollRafId);
      detach?.();
    };
  }, [headingsLen, viewMode, editorViewRef]);

  return activeIndex;
}

function bindWysiwyg(
  scroller: HTMLElement,
  root: HTMLElement,
  headingsRef: { current: Heading[] },
  setActiveIndex: (next: number | ((prev: number) => number)) => void,
): () => void {
  let rafId: number | null = null;
  let cachedHeadings: Heading[] | null = null;
  let domEls: HTMLElement[] = [];
  let domToHeadings: number[] = [];
  let mapDirty = true;

  function rebuildMap() {
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
    mapDirty = false;
  }

  function compute() {
    rafId = null;
    if (
      mapDirty ||
      headingsRef.current !== cachedHeadings ||
      // Defensive: if Tiptap finished mounting heading nodes after
      // the last rebuild, the cached domEls is stale. Detect via a
      // cheap "did the DOM gain or lose <h*> elements?" check.
      root.querySelectorAll("h1,h2,h3,h4,h5,h6").length !== domEls.length
    ) {
      rebuildMap();
    }
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
    setActiveIndex((prev: number) => (prev === last ? prev : last));
  }

  function onScroll() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(compute);
  }

  // ProseMirror populates the editor's children asynchronously
  // (Tiptap's `useEditor` resolves on a microtask and content nodes
  // can stream in across a frame or two). A MutationObserver on the
  // root flags the heading map as dirty whenever a child changes,
  // so the next compute frame picks up newly-rendered <h*> elements.
  // Scoped to direct children + heading-text edits — *not* subtree —
  // to keep the callback cheap and prevent re-mapping on every
  // paragraph keystroke deep in the doc.
  const observer = new MutationObserver(() => {
    mapDirty = true;
    if (rafId === null) rafId = requestAnimationFrame(compute);
  });
  observer.observe(root, { childList: true });

  scroller.addEventListener("scroll", onScroll, { passive: true });
  rafId = requestAnimationFrame(compute);

  return () => {
    observer.disconnect();
    scroller.removeEventListener("scroll", onScroll);
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

function bindEdit(
  viewRef: { current: EditorView | null },
  headingsRef: { current: Heading[] },
  setActiveIndex: (next: number | ((prev: number) => number)) => void,
): () => void {
  let tickCount = 0;
  // Read `viewRef.current` on every tick so we always see the live
  // EditorView in the DOM, not a captured stale one. StrictMode's
  // dev-mode double-mount can destroy a freshly created view between
  // setup and the first tick; capturing in a closure would leave the
  // hook bound to the dead instance forever.
  let cancelled = false;
  let lastTopLine = -2;

  function compute() {
    tickCount++;
    if (cancelled) {
      debug("Edit tick #" + tickCount + " cancelled");
      return;
    }
    const view = viewRef.current;
    if (!view || !view.state) {
      // No live view yet (or just torn down). Keep polling — the next
      // tick may pick up a fresh view if Editor finishes mounting.
      return;
    }
    // Log every 10th tick (~1s) regardless of early-exit so we can
    // tell the interval is firing.
    const liveScrollTop = view.scrollDOM ? view.scrollDOM.scrollTop : -1;
    const topPos = view.viewport.from;
    const topLine = view.state.doc.lineAt(topPos).number; // 1-indexed
    if (tickCount % 10 === 0) {
      debug("Edit tick #" + tickCount, {
        viewportFrom: topPos,
        scrollTop: liveScrollTop,
        topLine,
        lastTopLine,
      });
    }
    if (topLine === lastTopLine) return;
    lastTopLine = topLine;
    const hs = headingsRef.current;
    let last = -1;
    for (let i = 0; i < hs.length; i++) {
      if (hs[i].line <= topLine) last = i;
      else break;
    }
    debug("Edit compute change", { topPos, topLine, hsLen: hs.length, activeIndex: last });
    setActiveIndex((prev: number) => (prev === last ? prev : last));
  }

  const intervalId = window.setInterval(compute, 100);
  // Kick off once so the initial position lands immediately.
  compute();

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}
