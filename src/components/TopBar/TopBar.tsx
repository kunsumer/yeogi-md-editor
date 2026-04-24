import type { Pane, ViewMode } from "../../state/layout";
import type { Document } from "../../state/documents";

interface Props {
  pane: Pane;
  active: Document | null;
  /**
   * When true the WYSIWYG/Edit segmented control is hidden — used for
   * non-markdown files (.txt / .json / .sh / etc.) where Tiptap's parser
   * doesn't apply and Edit mode is the only meaningful option.
   */
  viewModeLocked?: boolean;
  onSetViewMode(mode: ViewMode): void;
  onSetAutosaveEnabled(enabled: boolean): void;
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  height: 44,
  padding: "0 16px",
  background: "var(--bg-topbar)",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const meta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: "var(--text-muted)",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const separator: React.CSSProperties = {
  width: 1,
  height: 14,
  background: "var(--border)",
};

const segWrap: React.CSSProperties = {
  display: "inline-flex",
  border: "1px solid var(--border)",
  borderRadius: 6,
  overflow: "hidden",
  background: "var(--bg)",
};

const segBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 14px",
  border: 0,
  // Inverted fill for the selected segment: the background is the
  // foreground text color, the foreground is the background. In light
  // mode that reads as black-on-white → dark pill with white text; in
  // dark mode it flips to white-on-black → light pill with dark text.
  // Previously the color was hardcoded to "#fff", which collided with
  // the already-light background var in dark mode.
  background: active ? "var(--text)" : "transparent",
  color: active ? "var(--bg)" : "var(--text-muted)",
  fontSize: 12,
  fontWeight: active ? 500 : 400,
  cursor: "pointer",
  transition: "background 120ms, color 120ms",
});

const autosaveWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: "var(--text-muted)",
  userSelect: "none",
};

const switchTrack = (on: boolean): React.CSSProperties => ({
  position: "relative",
  width: 30,
  height: 16,
  borderRadius: 999,
  background: on ? "var(--brand-red)" : "var(--border-strong, #d1d5db)",
  cursor: "pointer",
  transition: "background 140ms ease",
  flexShrink: 0,
});

const switchThumb = (on: boolean): React.CSSProperties => ({
  position: "absolute",
  top: 2,
  left: on ? 16 : 2,
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
  transition: "left 140ms ease",
});

export function TopBar({
  pane,
  active,
  viewModeLocked = false,
  onSetViewMode,
  onSetAutosaveEnabled,
}: Props) {
  const filename = active?.path ? active.path.split("/").pop() : "Untitled";
  const wordCount = (active?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  const isDirty = !!active?.isDirty;
  const saveState = active?.saveState ?? "idle";
  const autosaveEnabled = active?.autosaveEnabled ?? false;
  const viewMode = pane.viewMode;

  // Priority matters: if the buffer has been modified since the last save
  // we must surface "Unsaved" immediately, even though `saveState` is still
  // "saved" from the previous write. Otherwise the user gets a stale
  // "Saved" label while autosave is off and edits are piling up.
  const saveLabel =
    saveState === "saving" ? "Saving…"
    : saveState === "failed" ? "Save failed"
    : isDirty ? "Unsaved"
    : saveState === "saved" ? "Saved"
    : "";

  return (
    <div className="app-topbar" style={wrap}>
      <div style={{ ...meta, color: "var(--text)", fontWeight: 500 }}>
        {isDirty && (
          <span
            aria-label="unsaved changes"
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--accent)", marginRight: 6,
            }}
          />
        )}
        <span style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
          {filename}
        </span>
      </div>
      <div style={separator} />
      <div style={meta}>
        <span aria-label="word count">
          {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
        </span>
      </div>
      {saveLabel && (
        <>
          <div style={separator} />
          <div style={meta}>
            <span style={{ color: saveState === "failed" ? "var(--danger)" : undefined }}>
              {saveLabel}
            </span>
          </div>
        </>
      )}
      <div style={{ flex: 1 }} />
      {active && (
        <label style={autosaveWrap} title="Autosave this document on every keystroke (debounced)">
          <span>Autosave</span>
          <button
            type="button"
            role="switch"
            aria-checked={autosaveEnabled}
            aria-label="Toggle autosave for this document"
            onClick={() => onSetAutosaveEnabled(!autosaveEnabled)}
            style={{ ...switchTrack(autosaveEnabled), border: 0, padding: 0 }}
          >
            <span style={switchThumb(autosaveEnabled)} aria-hidden="true" />
          </button>
        </label>
      )}
      {!viewModeLocked && (
        <div style={segWrap} role="group" aria-label="View mode">
          <button
            type="button"
            style={segBtn(viewMode === "wysiwyg")}
            onClick={() => onSetViewMode("wysiwyg")}
            aria-pressed={viewMode === "wysiwyg"}
          >
            WYSIWYG
          </button>
          <button
            type="button"
            style={segBtn(viewMode === "edit")}
            onClick={() => onSetViewMode("edit")}
            aria-pressed={viewMode === "edit"}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
