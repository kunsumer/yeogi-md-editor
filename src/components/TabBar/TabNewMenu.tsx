import { useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  onCreateBlank(): void;
  onOpenFiles(): void;
  onClose(): void;
}

/**
 * Popover rendered by the tab strip's "+" button. Asks the user whether to
 * start a blank doc or open an existing file, matching the "New" behavior of
 * most document apps (Word, Pages, etc.).
 */
export function TabNewMenu({ x, y, onCreateBlank, onOpenFiles, onClose }: Props) {
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

  const item: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "6px 12px",
    border: 0,
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--text)",
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: y,
        left: x,
        minWidth: 200,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        padding: "4px 0",
        zIndex: 1000,
      }}
    >
      <button
        type="button"
        role="menuitem"
        style={item}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => {
          onCreateBlank();
          onClose();
        }}
      >
        Create blank document
      </button>
      <button
        type="button"
        role="menuitem"
        style={item}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => {
          onOpenFiles();
          onClose();
        }}
      >
        Open file(s)…
      </button>
    </div>
  );
}
