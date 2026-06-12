import type { ReactNode } from "react";
import { CloseIcon } from "../icons";

interface Props {
  title: string;
  /** Accessible landmark label (visible title may be truncated). */
  ariaLabel: string;
  /** Optional right-aligned content inside the header — a button row, menu trigger, etc. */
  action?: ReactNode;
  /** Optional dismiss handler. When provided, renders an X button on the far right. */
  onClose?: () => void;
  children: ReactNode;
}

/**
 * Shared chrome for sidebar panels: a small header bar with a title and
 * optional action slot, plus a scrolling body. Used by FolderPanel and
 * TocPanel so both have identical visual treatment.
 */
export function AsidePanel({ title, ariaLabel, action, onClose, children }: Props) {
  return (
    <aside
      role="complementary"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 28,
          padding: "0 6px 0 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "var(--text-faint)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={title}
        >
          {title}
        </span>
        {action}
        {onClose && (
          <>
            {action != null && (
              // The X dismisses the PANEL — it's window chrome, not one of
              // the panel's own actions. The hairline divider groups the
              // action icons away from it so the two don't read as one row
              // of equivalent buttons.
              <span
                aria-hidden="true"
                style={{
                  width: 1,
                  height: 14,
                  background: "var(--border-strong)",
                  margin: "0 3px",
                  flexShrink: 0,
                }}
              />
            )}
            <button
              type="button"
              aria-label={`Close ${ariaLabel}`}
              title="Close panel"
              onClick={onClose}
              className="aside-header-btn"
            >
              <CloseIcon />
            </button>
          </>
        )}
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "4px 8px 12px",
        }}
      >
        {children}
      </div>
    </aside>
  );
}

