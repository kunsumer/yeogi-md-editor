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
  /**
   * Called when the user clicks the Open-folder icon (or the empty-state
   * "Choose folder…" button). App.tsx owns the dialog and decides whether
   * the picked path becomes the primary (when no folder is open yet) or
   * appends as an extra (when at least one folder is already open).
   */
  onPickFolder(): void;
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
  const [reloadSeq, setReloadSeq] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Per-tree expand/collapse counters. Maps from folder root → seq number.
  // Bumping a single root's counter only re-runs the expand/collapse effect
  // inside that root's FileTree, leaving the other trees untouched. That's
  // what gives the toolbar's expand-all / collapse-all their per-selection
  // semantics: they bump only the selectedFolder's counter, never broadcast.
  const [expandByPath, setExpandByPath] = useState<Map<string, number>>(
    new Map(),
  );
  const [collapseByPath, setCollapseByPath] = useState<Map<string, number>>(
    new Map(),
  );

  // Manual override for which tree is "selected" (target of expand/collapse-
  // all + the visual highlight). When null, falls back to the folder
  // containing the active document, then to the first open folder. The
  // user clicking a folder header sets it explicitly; later doc switches
  // don't disturb that choice.
  const [manualSelectedFolder, setManualSelectedFolder] = useState<string | null>(null);
  const selectedFolder =
    (manualSelectedFolder && allRoots.includes(manualSelectedFolder)
      ? manualSelectedFolder
      : null) ??
    activeRoot ??
    allRoots[0] ??
    null;

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
        title={
          canAddMore
            ? "Open another folder (adds it to the explorer)"
            : `Maximum ${MAX_OPEN_FOLDERS} folders — close one first`
        }
        onClick={onPickFolder}
        disabled={!canAddMore}
        className="aside-header-btn"
      >
        <OpenFolderIcon />
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
        aria-label={`Expand all in ${selectedFolder ? selectedFolder.split("/").pop() : "the selected folder"}`}
        title={
          selectedFolder
            ? `Expand all (in ${selectedFolder.split("/").pop()})`
            : "Expand all"
        }
        disabled={!selectedFolder}
        onClick={() => {
          if (!selectedFolder) return;
          // Selected-tree-only: open the FolderGroup chevron if collapsed,
          // and bump only that root's expand counter so its FileTree
          // recursively expands. Other trees are untouched.
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.delete(selectedFolder);
            return next;
          });
          setExpandByPath((prev) => {
            const next = new Map(prev);
            next.set(selectedFolder, (next.get(selectedFolder) ?? 0) + 1);
            return next;
          });
        }}
        className="aside-header-btn"
      >
        <ExpandAllIcon />
      </button>
      <button
        type="button"
        aria-label={`Collapse all in ${selectedFolder ? selectedFolder.split("/").pop() : "the selected folder"}`}
        title={
          selectedFolder
            ? `Collapse all (in ${selectedFolder.split("/").pop()})`
            : "Collapse all"
        }
        disabled={!selectedFolder}
        onClick={() => {
          if (!selectedFolder) return;
          // Selected-tree-only: close that one FolderGroup + bump its
          // collapse counter (clears its FileTree's expanded set + drops
          // cached subdir contents so the next re-expand only shows the
          // root level). Other trees are untouched.
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.add(selectedFolder);
            return next;
          });
          setCollapseByPath((prev) => {
            const next = new Map(prev);
            next.set(selectedFolder, (next.get(selectedFolder) ?? 0) + 1);
            return next;
          });
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
          {[folder, ...extraFolders]
            .filter((p): p is string => p != null)
            .map((p) => (
              <FolderGroup
                key={p}
                root={p}
                isSelected={p === selectedFolder}
                onSelect={() => setManualSelectedFolder(p)}
                isCollapsed={collapsedFolders.has(p)}
                onToggleCollapsed={() => toggleFolderCollapsed(p)}
                onRemove={() => onCloseFolder(p)}
                filter={searchOpen ? query : ""}
                expandAllSeq={expandByPath.get(p) ?? 0}
                collapseAllSeq={collapseByPath.get(p) ?? 0}
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
  isSelected,
  onSelect,
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
  /**
   * True when this is the toolbar-action target (expand-all / collapse-all
   * apply here). The visual highlight follows it.
   */
  isSelected: boolean;
  /** Click on the header (or anywhere in the strip) selects this group. */
  onSelect(): void;
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
      aria-current={isSelected ? "true" : undefined}
      onMouseDownCapture={(e) => {
        // Selecting is a passive intent — clicking inside the FileTree
        // (e.g. opening a file) should ALSO mark this group as selected,
        // since that's where the user's attention is. Capture-phase so
        // we run before any per-row handlers; we don't preventDefault, so
        // file-open / chevron-toggle / close-X all still fire.
        if (!isSelected) onSelect();
        // Suppress unused-var warning on `e`.
        void e;
      }}
      style={{
        marginBottom: 8,
        // Selected root gets the brand-red left border + faint bg tint —
        // matches the active-tab indicator visually so "selected" reads
        // consistently across the explorer + tab bar. Inactive groups
        // stay neutral.
        borderLeft: `3px solid ${
          isSelected ? "var(--brand-red)" : "transparent"
        }`,
        background: isSelected ? "var(--bg-hover)" : "transparent",
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
        // Indent the entire FileTree so first-level children sit visibly
        // nested under the FolderGroup header. The header chevron sits at
        // x = 4 (section padding 4); 16 px of left padding here puts the
        // child chevrons at x = 20, mirroring the per-level indent the
        // FileTree applies for deeper subdirs (also 16 px).
        <div style={{ paddingLeft: 16 }}>
          <FileTree
            root={root}
            onOpenFile={onOpenFile}
            filter={filter}
            expandAllSeq={expandAllSeq}
            collapseAllSeq={collapseAllSeq}
            reloadSeq={reloadSeq}
          />
        </div>
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
