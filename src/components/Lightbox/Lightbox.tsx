import { useCallback, useEffect, useRef, useState } from "react";
import { safeReplaceChildrenWithSvg } from "../../lib/safeInsertHtml";
import "./Lightbox.css";

interface Props {
  image?: { src: string; alt: string };
  svg?: string;
  onClose(): void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Fullscreen image/diagram viewer: scroll or +/- to zoom, drag to pan,
 * double-click to toggle fit↔200%, Esc / backdrop / ✕ to close. Renders
 * either an <img> (by src) or a Mermaid SVG (inserted via the app's SVG
 * sanitizer). Owns only zoom/pan state — no app/store coupling.
 */
export function Lightbox({ image, svg, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (svg && svgHostRef.current) safeReplaceChildrenWithSvg(svgHostRef.current, svg);
  }, [svg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoomBy = useCallback((factor: number) => {
    setScale((s) => clamp(s * factor, MIN_SCALE, MAX_SCALE));
  }, []);
  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }
  function onDoubleClick() {
    if (scale === 1) setScale(2);
    else reset();
  }
  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: e.clientX - d.x, y: e.clientY - d.y });
  }
  function onPointerUp() { dragRef.current = null; }

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={onWheel}
    >
      <div className="lightbox-controls" role="toolbar" aria-label="Zoom controls">
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span className="lightbox-pct" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" aria-label="Close viewer" onClick={onClose}>✕</button>
      </div>
      <div
        className="lightbox-stage"
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
        }}
      >
        {image && <img src={image.src} alt={image.alt} draggable={false} />}
        {svg && <div ref={svgHostRef} className="lightbox-svg" />}
      </div>
    </div>
  );
}
