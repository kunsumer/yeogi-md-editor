import { TabBar } from "../TabBar";
import { TopBar } from "../TopBar";
import { Editor } from "../Editor";
import { WysiwygEditor } from "../WysiwygEditor";
import { ConflictBanner } from "../ConflictBanner";
import { UpdateBanner } from "../UpdateBanner";
import type { Pane, PaneId, ViewMode } from "../../state/layout";
import type { Document } from "../../state/documents";
import { isMarkdownPath } from "../../lib/isMarkdownPath";
import type { EditorView } from "@codemirror/view";
import type { Update } from "@tauri-apps/plugin-updater";

// Mirror the Status type from UpdateBanner so we can pass it typed.
type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; received: number; total: number | null }
  | { kind: "installing"; update: Update }
  | { kind: "installed"; update: Update }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

interface Props {
  pane: Pane;
  isFocused: boolean;
  documents: Document[];
  otherPaneActiveTabId: string | null;
  onOpenFiles(): void;
  onOpenFolder(): void;
  onCreateBlank(): void;
  onCloseTab(paneId: PaneId, docId: string): void;
  onActivateTab(paneId: PaneId, docId: string): void;
  onOpenToSide(docId: string, sourcePaneId: PaneId): void;
  onSetViewMode(paneId: PaneId, mode: ViewMode): void;
  onFocusPane(paneId: PaneId): void;
  onSetContent(docId: string, next: string): void;
  onSetAutosaveEnabled?: (docId: string, enabled: boolean) => void;

  // Primary-pane-only pass-throughs (safe to ignore on secondary):
  searchOpen?: boolean;
  searchReplace?: boolean;
  onSearchClose?: () => void;
  onEditorReady?: (view: EditorView) => void;

  // UpdateBanner state — only meaningful for the primary pane.
  updateStatus?: UpdateStatus;
  onUpdateInstall?: (update: Update) => void;
  onUpdateDismiss?: () => void;

  // ConflictBanner handlers.
  onConflictKeep?: () => void;
  onConflictReload?: () => void;
}

const mainStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  color: "var(--text-faint)",
  fontSize: 13,
};

export function EditorPane({
  pane,
  isFocused,
  documents,
  otherPaneActiveTabId,
  onOpenFiles,
  onOpenFolder,
  onCreateBlank,
  onCloseTab,
  onActivateTab,
  onOpenToSide,
  onSetViewMode,
  onFocusPane,
  onSetContent,
  onSetAutosaveEnabled,
  searchOpen,
  searchReplace,
  onSearchClose,
  onEditorReady,
  updateStatus,
  onUpdateInstall,
  onUpdateDismiss,
  onConflictKeep,
  onConflictReload,
}: Props) {
  const active = documents.find((d) => d.id === pane.activeTabId) ?? null;

  const sameDocLock =
    pane.id === "secondary" &&
    active != null &&
    otherPaneActiveTabId === active.id;

  // Non-markdown files (.txt / .json / .sh / .yaml / .yml / .toml / .log /
  // .csv) open in Edit mode only — Tiptap's parser would mangle them and
  // the formatting toolbar wouldn't apply anyway. Force the view mode for
  // the renderer below regardless of what's stored on the pane, and pass
  // a flag down to TopBar so it can hide the WYSIWYG/Edit toggle.
  const isMarkdown = isMarkdownPath(active?.path);
  const effectiveViewMode: ViewMode = isMarkdown ? pane.viewMode : "edit";

  // Both panes are editable when they show different docs — they're separate
  // editor instances with separate undo histories, so no dual-undo hazard.
  // The only hard read-only case is the same-doc lock (secondary mirrors
  // primary's buffer, so we keep writes one-directional there).
  const editable = !sameDocLock && !active?.readOnly;

  return (
    <main
      style={mainStyle}
      role="region"
      aria-label={pane.id === "primary" ? "Primary pane" : "Secondary pane"}
      data-testid={`editor-pane-${pane.id}`}
      onMouseDown={() => onFocusPane(pane.id)}
    >
      <TabBar
        pane={pane}
        isFocused={isFocused}
        documents={documents}
        onActivate={(id) => onActivateTab(pane.id, id)}
        onClose={(id) => onCloseTab(pane.id, id)}
        onOpenToSide={(id, source) => onOpenToSide(id, source)}
        onCreateBlank={onCreateBlank}
        onOpenFiles={onOpenFiles}
      />
      <TopBar
        pane={pane}
        active={active}
        viewModeLocked={!isMarkdown}
        onSetViewMode={(mode) => onSetViewMode(pane.id, mode)}
        onSetAutosaveEnabled={(enabled) => {
          if (active) onSetAutosaveEnabled?.(active.id, enabled);
        }}
      />
      {sameDocLock && (
        <div
          role="status"
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            padding: "8px 12px",
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border)",
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: "var(--text)", fontWeight: 600 }}>
            Read-only preview.
          </strong>{" "}
          This document is already open in the left pane. To keep undo
          history coherent, it can only be edited from there — changes you
          make on the left will mirror here live.
        </div>
      )}
      {pane.id === "primary" && updateStatus !== undefined && onUpdateInstall && onUpdateDismiss && (
        <UpdateBanner
          status={updateStatus}
          onInstall={onUpdateInstall}
          onDismiss={onUpdateDismiss}
        />
      )}
      {pane.id === "primary" && active?.conflict && onConflictKeep && onConflictReload && (
        <ConflictBanner
          onKeep={onConflictKeep}
          onReload={onConflictReload}
          onDiff={() => console.log("diff viewer is post-v1")}
        />
      )}
      {active ? (
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
          {effectiveViewMode === "wysiwyg" ? (
            <WysiwygEditor
              key={active.id}
              content={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={!editable}
              searchOpen={searchOpen}
              searchReplace={searchReplace}
              onSearchClose={onSearchClose}
            />
          ) : (
            <Editor
              docId={active.id}
              value={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={!editable}
              onReady={onEditorReady ?? (() => {})}
            />
          )}
        </div>
      ) : (
        <EmptyState
          onCreateBlank={onCreateBlank}
          onOpenFiles={onOpenFiles}
          onOpenFolder={onOpenFolder}
        />
      )}
    </main>
  );
}

function EmptyState({
  onCreateBlank,
  onOpenFiles,
  onOpenFolder,
}: {
  onCreateBlank(): void;
  onOpenFiles(): void;
  onOpenFolder(): void;
}) {
  return (
    <div style={emptyStateStyle}>
      <button
        type="button"
        onClick={onCreateBlank}
        aria-label="Create blank document"
        title="Create blank document"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          padding: "24px 32px",
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--bg)",
          color: "var(--text)",
          cursor: "pointer",
          transition: "background 120ms, border-color 120ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        }}
      >
        <BlankDocumentIcon />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Create blank document</span>
      </button>
      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>or open an existing file</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-ghost" onClick={onOpenFiles}>
          Open file(s)…
        </button>
        <button className="btn-ghost" onClick={onOpenFolder}>
          Open folder…
        </button>
      </div>
    </div>
  );
}

function BlankDocumentIcon() {
  // 64 × 64 document with rounded corners and a circled plus overlaid on
  // the bottom-right. The circle is filled with the page/button background
  // (`var(--bg)`) so the document's stroke is OCCLUDED behind it — the two
  // shapes read as one stacked glyph, not as see-through overlapping outlines.
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Page body: rounded rectangle with a folded top-right corner.
          Occupies x=10..46 / y=8..56. */}
      <path d="M14 8 H36 L46 18 V52 Q46 56 42 56 H14 Q10 56 10 52 V12 Q10 8 14 8 Z" />
      {/* Folded corner indicator */}
      <path d="M36 8 V18 H46" />
      {/* Circle overlay — filled with the button background so the page
          stroke disappears behind it. Placed over the page's bottom-right. */}
      <circle cx="46" cy="50" r="10" fill="var(--bg)" />
      <line x1="46" y1="45" x2="46" y2="55" />
      <line x1="41" y1="50" x2="51" y2="50" />
    </svg>
  );
}
