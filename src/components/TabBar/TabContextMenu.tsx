import { useEffect, useRef } from "react";
import type { PaneId } from "../../state/layout";

interface Props {
  docId: string;
  x: number;
  y: number;
  /** The pane the right-clicked tab lives in. The menu label is
   *  directionally worded relative to this (primary → right, secondary → left). */
  sourcePaneId: PaneId;
  onOpenToSide(docId: string, sourcePaneId: PaneId): void;
  onClose(): void;
}

export function TabContextMenu({
  docId,
  x,
  y,
  sourcePaneId,
  onOpenToSide,
  onClose,
}: Props) {
  const label =
    sourcePaneId === "primary"
      ? "Open to the Right Side"
      : "Open to the Left Side";
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: y,
        left: x,
        minWidth: 180,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "4px 0",
        zIndex: 1000,
        fontSize: 13,
      }}
    >
      <button
        type="button"
        role="menuitem"
        style={{
          display: "block",
          width: "100%",
          padding: "6px 12px",
          border: 0,
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => {
          onOpenToSide(docId, sourcePaneId);
          onClose();
        }}
      >
        {label}
      </button>
    </div>
  );
}
