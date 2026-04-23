import { useEffect, useState } from "react";
import { fsList, type DirEntry } from "../../lib/ipc/commands";

interface Props {
  root: string;
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
  /** Case-insensitive filter applied to file/dir names across the currently-loaded tree. */
  filter?: string;
  /** Monotonic counter — incrementing triggers "expand all loaded dirs". */
  expandAllSeq?: number;
  /** Monotonic counter — incrementing triggers "collapse all". */
  collapseAllSeq?: number;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
  padding: "5px 6px",
  borderRadius: 4,
  fontSize: 13,
  color: "var(--text)",
  userSelect: "none",
};

const iconStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-muted)",
  flexShrink: 0,
};

const nameStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 120ms ease",
      }}
      aria-hidden="true"
    >
      <polyline points="5 3 9 7 5 11" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 1.5 H8.5 L11 4 V12.5 H3 Z" />
      <polyline points="8.5 1.5 8.5 4 11 4" />
    </svg>
  );
}

function Row({
  entry,
  isDirExpanded,
  onActivate,
}: {
  entry: DirEntry;
  isDirExpanded: boolean;
  onActivate: (e: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onActivate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...rowStyle, background: hover ? "rgba(0,0,0,0.04)" : "transparent" }}
    >
      <span style={iconStyle}>
        {entry.is_dir ? <ChevronIcon open={isDirExpanded} /> : <FileIcon />}
      </span>
      <span style={nameStyle}>{entry.name}</span>
    </div>
  );
}

export function FileTree({
  root,
  onOpenFile,
  filter = "",
  expandAllSeq = 0,
  collapseAllSeq = 0,
}: Props) {
  // Flat cache so filter / expand-all / collapse-all can operate across the
  // whole loaded tree in a single pass. Each Node is now presentational —
  // all state lives here.
  const [cache, setCache] = useState<Map<string, DirEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rootLoading, setRootLoading] = useState(true);

  // Load the root on mount / when the caller swaps folders.
  useEffect(() => {
    let cancelled = false;
    setRootLoading(true);
    fsList(root)
      .then((entries) => {
        if (cancelled) return;
        setCache(new Map([[root, entries]]));
        setExpanded(new Set());
        setRootLoading(false);
      })
      .catch(() => {
        if (!cancelled) setRootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [root]);

  async function handleActivate(
    entry: DirEntry,
    e?: React.MouseEvent | React.KeyboardEvent,
  ) {
    if (!entry.is_dir) {
      const toSide = !!(e && "metaKey" in e && e.metaKey);
      onOpenFile(entry.path, toSide ? { toSide: true } : undefined);
      return;
    }
    const path = entry.path;
    const willExpand = !expanded.has(path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    if (willExpand && !cache.has(path)) {
      try {
        const entries = await fsList(path);
        setCache((prev) => {
          const m = new Map(prev);
          m.set(path, entries);
          return m;
        });
      } catch (e) {
        console.warn("fsList failed:", path, e);
      }
    }
  }

  // Expand-all: BFS the entire tree, loading every subdirectory through
  // fsList, then expand every directory we discovered. Capped at 500 dirs
  // as a safety net — a typical markdown vault is far below that, and
  // anything bigger would hang the UI if we let it run free.
  useEffect(() => {
    if (expandAllSeq === 0) return;
    let cancelled = false;
    (async () => {
      const localCache = new Map(cache);
      let queue: string[] = [root];
      let budget = 500;
      while (queue.length > 0 && budget > 0 && !cancelled) {
        const next: string[] = [];
        for (const dir of queue) {
          if (cancelled) return;
          budget--;
          if (budget < 0) break;
          if (!localCache.has(dir)) {
            try {
              const entries = await fsList(dir);
              localCache.set(dir, entries);
            } catch {
              continue;
            }
          }
          const children = localCache.get(dir) ?? [];
          for (const c of children) {
            if (c.is_dir) next.push(c.path);
          }
        }
        queue = next;
      }
      if (cancelled) return;
      setCache(localCache);
      // Every cached key except the root is a directory we can expand.
      setExpanded(new Set([...localCache.keys()].filter((p) => p !== root)));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandAllSeq]);

  useEffect(() => {
    if (collapseAllSeq === 0) return;
    setExpanded(new Set());
  }, [collapseAllSeq]);

  const q = filter.trim().toLowerCase();
  const filterActive = q.length > 0;

  function matchesName(entry: DirEntry): boolean {
    return entry.name.toLowerCase().includes(q);
  }

  // A dir is visible during filter if it matches itself OR any cached
  // descendant matches. Once a dir matches by name, ALL its descendants are
  // shown so the user can still drill in after finding the folder.
  function dirIsVisible(dir: DirEntry): boolean {
    if (!filterActive) return true;
    if (matchesName(dir)) return true;
    const children = cache.get(dir.path);
    if (!children) return false;
    for (const c of children) {
      if (c.is_dir) {
        if (dirIsVisible(c)) return true;
      } else {
        if (matchesName(c)) return true;
      }
    }
    return false;
  }

  function renderEntries(entries: DirEntry[], ancestorNameMatched: boolean): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    for (const e of entries) {
      if (e.is_dir) {
        const nameMatches = filterActive && matchesName(e);
        const visible = ancestorNameMatched ? true : dirIsVisible(e);
        if (!visible) continue;
        // While filtering, auto-expand any visible dir so the match inside
        // is reachable without extra clicks.
        const isExpanded = filterActive ? true : expanded.has(e.path);
        const children = cache.get(e.path);
        out.push(
          <div key={e.path}>
            <Row entry={e} isDirExpanded={isExpanded} onActivate={(ev) => handleActivate(e, ev)} />
            {isExpanded && children && (
              <div style={{ paddingLeft: 16 }}>
                {renderEntries(children, ancestorNameMatched || nameMatches)}
              </div>
            )}
          </div>,
        );
      } else {
        if (filterActive && !ancestorNameMatched && !matchesName(e)) continue;
        out.push(
          <Row
            key={e.path}
            entry={e}
            isDirExpanded={false}
            onActivate={(ev) => handleActivate(e, ev)}
          />,
        );
      }
    }
    return out;
  }

  if (rootLoading)
    return <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>Loading…</div>;
  const rootEntries = cache.get(root);
  if (!rootEntries || rootEntries.length === 0)
    return (
      <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>
        Empty folder.
      </div>
    );
  const rendered = renderEntries(rootEntries, false);
  if (filterActive && rendered.length === 0)
    return (
      <div style={{ padding: 6, color: "var(--text-faint)", fontSize: 12 }}>
        No matches in loaded tree.
      </div>
    );
  return <div>{rendered}</div>;
}
