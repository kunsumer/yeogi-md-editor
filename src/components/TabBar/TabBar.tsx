import { useEffect, useRef, useState } from "react";
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

// Distance the pointer must travel before a click promotes to a drag.
// Below this threshold a mouseup fires onActivate as before.
const DRAG_THRESHOLD_PX = 4;

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
  // Pointer-events-based tab reorder. HTML5 drag-and-drop in WKWebView
  // (Tauri's macOS engine) has a history of subtle issues — drag images
  // not appearing, dragover failing to fire, etc. Pointer events give
  // us full control: we hit-test against tab DOM rects on each move,
  // flip the rendered order live, and commit on pointerup.
  //
  //   draggingId: which doc id is currently being dragged (state, drives
  //               render). null when no drag is in progress.
  //   previewBeforeId: the id the dragged tab appears BEFORE in the
  //                    live preview ordering. null means "at end."
  //
  // Refs mirror these so the window-level pointermove/up listeners
  // attached on first pointerdown can read the freshest values without
  // re-attaching when state changes.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [previewBeforeId, setPreviewBeforeId] = useState<string | null>(null);
  // While dragging, this is the dragged tab's translateX offset from
  // its resting position (so it visibly follows the cursor instead of
  // jumping between slots). Updated on every pointermove.
  const [cursorOffsetX, setCursorOffsetX] = useState(0);
  const draggingIdRef = useRef<string | null>(null);
  const previewBeforeIdRef = useRef<string | null>(null);
  const dragCandidateRef = useRef<
    { id: string; startX: number; startY: number; pointerId: number } | null
  >(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const onReorderRef = useRef(onReorder);
  const paneTabsRef = useRef(pane.tabs);
  // Captured at drag-start: width of each tab in pane.tabs order. Used to
  // compute slot shifts for non-dragged tabs (translateX = newLeft -
  // oldLeft) so they slide smoothly aside as the dragged tab passes.
  const tabWidthsRef = useRef<number[]>([]);

  // Keep refs in sync with the latest props/state every render. This is
  // the standard pattern for "read the latest from inside long-lived
  // event listeners."
  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);
  useEffect(() => {
    paneTabsRef.current = pane.tabs;
  }, [pane.tabs]);
  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);
  useEffect(() => {
    previewBeforeIdRef.current = previewBeforeId;
  }, [previewBeforeId]);

  // Unmount safety: if the strip unmounts mid-drag (e.g. tab closed
  // by the dragged-tab being cleaned up), drop the global listeners
  // so they don't fire against a torn-down ref.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
    // The handlers are stable (refs read from inside) so we can list
    // an empty dep array — they don't need to re-bind when state
    // changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const showNewBtn = !!(onCreateBlank || onOpenFiles);

  // Compute per-tab visual offsets for the live drag. We always render
  // tabs in the original pane.tabs order so each tab keeps its DOM
  // identity + listeners; the drag effect is purely a transform.
  //
  //   - The dragged tab translates by `cursorOffsetX` (the cursor's
  //     delta from where the drag started). It visibly follows the
  //     cursor and has no transition.
  //   - All other tabs translate by their "slot shift": the difference
  //     between their original left-edge and where they sit in the
  //     preview ordering. Those have a transition so they slide smoothly.
  //
  // `slotOffsets` is keyed by doc id. Non-dragging tabs that don't
  // shift have an offset of 0; we still include them so the .get() in
  // the render is safe.
  const slotOffsets = (() => {
    const offsets = new Map<string, number>();
    if (!draggingId || !pane.tabs.includes(draggingId)) return offsets;
    const widths = tabWidthsRef.current;
    if (widths.length !== pane.tabs.length) return offsets;
    // Original left-edge of every tab.
    const origLeft = new Map<string, number>();
    let acc = 0;
    for (let i = 0; i < pane.tabs.length; i++) {
      origLeft.set(pane.tabs[i], acc);
      acc += widths[i];
    }
    // Preview order = pane.tabs with dragged removed and reinserted
    // before previewBeforeId (or at end when null).
    const without = pane.tabs.filter((id) => id !== draggingId);
    let preview: string[];
    if (previewBeforeId === null) {
      preview = [...without, draggingId];
    } else {
      const at = without.indexOf(previewBeforeId);
      preview =
        at < 0
          ? [...without, draggingId]
          : [...without.slice(0, at), draggingId, ...without.slice(at)];
    }
    // New left-edge per tab in the preview.
    const widthOf = new Map<string, number>();
    for (let i = 0; i < pane.tabs.length; i++) {
      widthOf.set(pane.tabs[i], widths[i]);
    }
    const newLeft = new Map<string, number>();
    acc = 0;
    for (const id of preview) {
      newLeft.set(id, acc);
      acc += widthOf.get(id) ?? 0;
    }
    for (const id of pane.tabs) {
      offsets.set(id, (newLeft.get(id) ?? 0) - (origLeft.get(id) ?? 0));
    }
    return offsets;
  })();

  // Window-level pointer listeners — attached once on first drag start,
  // detached on pointerup or pointercancel. Read state via refs so we
  // never re-attach mid-drag.
  function onWindowPointerMove(e: PointerEvent) {
    const candidate = dragCandidateRef.current;
    if (!candidate) return;
    if (e.pointerId !== candidate.pointerId) return;

    // Promote candidate → active drag once the user has moved past the
    // threshold. Below it, we're still inside "click" territory and
    // bailing out preserves the click → onActivate behavior.
    if (draggingIdRef.current === null) {
      const dx = e.clientX - candidate.startX;
      const dy = e.clientY - candidate.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      draggingIdRef.current = candidate.id;
      setDraggingId(candidate.id);
      // Capture each tab's width once at drag-start so slot shifts
      // are computed against a stable layout (the live render flips
      // transforms on the tabs, which would skew offsetWidth if read
      // mid-drag).
      const strip = stripRef.current;
      if (strip) {
        const els = strip.querySelectorAll<HTMLElement>("[data-tab-id]");
        tabWidthsRef.current = Array.from(els).map((el) => el.offsetWidth);
      }
      // Initialize preview anchor at the dragged tab's current spot
      // so the first move doesn't cause a visual jump.
      const tabs = paneTabsRef.current;
      const idx = tabs.indexOf(candidate.id);
      const initialBefore = tabs[idx + 1] ?? null;
      previewBeforeIdRef.current = initialBefore;
      setPreviewBeforeId(initialBefore);
      setCursorOffsetX(0);
    }

    // Update cursor offset so the dragged tab follows the cursor.
    setCursorOffsetX(e.clientX - candidate.startX);

    // Hit-test against the rendered tabs. Each tab carries data-tab-id
    // attribute; cursor's left/right half of a tab's rect determines
    // before/after.
    const strip = stripRef.current;
    if (!strip) return;
    const draggedId = draggingIdRef.current;
    const tabs = paneTabsRef.current;
    let resolved: string | null | undefined = undefined;
    const tabEls = strip.querySelectorAll<HTMLElement>("[data-tab-id]");
    for (const el of Array.from(tabEls)) {
      const id = el.getAttribute("data-tab-id");
      if (!id || id === draggedId) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.right) {
        const before = e.clientX < rect.left + rect.width / 2;
        const targetIdx = tabs.indexOf(id);
        resolved = before ? id : tabs[targetIdx + 1] ?? null;
        break;
      }
    }
    // If the cursor is past the last tab (or the strip has no other
    // tabs), park the dragged tab at the end.
    if (resolved === undefined) resolved = null;
    if (resolved !== previewBeforeIdRef.current) {
      previewBeforeIdRef.current = resolved;
      setPreviewBeforeId(resolved);
    }
  }

  function onWindowPointerUp(e: PointerEvent) {
    const candidate = dragCandidateRef.current;
    if (!candidate) return;
    if (e.pointerId !== candidate.pointerId) return;

    const wasDragging = draggingIdRef.current !== null;
    const draggedId = draggingIdRef.current;
    const beforeId = previewBeforeIdRef.current;

    // Always tear down listeners + state, regardless of click vs drag.
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
    dragCandidateRef.current = null;
    draggingIdRef.current = null;
    previewBeforeIdRef.current = null;

    if (wasDragging) {
      setDraggingId(null);
      setPreviewBeforeId(null);
      setCursorOffsetX(0);
      tabWidthsRef.current = [];
      if (draggedId && onReorderRef.current) {
        onReorderRef.current(draggedId, beforeId);
      }
    }
    // If !wasDragging, the user just clicked — onActivate already fired
    // from the tab's onClick before the pointer moved past threshold.
  }

  function onTabPointerDown(e: React.PointerEvent, id: string) {
    if (!onReorder) return;
    if (e.button !== 0) return;
    if (e.target instanceof Element) {
      // Skip drags initiated on interactive children (close button)
      // so clicking the X doesn't accidentally start a drag.
      const closest = e.target.closest("button");
      if (closest && closest !== e.currentTarget) return;
    }
    dragCandidateRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
  }

  // Render in the original pane.tabs order. Drag visual is purely a
  // transform on each tab — the DOM doesn't actually reorder until the
  // user drops and onReorder updates state.
  const tabs = pane.tabs.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? d.path.split("/").pop()! : "Untitled",
      isDirty: !!d?.isDirty,
    };
  });
  return (
    <div
      ref={stripRef}
      role="tablist"
      className="app-tabbar"
      style={tablistStyle}
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
            data-tab-id={d.id}
            onPointerDown={(e) => onTabPointerDown(e, d.id)}
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
              // Visual drag effect:
              //  - dragged tab: translateX = cursor offset (no transition,
              //    follows the cursor in real time). Lifted z-index +
              //    a subtle drop shadow so it reads as "picked up".
              //  - other tabs: translateX = slot shift, with a smooth
              //    transition so they slide aside as the dragged passes.
              transform: isDragSource
                ? `translateX(${cursorOffsetX}px)`
                : `translateX(${slotOffsets.get(d.id) ?? 0}px)`,
              transition: isDragSource
                ? "none"
                : "transform 160ms ease",
              zIndex: isDragSource ? 5 : 0,
              boxShadow: isDragSource
                ? "0 4px 10px rgba(0,0,0,0.18)"
                : tabBaseStyle.boxShadow,
              opacity: isDragSource ? 0.92 : 1,
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
