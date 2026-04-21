interface Props {
  isDirty: boolean;
  saveState: "idle" | "saving" | "saved" | "failed";
  wordCount: number;
  watcherOffline: string | null;
}

export function StatusBar({ isDirty, saveState, wordCount, watcherOffline }: Props) {
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
    </div>
  );
}
