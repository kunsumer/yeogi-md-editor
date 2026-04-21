import { useEffect, useState } from "react";
import { fsList, type DirEntry } from "../../lib/ipc/commands";

interface Props {
  root: string;
  onOpenFile(path: string): void;
}

interface NodeProps {
  entry: DirEntry;
  onOpenFile(path: string): void;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  padding: "3px 6px",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--text)",
  userSelect: "none",
};

const iconStyle: React.CSSProperties = {
  width: 14,
  textAlign: "center",
  fontSize: 12,
  color: "var(--text-muted)",
};

const nameStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function Node({ entry, onOpenFile }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [hover, setHover] = useState(false);

  async function toggle() {
    if (!entry.is_dir) return;
    if (!expanded && children === null) setChildren(await fsList(entry.path));
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div
        onClick={entry.is_dir ? toggle : () => onOpenFile(entry.path)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ ...rowStyle, background: hover ? "rgba(0,0,0,0.04)" : "transparent" }}
      >
        <span aria-hidden="true" style={iconStyle}>
          {entry.is_dir ? (expanded ? "▾" : "▸") : "·"}
        </span>
        <span style={nameStyle}>{entry.name}</span>
      </div>
      {expanded && children && (
        <div style={{ paddingLeft: 14 }}>
          {children.map((c) => (
            <Node key={c.path} entry={c} onOpenFile={onOpenFile} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ root, onOpenFile }: Props) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  useEffect(() => {
    fsList(root).then(setEntries);
  }, [root]);
  if (!entries) return <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>Loading…</div>;
  return (
    <div>
      {entries.map((e) => (
        <Node key={e.path} entry={e} onOpenFile={onOpenFile} />
      ))}
    </div>
  );
}
