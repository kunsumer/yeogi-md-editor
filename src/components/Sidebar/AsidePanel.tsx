import type { ReactNode } from "react";

interface Props {
  title: string;
  /** Accessible landmark label (visible title may be truncated). */
  ariaLabel: string;
  /** Optional right-aligned content inside the header — a button, menu trigger, etc. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Shared chrome for sidebar panels: a small header bar with a title and
 * optional action slot, plus a scrolling body. Used by FolderPanel and
 * TocPanel so both have identical visual treatment.
 */
export function AsidePanel({ title, ariaLabel, action, children }: Props) {
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
          gap: 8,
          padding: "10px 12px 8px",
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
      </header>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "8px 8px 12px",
        }}
      >
        {children}
      </div>
    </aside>
  );
}
