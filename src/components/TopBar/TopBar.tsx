interface Props {
  path: string | null;
  wordCount: number;
  saveState: "idle" | "saving" | "saved" | "failed";
  isDirty: boolean;
  onTogglePreview?: () => void;
  previewOpen?: boolean;
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

export function TopBar({
  path,
  wordCount,
  saveState,
  isDirty,
  onTogglePreview,
  previewOpen = false,
}: Props) {
  const filename = path ? path.split("/").pop() : "Untitled";
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "failed"
          ? "Save failed"
          : isDirty
            ? "Unsaved"
            : "";
  return (
    <div style={wrap}>
      <div style={{ ...meta, color: "var(--text)", fontWeight: 500 }}>
        {isDirty && (
          <span
            aria-label="unsaved changes"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              marginRight: 6,
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
      {onTogglePreview && (
        <button
          className={previewOpen ? "btn-ghost" : "btn-primary"}
          onClick={onTogglePreview}
          aria-pressed={previewOpen}
        >
          {previewOpen ? "Close preview" : "Open preview"}
        </button>
      )}
    </div>
  );
}
