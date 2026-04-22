import type { Update } from "@tauri-apps/plugin-updater";

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; received: number; total: number | null }
  | { kind: "installing"; update: Update }
  | { kind: "installed"; update: Update }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

interface Props {
  status: Status;
  onInstall: (update: Update) => void;
  onDismiss: () => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  background: "var(--bg-accent-subtle, rgba(9, 105, 218, 0.08))",
  borderBottom: "1px solid var(--accent)",
  fontSize: 13,
  color: "var(--text)",
};

const btn: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 5,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: "var(--accent)",
  color: "#ffffff",
  border: "1px solid var(--accent)",
};

const dangerWrap: React.CSSProperties = {
  ...wrap,
  background: "rgba(239, 68, 68, 0.08)",
  borderBottom: "1px solid rgba(239, 68, 68, 0.45)",
};

const successWrap: React.CSSProperties = {
  ...wrap,
  background: "rgba(16, 185, 129, 0.08)",
  borderBottom: "1px solid rgba(16, 185, 129, 0.45)",
};

/**
 * Renders above the editor chrome whenever the updater has something to say.
 * The banner is mounted unconditionally by App.tsx; it returns null when the
 * updater status is "idle" so the normal layout is unaffected.
 */
export function UpdateBanner({ status, onInstall, onDismiss }: Props) {
  if (status.kind === "idle") return null;

  if (status.kind === "checking") {
    return (
      <div style={wrap} role="status">
        <span>Checking for updates…</span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  if (status.kind === "up-to-date") {
    return (
      <div style={successWrap} role="status">
        <span>You're on the latest version.</span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={onDismiss}>
          OK
        </button>
      </div>
    );
  }

  if (status.kind === "available") {
    const u = status.update;
    return (
      <div style={wrap} role="status">
        <strong style={{ fontWeight: 600 }}>Update available — v{u.version}</strong>
        {u.body && (
          <span
            style={{
              color: "var(--text-muted)",
              maxWidth: 400,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={u.body}
          >
            {u.body}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={onDismiss}>
          Later
        </button>
        <button type="button" style={primaryBtn} onClick={() => onInstall(u)}>
          Install &amp; Restart
        </button>
      </div>
    );
  }

  if (status.kind === "downloading") {
    const pct =
      status.total && status.total > 0
        ? Math.min(100, Math.round((status.received / status.total) * 100))
        : null;
    return (
      <div style={wrap} role="status" aria-live="polite">
        <span>
          Downloading update v{status.update.version} —{" "}
          {pct !== null
            ? `${pct}%`
            : `${formatBytes(status.received)}`}
        </span>
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  if (status.kind === "installing") {
    return (
      <div style={wrap} role="status" aria-live="polite">
        <span>Installing update v{status.update.version}…</span>
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  if (status.kind === "installed") {
    return (
      <div style={successWrap} role="status" aria-live="polite">
        <span>Update installed — relaunching…</span>
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  // status.kind === "error"
  return (
    <div style={dangerWrap} role="alert">
      <span>⚠ Update check failed: {status.message}</span>
      <div style={{ flex: 1 }} />
      <button type="button" style={btn} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
