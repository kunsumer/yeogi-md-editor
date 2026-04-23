import { TabBar } from "../TabBar";
import { TopBar } from "../TopBar";
import { Editor } from "../Editor";
import { WysiwygEditor } from "../WysiwygEditor";
import { ConflictBanner } from "../ConflictBanner";
import { UpdateBanner } from "../UpdateBanner";
import type { Pane, PaneId, ViewMode } from "../../state/layout";
import type { Document } from "../../state/documents";
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
  onOpenFiles(): void;
  onOpenFolder(): void;
  onCreateBlank(): void;
  onCloseTab(paneId: PaneId, docId: string): void;
  onActivateTab(paneId: PaneId, docId: string): void;
  onOpenToSide(docId: string): void;
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
  onOpenFiles,
  onOpenFolder,
  onCreateBlank,
  onCloseTab,
  onActivateTab,
  onOpenToSide: _onOpenToSide,
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
  const wordCount = (active?.content ?? "").trim().split(/\s+/).filter(Boolean).length;

  // TabBar still uses the legacy docs/activeId/onActivate/onClose/onNew shape.
  // Task 6 migrates it to accept a Pane prop — update this call then.
  const legacyTabs = pane.tabs.map((id) => {
    const d = documents.find((doc) => doc.id === id);
    return {
      id,
      title: d?.path ? (d.path.split("/").pop() ?? "Untitled") : "Untitled",
      isDirty: !!d?.isDirty,
    };
  });

  return (
    <main
      style={mainStyle}
      role="region"
      aria-label={pane.id === "primary" ? "Primary pane" : "Secondary pane"}
      data-testid={`editor-pane-${pane.id}`}
      onMouseDown={() => onFocusPane(pane.id)}
    >
      <TabBar
        docs={legacyTabs}
        activeId={pane.activeTabId}
        onActivate={(id) => onActivateTab(pane.id, id)}
        onClose={(id) => onCloseTab(pane.id, id)}
        onNew={onCreateBlank}
      />
      <TopBar
        path={active?.path ?? null}
        wordCount={wordCount}
        saveState={active?.saveState ?? "idle"}
        isDirty={active?.isDirty ?? false}
        viewMode={pane.viewMode}
        onSetViewMode={active ? (mode) => onSetViewMode(pane.id, mode) : undefined}
        autosaveEnabled={active?.autosaveEnabled}
        onSetAutosaveEnabled={
          active && onSetAutosaveEnabled
            ? (enabled) => onSetAutosaveEnabled(active.id, enabled)
            : undefined
        }
      />
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
          {pane.viewMode === "wysiwyg" ? (
            <WysiwygEditor
              key={active.id}
              content={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={active.readOnly || !isFocused}
              searchOpen={searchOpen}
              searchReplace={searchReplace}
              onSearchClose={onSearchClose}
            />
          ) : (
            <Editor
              docId={active.id}
              value={active.content}
              onChange={(next) => onSetContent(active.id, next)}
              readOnly={active.readOnly || !isFocused}
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
  // 64 × 64 document outline with a circled plus at the bottom-right corner.
  // Stroke-only so the button fill shows through; currentColor lets the icon
  // pick up the hover-state's text color.
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
      {/* Page outline with folded corner */}
      <path d="M12 6 H38 L52 20 V42" />
      <path d="M12 6 V58 H52 V42" />
      <path d="M38 6 V20 H52" />
      {/* Circle with plus in the lower-right */}
      <circle cx="48" cy="48" r="10" />
      <line x1="48" y1="43" x2="48" y2="53" />
      <line x1="43" y1="48" x2="53" y2="48" />
    </svg>
  );
}
