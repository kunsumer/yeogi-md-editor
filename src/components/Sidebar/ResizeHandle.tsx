import { useCallback, useRef } from "react";

interface Props {
  width: number;
  min: number;
  max: number;
  /**
   * Called during drag with a candidate width. Parent decides whether to
   * commit immediately or buffer — most callers just thread it into their
   * render-time width and flush to preferences on pointerup.
   */
  onChange(next: number): void;
  /**
   * Optional — called when the user finishes a discrete resize action:
   * once on pointer release at the end of a drag, and once per keyboard
   * nudge (each arrow press is its own committed step). Use this hook to
   * persist the committed value to localStorage without writing on every
   * pointermove.
   */
  onCommit?(next: number): void;
}

const KEY_STEP = 16;
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Thin vertical divider between sidebar columns. Pointer drag updates the
 * adjacent panel's width live; keyboard arrows nudge it in 16 px steps;
 * Home / End jump to the clamp bounds.
 */
export function ResizeHandle({ width, min, max, onChange, onCommit }: Props) {
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = { startX: e.clientX, startWidth: width };
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      const next = clamp(s.startWidth + (e.clientX - s.startX), min, max);
      onChange(next);
    },
    [min, max, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const next = clamp(s.startWidth + (e.clientX - s.startX), min, max);
      dragState.current = null;
      onCommit?.(next);
    },
    [min, max, onCommit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next = width;
      if (e.key === "ArrowLeft") next = clamp(width - KEY_STEP, min, max);
      else if (e.key === "ArrowRight") next = clamp(width + KEY_STEP, min, max);
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      else return;
      e.preventDefault();
      onChange(next);
      onCommit?.(next);
    },
    [width, min, max, onChange, onCommit],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      style={{
        width: 4,
        cursor: "col-resize",
        background: "transparent",
        touchAction: "none",
        userSelect: "none",
      }}
    />
  );
}
