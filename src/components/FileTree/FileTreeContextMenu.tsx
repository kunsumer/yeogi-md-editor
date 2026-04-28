import { useEffect, useRef } from "react";

interface Action {
  label: string;
  onSelect: () => void;
  /** Render a separator above this item. */
  separatorAbove?: boolean;
  destructive?: boolean;
}

interface Props {
  x: number;
  y: number;
  actions: Action[];
  onClose(): void;
}

/**
 * Generic right-click menu for FileTree rows. Appears at the click
 * coordinates, clamps inside the viewport, and dismisses on outside-click
 * or Escape. Each action's onSelect runs *before* the menu's onClose so
 * follow-up dialogs (e.g. Rename's prompt) get a clean window of the
 * menu being unmounted.
 */
export function FileTreeContextMenu({ x, y, actions, onClose }: Props) {
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

  // Naive clamp so the menu doesn't fall off the bottom/right of the
  // viewport when right-clicking near an edge. Uses a fixed estimated
  // size; close enough for a tiny menu of ~5 items.
  const clampedX = Math.min(x, window.innerWidth - 200);
  const clampedY = Math.min(y, window.innerHeight - 32 * (actions.length + 1));

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: clampedY,
        left: clampedX,
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
      {actions.map((a, i) => (
        <div key={`${i}-${a.label}`}>
          {a.separatorAbove && (
            <div
              role="separator"
              style={{
                margin: "4px 0",
                height: 1,
                background: "var(--border)",
              }}
            />
          )}
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
              color: a.destructive ? "var(--danger)" : "var(--text)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            onClick={() => {
              a.onSelect();
              onClose();
            }}
          >
            {a.label}
          </button>
        </div>
      ))}
    </div>
  );
}
