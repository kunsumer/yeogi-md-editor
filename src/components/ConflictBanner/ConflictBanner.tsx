interface Props {
  onKeep: () => void;
  onReload: () => void;
  onDiff: () => void;
}

export function ConflictBanner({ onKeep, onReload, onDiff }: Props) {
  return (
    <div
      role="alert"
      style={{ background: "#fff3cd", padding: 12, borderBottom: "1px solid #e0c872" }}
    >
      <strong>File changed on disk.</strong>
      <span style={{ marginLeft: 8, opacity: 0.8 }}>Your edits are unsaved.</span>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={onKeep}>Keep mine</button>
        <button onClick={onReload}>Reload disk</button>
        <button onClick={onDiff}>Show diff</button>
      </div>
    </div>
  );
}
