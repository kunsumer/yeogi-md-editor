import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Lightbox } from "../Lightbox/Lightbox";
import type { ZoomTarget } from "../Lightbox/attachZoomTargets";
import { zoomTargetFromElement } from "./zoomTargetFromElement";

interface Props {
  editor: Editor;
}

interface BtnPos {
  top: number;
  left: number;
  el: Element;
}

/**
 * Editor-scoped hover affordance: when the pointer is over a zoomable element
 * (an <img> or a rendered `.mermaid` diagram) in the editor, show a small ⤢
 * button at its top-right; clicking it opens the shared fullscreen Lightbox.
 * Listens on `editor.view.dom` and positions the button within the enclosing
 * `.wysiwyg-scroll`. Does not touch selection or image-resize — those still
 * respond to plain clicks as before.
 */
export function EditorZoomLayer({ editor }: Props) {
  const [pos, setPos] = useState<BtnPos | null>(null);
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  const hideTimer = useRef<number | null>(null);
  // scheduleHide / cancelHide close over the timer + setPos inside the effect;
  // expose them via refs so the button's own mouse handlers drive the same
  // hide logic (the editor `mouseout` listener doesn't fire when the pointer
  // leaves the button into empty scroll-margin).
  const scheduleHideRef = useRef<() => void>(() => {});
  const cancelHideRef = useRef<() => void>(() => {});

  useEffect(() => {
    const root = editor.view.dom as HTMLElement;
    const scroll = (root.closest(".wysiwyg-scroll") as HTMLElement | null) ?? root;

    const cancelHide = () => {
      if (hideTimer.current != null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer.current = window.setTimeout(() => setPos(null), 150);
    };
    cancelHideRef.current = cancelHide;
    scheduleHideRef.current = scheduleHide;

    const onOver = (e: Event) => {
      const t = e.target as HTMLElement;
      const el = (t.closest?.("img, .mermaid") as Element | null) ?? null;
      if (!el || !zoomTargetFromElement(el)) return;
      cancelHide();
      const sRect = scroll.getBoundingClientRect();
      const tRect = el.getBoundingClientRect();
      setPos({
        top: tRect.top - sRect.top + scroll.scrollTop + 6,
        left: tRect.right - sRect.left + scroll.scrollLeft - 34,
        el,
      });
    };
    const onOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related?.closest?.(".wysiwyg-zoom-btn, img, .mermaid")) return;
      scheduleHide();
    };

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      cancelHide();
    };
  }, [editor]);

  return (
    <>
      {pos && (
        <button
          type="button"
          className="wysiwyg-zoom-btn"
          aria-label="Zoom in"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => cancelHideRef.current()}
          onMouseLeave={() => scheduleHideRef.current()}
          onClick={() => {
            const t = zoomTargetFromElement(pos.el);
            if (t) setZoom(t);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      )}
      {zoom && (
        <Lightbox
          image={"image" in zoom ? zoom.image : undefined}
          svgEl={"svgEl" in zoom ? zoom.svgEl : undefined}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}
