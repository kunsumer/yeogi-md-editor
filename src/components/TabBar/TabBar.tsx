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
  /**
   * Called when a tab is dropped onto a new slot via drag-reorder. `beforeId`
   * is the id of the tab the dragged one should land before; null means
   * "drop at the end of the strip".
   */
  onReorder?: (draggedDocId: string, beforeId: string | null) => void;
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

// MIME-ish key for the drag payload. Custom prefix so it doesn't collide
// with file drops or text drags that happen to share dataTransfer.
const TAB_DND_TYPE = "application/x-yeogi-tab-id";

export function TabBar({
  pane,
  isFocused,
  documents,
  onActivate,
  onClose,
  onOpenToSide,
  onReorder,
  onCreateBlank,
  onOpenFiles,
}: Props) {
  const [ctx, setCtx] = useState<{ docId: string; x: number; y: number } | null>(null);
  const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null);
  // Live tab reorder state — Chrome-style. While the user drags a tab,
  // we visually rearrange the rendered list so other tabs slide out of
  // the way as the dragged one moves over them. On drop we commit the
  // current preview order via onReorder.
  //
  //   draggingId: which doc id is being dragged (null when no drag).
  //   previewBeforeId: the doc id that the dragged tab should appear
  //                    BEFORE in the live preview. null means "at end."
  //
  // Dragover handlers update previewBeforeId based on which half of the
  // hovered target tab the cursor sits in. The render below filters
  // draggingId out of the tab list and re-inserts it at the previewed
  // slot, so the user sees the new order before they release.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewBeforeId, setPreviewBeforeId] = useState<string | null>(null);
  const showNewBtn = !!(onCreateBlank || onOpenFiles);
  // While dragging, render tabs in the preview order: filter out the
  // dragged id and reinsert it at the slot before previewBeforeId
  // (or at the end if previewBeforeId is null). When not dragging we
  // just render pane.tabs as-is.
  const orderedIds = (() => {
    if (!draggingId || !pane.tabs.includes(draggingId)) return pane.tabs;
    const without = pane.tabs.filter((id) => id !== draggingId);
    if (previewBeforeId === null) return [...without, draggingId];
    const insertAt = without.indexOf(previewBeforeId);
    if (insertAt < 0) return [...without, draggingId];
    return [
      ...without.slice(0, insertAt),
      draggingId,
      ...without.slice(insertAt),
    ];
  })();

  const tabs = orderedIds.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? d.path.split("/").pop()! : "Untitled",
      isDirty: !!d?.isDirty,
    };
  });
  return (
    <div
      role="tablist"
      className="app-tabbar"
      style={tablistStyle}
      onDragOver={(e) => {
        // Allow drops on the strip's empty trailing area (past the last
        // tab). Per-tab handlers stopPropagation so this only fires in
        // the gap. While dragging through that gap, treat it as "land
        // at end" and update the live preview accordingly.
        if (!onReorder || !draggingId) return;
        if (!e.dataTransfer.types.includes(TAB_DND_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (previewBeforeId !== null) setPreviewBeforeId(null);
      }}
      onDrop={(e) => {
        if (!onReorder || !draggingId) return;
        const draggedId = e.dataTransfer.getData(TAB_DND_TYPE);
        if (!draggedId) return;
        // Reaching here means the user dropped in the empty area
        // past the last tab → land at end.
        e.preventDefault();
        const id = draggingId;
        setDraggingId(null);
        setPreviewBeforeId(null);
        onReorder(id, null);
      }}
    >
      {tabs.map((d) => {
        const active = d.id === pane.activeTabId;
        const isDragSource = draggingId === d.id;
        const tabBaseStyle = tabStyle(active, isFocused);
        return (
          <div
            key={d.id}
            role="tab"
            aria-selected={active}
            data-dirty={d.isDirty ? "true" : "false"}
            draggable={!!onReorder}
            onDragStart={(e) => {
              if (!onReorder) return;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(TAB_DND_TYPE, d.id);
              setDraggingId(d.id);
              // Initialize the preview anchor at this tab's current
              // position so the first dragover doesn't briefly show
              // a different placement.
              const idx = pane.tabs.indexOf(d.id);
              setPreviewBeforeId(pane.tabs[idx + 1] ?? null);
            }}
            onDragOver={(e) => {
              if (!onReorder || !draggingId) return;
              // preventDefault: enable drop on this target.
              // stopPropagation: keep the strip-level handler from
              // also processing this dragover.
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              if (d.id === draggingId) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const before =
                e.clientX < rect.left + rect.width / 2;
              // Resolve to the BEFORE-id from the original list
              // ordering (pane.tabs), not the preview-rendered order:
              // pane.tabs is the source of truth that onReorder will
              // apply against on drop.
              const targetIdx = pane.tabs.indexOf(d.id);
              const next = before
                ? d.id
                : pane.tabs[targetIdx + 1] ?? null;
              if (next !== previewBeforeId) setPreviewBeforeId(next);
            }}
            onDrop={(e) => {
              if (!onReorder || !draggingId) return;
              // Without stopPropagation the drop bubbles to the
              // strip-level handler which calls
              // onReorder(draggedId, null) → "append to end" — and
              // every per-tab drop silently degrades to that.
              e.preventDefault();
              e.stopPropagation();
              const beforeId = previewBeforeId;
              const id = draggingId;
              setDraggingId(null);
              setPreviewBeforeId(null);
              if (id === d.id) return;
              onReorder(id, beforeId);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setPreviewBeforeId(null);
            }}
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
            style={{
              ...tabBaseStyle,
              opacity: isDragSource ? 0.5 : 1,
            }}
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
