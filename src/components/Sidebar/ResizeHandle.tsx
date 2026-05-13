import { useCallback, useRef } from "react";

interface Props {
  width: number;
  min: number;
  max: number;
  /**
   * Which axis the handle resizes along.
   *   "x" — vertical divider line, drags left/right, ArrowLeft/Right nudge.
   *   "y" — horizontal divider line, drags up/down, ArrowUp/Down nudge.
   * Defaults to "x" so existing callers (sidebar columns) keep working
   * without a prop change.
   */
  axis?: "x" | "y";
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
 * Thin divider between resizable panels. Pointer drag updates the
 * adjacent panel's size live; keyboard arrows nudge in 16 px steps;
 * Home / End jump to the clamp bounds.
 *
 * Same component handles both vertical dividers (sidebar columns,
 * side-by-side panes) and horizontal dividers (stacked panes) — the
 * `axis` prop picks which dimension to read from pointer events and
 * which arrow keys to listen for.
 */
export function ResizeHandle({ width, min, max, axis = "x", onChange, onCommit }: Props) {
  const dragState = useRef<{ startCoord: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = {
        startCoord: axis === "x" ? e.clientX : e.clientY,
        startWidth: width,
      };
    },
    [width, axis],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      const coord = axis === "x" ? e.clientX : e.clientY;
      const next = clamp(s.startWidth + (coord - s.startCoord), min, max);
      onChange(next);
    },
    [min, max, axis, onChange],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragState.current;
      if (!s) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const coord = axis === "x" ? e.clientX : e.clientY;
      const next = clamp(s.startWidth + (coord - s.startCoord), min, max);
      dragState.current = null;
      onCommit?.(next);
    },
    [min, max, axis, onCommit],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next = width;
      const decrementKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
      const incrementKey = axis === "x" ? "ArrowRight" : "ArrowDown";
      if (e.key === decrementKey) next = clamp(width - KEY_STEP, min, max);
      else if (e.key === incrementKey) next = clamp(width + KEY_STEP, min, max);
      else if (e.key === "Home") next = min;
      else if (e.key === "End") next = max;
      else return;
      e.preventDefault();
      onChange(next);
      onCommit?.(next);
    },
    [width, min, max, axis, onChange, onCommit],
  );

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      style={
        axis === "x"
          ? {
              width: 4,
              cursor: "col-resize",
              background: "transparent",
              touchAction: "none",
              userSelect: "none",
            }
          : {
              height: 4,
              cursor: "row-resize",
              background: "transparent",
              touchAction: "none",
              userSelect: "none",
            }
      }
    />
  );
}
