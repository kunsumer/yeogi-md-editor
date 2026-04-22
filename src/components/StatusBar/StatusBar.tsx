interface Props {
  saveState: "idle" | "saving" | "saved" | "failed";
  watcherOffline: string | null;
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 16px",
  borderTop: "1px solid var(--border)",
  background: "var(--bg)",
  fontSize: 11,
  color: "var(--text-muted)",
  flexShrink: 0,
};

/**
 * Minimal footer strip. Only renders when there's a real message to surface
 * (save failure, watcher offline). The per-edit metadata (word count, dirty,
 * save state) lives in the TopBar now.
 */
export function StatusBar({ saveState, watcherOffline }: Props) {
  const saveFailed = saveState === "failed";
  if (!saveFailed && !watcherOffline) return null;
  return (
    <div className="app-statusbar" style={wrap}>
      {saveFailed && (
        <span role="alert" style={{ color: "var(--danger)" }}>
          ⚠ Save failed — check permissions or disk space
        </span>
      )}
      {watcherOffline && (
        <span role="alert" title={watcherOffline}>
          ⚠ File watcher offline — external changes won't reload
        </span>
      )}
    </div>
  );
}
