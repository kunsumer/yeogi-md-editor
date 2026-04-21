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

function Node({ entry, onOpenFile }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  async function toggle() {
    if (!entry.is_dir) return;
    if (!expanded && children === null) setChildren(await fsList(entry.path));
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div
        onClick={entry.is_dir ? toggle : () => onOpenFile(entry.path)}
        style={{ cursor: "pointer", padding: "2px 4px" }}
      >
        <span aria-hidden="true">{entry.is_dir ? (expanded ? "📂" : "📁") : "📄"}</span>{" "}
        <span>{entry.name}</span>
      </div>
      {expanded && children && (
        <div style={{ paddingLeft: 16 }}>
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
  if (!entries) return <div>Loading…</div>;
  return (
    <div>
      {entries.map((e) => (
        <Node key={e.path} entry={e} onOpenFile={onOpenFile} />
      ))}
    </div>
  );
}
