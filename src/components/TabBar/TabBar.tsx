import { useState } from "react";
import type { Pane, PaneId } from "../../state/layout";
import type { Document } from "../../state/documents";
import { TabContextMenu } from "./TabContextMenu";
import { TabNewMenu } from "./TabNewMenu";

interface Props {
  pane: Pane;
  isFocused: boolean;
  documents: Document[];
  onActivate(id: string): void;
  onClose(id: string): void;
  onOpenToSide(id: string, sourcePaneId: PaneId): void;
  /** When either is provided, a "+" button renders at the end of the tab
   *  strip. Clicking it opens a menu offering both options. */
  onCreateBlank?: () => void;
  onOpenFiles?: () => void;
}

const tablistStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 2,
  height: 38,
  background: "var(--bg-tabbar)",
  padding: "0 8px",
  overflowX: "auto",
  overflowY: "hidden",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const tabStyle = (active: boolean, isFocused: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  maxWidth: 220,
  height: 32,
  padding: "0 10px 0 14px",
  borderRadius: "6px 6px 0 0",
  background: active ? "var(--bg-tab-active)" : "var(--bg-tab-inactive)",
  color: active ? "var(--text)" : "var(--text-muted)",
  boxShadow: active
    ? `inset 0 2px 0 0 var(${isFocused ? "--brand-red" : "--border-strong"})`
    : "none",
  cursor: "pointer",
  userSelect: "none",
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  whiteSpace: "nowrap",
  transition: "background 120ms, color 120ms",
});

const closeBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "inherit",
  opacity: 0.6,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "currentColor",
  display: "inline-block",
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  flex: 1,
};

const newTabBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  marginLeft: 4,
  marginBottom: 2,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  alignSelf: "center",
};

export function TabBar({
  pane,
  isFocused,
  documents,
  onActivate,
  onClose,
  onOpenToSide,
  onCreateBlank,
  onOpenFiles,
}: Props) {
  const [ctx, setCtx] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  const showNewBtn = !!(onCreateBlank || onOpenFiles);
  const tabs = pane.tabs.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? d.path.split("/").pop()! : "Untitled",
      isDirty: !!d?.isDirty,
    };
  });
  return (
    <div role="tablist" className="app-tabbar" style={tablistStyle}>
      {tabs.map((d) => {
        const active = d.id === pane.activeTabId;
        return (
          <div
            key={d.id}
            role="tab"
            aria-selected={active}
            data-dirty={d.isDirty ? "true" : "false"}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(d.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtx({ docId: d.id, x: e.clientX, y: e.clientY });
            }}
            onClick={() => onActivate(d.id)}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-tabbar-hover)";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text-muted)";
              }
            }}
            style={tabStyle(active, isFocused)}
          >
            {d.isDirty && <span aria-hidden="true" style={dotStyle} />}
            <span style={titleStyle}>{d.title}</span>
            <button
              aria-label={`Close ${d.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(d.id);
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.08)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.6";
              }}
              style={closeBtnStyle}
            >
              ×
            </button>
          </div>
        );
      })}
      {showNewBtn && (
        <button
          type="button"
          aria-label="New tab"
          title="New tab"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setNewMenu({ x: rect.left, y: rect.bottom + 4 });
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-tabbar-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
          style={newTabBtnStyle}
        >
          +
        </button>
      )}
      {ctx && (
        <TabContextMenu
          docId={ctx.docId}
          x={ctx.x}
          y={ctx.y}
          sourcePaneId={pane.id}
          onOpenToSide={(id, source) => onOpenToSide(id, source)}
          onClose={() => setCtx(null)}
        />
      )}
      {newMenu && (
        <TabNewMenu
          x={newMenu.x}
          y={newMenu.y}
          onCreateBlank={() => onCreateBlank?.()}
          onOpenFiles={() => onOpenFiles?.()}
          onClose={() => setNewMenu(null)}
        />
      )}
    </div>
  );
}
