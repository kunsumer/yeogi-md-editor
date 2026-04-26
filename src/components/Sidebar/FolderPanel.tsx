import { useEffect, useRef, useState } from "react";
import { FileTree } from "../FileTree";
import { AsidePanel } from "./AsidePanel";
import { MAX_OPEN_FOLDERS } from "../../state/documents";

interface Props {
  /** Primary folder root. null means no folder has been picked yet. */
  folder: string | null;
  /**
   * Additional folder roots stacked below the primary. Each renders with
   * its own collapsible header + FileTree. Bounded at MAX_OPEN_FOLDERS - 1.
   */
  extraFolders: string[];
  /**
   * Path of the currently-focused document, used to highlight the folder
   * group that contains it ("you are here" indicator across multiple open
   * folder roots). null when there's no active doc or the active doc lives
   * outside every open folder root.
   */
  activeDocPath: string | null;
  /** Called when the user clicks "Open folder…" — App.tsx owns the dialog. */
  onPickFolder(): void;
  /**
   * Called when the user clicks "Add folder…". App.tsx owns the dialog and
   * appends the picked path to extraFolders (subject to MAX_OPEN_FOLDERS).
   */
  onAddFolder(): void;
  /**
   * Close a folder group. Called from the X on any folder's header — both
   * the primary and extras. The App-level handler decides what happens:
   * primary closes by promoting extras[0] to primary, extras just drop out.
   */
  onCloseFolder(path: string): void;
  /** Forwarded to each FileTree — opens the clicked file as a tab. */
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
  /** Dismisses the panel (equivalent to the View menu / ⌥⌘1 toggle). */
  onClose?: () => void;
}

/**
 * Returns the deepest open root that contains `docPath`, so when a folder
 * tree is nested inside another open root we light up the more specific
 * one. Returns null when the active doc lives outside every open folder.
 */
function findContainingRoot(
  roots: string[],
  docPath: string | null,
): string | null {
  if (!docPath) return null;
  let best: string | null = null;
  for (const root of roots) {
    if (docPath === root || docPath.startsWith(root + "/")) {
      if (best === null || root.length > best.length) best = root;
    }
  }
  return best;
}

export function FolderPanel({
  folder,
  extraFolders,
  activeDocPath,
  onPickFolder,
  onAddFolder,
  onCloseFolder,
  onOpenFile,
  onClose,
}: Props) {
  const allRoots = [folder, ...extraFolders].filter(
    (p): p is string => p != null,
  );
  const activeRoot = findContainingRoot(allRoots, activeDocPath);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandSeq, setExpandSeq] = useState(0);
  const [collapseSeq, setCollapseSeq] = useState(0);
  const [reloadSeq, setReloadSeq] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Per-folder expand/collapse of the whole FolderGroup (affects the
  // FileTree visibility underneath). Tracked as a set of collapsed paths
  // so the default is "all expanded" — closing by omission reads naturally.
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set(),
  );

  function toggleFolderCollapsed(path: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  // Focus the input when the user toggles search on. Clearing+hiding when
  // they toggle off so the filter prop drops back to empty.
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    } else if (query !== "") {
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  const totalFolders = (folder ? 1 : 0) + extraFolders.length;
  const canAddMore = totalFolders < MAX_OPEN_FOLDERS;

  const actions = folder != null && (
    <>
      <button
        type="button"
        aria-label="Open folder"
        title="Open a different folder (replaces the primary)"
        onClick={onPickFolder}
        className="aside-header-btn"
      >
        <OpenFolderIcon />
      </button>
      <button
        type="button"
        aria-label="Add another folder"
        title={
          canAddMore
            ? "Add another folder to the explorer"
            : `Maximum ${MAX_OPEN_FOLDERS} folders — remove one first`
        }
        onClick={onAddFolder}
        disabled={!canAddMore}
        className="aside-header-btn"
      >
        <AddFolderIcon />
      </button>
      <button
        type="button"
        aria-label="Search files"
        title="Search files by name"
        aria-pressed={searchOpen}
        onClick={() => setSearchOpen((v) => !v)}
        className={`aside-header-btn${searchOpen ? " is-active" : ""}`}
      >
        <SearchIcon />
      </button>
      <button
        type="button"
        aria-label="Reload folders"
        title="Reload folder contents from disk"
        onClick={() => setReloadSeq((n) => n + 1)}
        className="aside-header-btn"
      >
        <ReloadIcon />
      </button>
      <button
        type="button"
        aria-label="Expand all loaded folders"
        title="Expand all"
        onClick={() => {
          // Two-level expand: open every collapsed FolderGroup chevron,
          // and also fire the per-FileTree recursive expand. So one click
          // gives users "show me everything" across the whole explorer.
          setCollapsedFolders(new Set());
          setExpandSeq((n) => n + 1);
        }}
        className="aside-header-btn"
      >
        <ExpandAllIcon />
      </button>
      <button
        type="button"
        aria-label="Collapse all folders"
        title="Collapse all"
        onClick={() => {
          // Two-level collapse: close every FolderGroup chevron + clear the
          // per-FileTree expansion state. Closing the group unmounts the
          // FileTree (zero cost while collapsed); the FileTree state reset
          // ensures a later re-expand starts fresh at the root level.
          const allRoots = [folder, ...extraFolders].filter(
            (p): p is string => p != null,
          );
          setCollapsedFolders(new Set(allRoots));
          setCollapseSeq((n) => n + 1);
        }}
        className="aside-header-btn"
      >
        <CollapseAllIcon />
      </button>
    </>
  );

  return (
    <AsidePanel
      title="Files"
      ariaLabel="Folder Explorer"
      action={actions}
      onClose={onClose}
    >
      {folder == null ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "24px 8px",
            color: "var(--text-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          <span>No folder open.</span>
          <button type="button" className="btn-primary" onClick={onPickFolder}>
            Choose folder…
          </button>
        </div>
      ) : (
        <>
          {searchOpen && (
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setSearchOpen(false);
                }
              }}
              aria-label="Filter files by name"
              className="aside-filter-input"
            />
          )}
          <FolderGroup
            root={folder}
            isActive={folder === activeRoot}
            isCollapsed={collapsedFolders.has(folder)}
            onToggleCollapsed={() => toggleFolderCollapsed(folder)}
            onRemove={() => onCloseFolder(folder)}
            filter={searchOpen ? query : ""}
            expandAllSeq={expandSeq}
            collapseAllSeq={collapseSeq}
            reloadSeq={reloadSeq}
            onOpenFile={onOpenFile}
          />
          {extraFolders.map((p) => (
            <FolderGroup
              key={p}
              root={p}
              isActive={p === activeRoot}
              isCollapsed={collapsedFolders.has(p)}
              onToggleCollapsed={() => toggleFolderCollapsed(p)}
              onRemove={() => onCloseFolder(p)}
              filter={searchOpen ? query : ""}
              expandAllSeq={expandSeq}
              collapseAllSeq={collapseSeq}
              reloadSeq={reloadSeq}
              onOpenFile={onOpenFile}
            />
          ))}
        </>
      )}
    </AsidePanel>
  );
}

/**
 * One folder root + its tree. Header shows a chevron (expand/collapse the
 * whole group), the folder basename, and a close button for extras.
 *
 * When collapsed, the FileTree isn't mounted — no listeners, no cache,
 * no IPC calls. That's the "performance lever" the user can pull when
 * they have multiple folders open but only want one active at a time.
 */
function FolderGroup({
  root,
  isActive,
  isCollapsed,
  onToggleCollapsed,
  onRemove,
  filter,
  expandAllSeq,
  collapseAllSeq,
  reloadSeq,
  onOpenFile,
}: {
  root: string;
  /** True when the focused document lives inside this root. */
  isActive: boolean;
  isCollapsed: boolean;
  onToggleCollapsed(): void;
  /** null for the primary (which has no per-group close button). */
  onRemove: null | (() => void);
  filter: string;
  expandAllSeq: number;
  collapseAllSeq: number;
  reloadSeq: number;
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
}) {
  const basename = root.split("/").pop() ?? root;
  return (
    <section
      aria-label={basename}
      aria-current={isActive ? "true" : undefined}
      style={{
        marginBottom: 8,
        // Active root gets an accent left border + a faint background
        // tint, so when several folders are stacked the user can see at
        // a glance which one contains their currently-focused document.
        borderLeft: `2px solid ${
          isActive ? "var(--accent)" : "transparent"
        }`,
        background: isActive ? "var(--bg-hover)" : "transparent",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 4px 4px",
          // Larger + heavier than the FileTree rows (12 / 400) so the
          // parent folder name reads as the section heading it is.
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        <button
          type="button"
          aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand folder" : "Collapse folder"}
          onClick={onToggleCollapsed}
          className="aside-header-btn"
          style={{ padding: 2 }}
        >
          <ChevronIcon open={!isCollapsed} />
        </button>
        <span
          style={{
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={root}
        >
          {basename}
        </span>
        {onRemove && (
          <button
            type="button"
            aria-label="Close folder"
            title="Close this folder"
            onClick={onRemove}
            className="aside-header-btn"
            style={{ padding: 2 }}
          >
            <CloseIcon />
          </button>
        )}
      </div>
      {!isCollapsed && (
        <FileTree
          root={root}
          onOpenFile={onOpenFile}
          filter={filter}
          expandAllSeq={expandAllSeq}
          collapseAllSeq={collapseAllSeq}
          reloadSeq={reloadSeq}
        />
      )}
    </section>
  );
}

// All header icons share the same 13 × 13 render size, 14-unit viewBox,
// and 1.5 stroke so they line up visually in the action row.
const HEADER_ICON = {
  width: 13,
  height: 13,
  viewBox: "0 0 14 14",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

function SearchIcon() {
  return (
    <svg {...HEADER_ICON}>
      <circle cx="6" cy="6" r="4" />
      <line x1="9" y1="9" x2="12" y2="12" />
    </svg>
  );
}

function ReloadIcon() {
  // Three-quarter circular arrow with a small arrowhead on the sweep end.
  // Reads as the standard "refresh" glyph used in browsers / macOS Finder.
  // The arc opens at the top-right so the arrowhead points that way.
  return (
    <svg {...HEADER_ICON}>
      <path d="M 11 4 A 4 4 0 1 0 12 7.5" />
      <polyline points="11 2 11 4 9 4" />
    </svg>
  );
}

function OpenFolderIcon() {
  // Outlined folder: four rounded outer corners + a smooth quarter-arc
  // curve where the tab meets the body top. Closed single path, so
  // strokeLinejoin has nothing to do — the curves carry the roundness.
  return (
    <svg {...HEADER_ICON}>
      <path d="M 3 4 H 5.5 Q 7 4 7 5 H 11 Q 12 5 12 6 V 10 Q 12 11 11 11 H 3 Q 2 11 2 10 V 5 Q 2 4 3 4 Z" />
    </svg>
  );
}

function AddFolderIcon() {
  // Folder full-size (same path as OpenFolderIcon — they should read at
  // the same optical size in the toolbar) with a plus badge anchored at
  // the bottom-right, partially overlapping the folder body and
  // extending outside it. This is the "Add folder" pattern from VS Code
  // / Finder where the plus is a discrete corner stamp rather than a
  // texture inside the folder body — the latter made the icon read as
  // smaller because the inner strokes broke up the folder's silhouette.
  return (
    <svg {...HEADER_ICON}>
      <path d="M 3 4 H 5.5 Q 7 4 7 5 H 11 Q 12 5 12 6 V 10 Q 12 11 11 11 H 3 Q 2 11 2 10 V 5 Q 2 4 3 4 Z" />
      <line x1="11.5" y1="9" x2="11.5" y2="13" />
      <line x1="9.5" y1="11" x2="13.5" y2="11" />
    </svg>
  );
}

function ExpandAllIcon() {
  // Bar on top + open chevron pointing DOWN. The chevron is two line
  // segments meeting at the bottom point — no base edge — so it reads as
  // a tick/caret, matching VS Code's "expand all" convention.
  return (
    <svg {...HEADER_ICON}>
      <line x1="2.5" y1="3" x2="11.5" y2="3" />
      <polyline points="3 6.5 7 11.5 11 6.5" />
    </svg>
  );
}

function CollapseAllIcon() {
  // Bar on top + open chevron pointing UP.
  return (
    <svg {...HEADER_ICON}>
      <line x1="2.5" y1="3" x2="11.5" y2="3" />
      <polyline points="3 11.5 7 6.5 11 11.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  // Caret that flips between "pointing right" (collapsed) and "pointing
  // down" (expanded). Same shape as the per-directory chevron in FileTree
  // so the UI reads consistently at both levels.
  return (
    <svg {...HEADER_ICON}>
      {open ? (
        <polyline points="3 5 7 9 11 5" />
      ) : (
        <polyline points="5 3 9 7 5 11" />
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...HEADER_ICON}>
      <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" />
    </svg>
  );
}
