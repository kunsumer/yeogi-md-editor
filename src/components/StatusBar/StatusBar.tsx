interface Props {
  isDirty: boolean;
  saveState: "idle" | "saving" | "saved" | "failed";
  wordCount: number;
  watcherOffline: string | null;
  onTogglePreview?: () => void;
  previewOpen?: boolean;
}

export function StatusBar({
  isDirty,
  saveState,
  wordCount,
  watcherOffline,
  onTogglePreview,
  previewOpen = false,
}: Props) {
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "failed"
          ? "Save failed"
          : "";
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "4px 8px",
        borderTop: "1px solid #ccc",
        fontSize: 12,
        alignItems: "center",
      }}
    >
      {isDirty && <span aria-label="unsaved changes">•</span>}
      <span>{saveLabel}</span>
      <span>{wordCount} words</span>
      {watcherOffline && (
        <span role="alert" title={watcherOffline}>
          ⚠ file watcher offline — external changes won't reload
        </span>
      )}
      <span style={{ marginLeft: "auto" }}>
        {onTogglePreview && (
          <button onClick={onTogglePreview} aria-pressed={previewOpen}>
            {previewOpen ? "Close preview" : "Open preview"}
          </button>
        )}
      </span>
    </div>
  );
}
