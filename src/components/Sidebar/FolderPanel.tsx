import { useEffect, useRef, useState } from "react";
import { FileTree } from "../FileTree";
import { FileTreeContextMenu } from "../FileTree/FileTreeContextMenu";
import { ConfirmDialog } from "../ConfirmDialog";
import { PromptDialog } from "../WysiwygEditor/PromptDialog";
import { AsidePanel } from "./AsidePanel";
import { CloseIcon } from "../icons";
import { MAX_OPEN_FOLDERS } from "../../state/documents";
import {
  fsCountRecursive,
  fsCreate,
  fsCreateDir,
  fsDelete,
  fsRename,
  shellOpenInTerminal,
  shellRevealInFinder,
} from "../../lib/ipc/commands";
import { closeDocsUnderPath } from "../../lib/closeDocsUnderPath";

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
  /**
   * Called after a folder root has been renamed on disk. The old path no
   * longer exists; App.tsx should update its `folder` / `extraFolders`
   * state to swap the old root for the new one (preserving order).
   */
  onRenameFolder?(oldPath: string, newPath: string): void;
  /** Forwarded to each FileTree — opens the clicked file as a tab. */
  onOpenFile(path: string, opts?: { toSide: boolean }): void;
  /** Dismisses the panel (equivalent to the View menu / ⌥⌘1 toggle). */
  onClose?: () => void;
}

/**
 * One full rotation of the Reload button's spin animation. MUST match the
 * `aside-reload-spin` duration in index.css — the stop timer rounds the
 * spin up to whole rotations so the icon halts upright.
 */
const RELOAD_SPIN_CYCLE_MS = 700;

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
  onRenameFolder,
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

  // Feedback for the toolbar Reload button: the icon spins from the click
  // until every visible FileTree has re-fetched. Completion is driven by
  // real reports from the trees — but a local refetch is near-instant, so
  // the spin alone would be invisible. `reloadSpinning` therefore persists
  // past completion just long enough to finish a WHOLE rotation (the icon
  // also stops upright instead of mid-turn). The spin never stops before
  // the real work is done.
  //
  // Two pieces of state because they answer different questions:
  //   reloadAnnounce — what is actually happening (live region + aria-busy)
  //   reloadSpinning — what the icon shows (includes the rotation tail)
  const [reloadAnnounce, setReloadAnnounce] = useState<
    "idle" | "reloading" | "done"
  >("idle");
  const [reloadSpinning, setReloadSpinning] = useState(false);
  // When the CSS animation started, i.e. when data-reload-state flipped to
  // "reloading" — the rotation tail is computed relative to this so the
  // icon always halts at a whole-rotation boundary.
  const spinStartRef = useRef<number | null>(null);
  // Which roots we're still waiting on, tagged with the seq they belong
  // to so late reports from a superseded reload can't corrupt a newer one.
  const reloadTrackRef = useRef<{ seq: number; pending: Set<string> } | null>(
    null,
  );
  const reloadSpinTimerRef = useRef<number | null>(null);
  // On unmount mid-reload, the child FileTrees' effect cleanups run AFTER
  // ours (React tears down parent passive effects first) and their
  // cancellation reports can drain pending → finishReload — which would
  // schedule a spin-tail timer nothing clears. The flag makes finishReload
  // a no-op once we're gone.
  const unmountedRef = useRef(false);
  useEffect(() => {
    // Reset on EVERY setup, not just initialized once: React.StrictMode
    // (dev) mounts → unmounts → remounts, and a cleanup-only effect would
    // leave the flag stuck at true after the remount — finishReload would
    // then never schedule the stop timer and the icon would spin forever.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (reloadSpinTimerRef.current != null) {
        window.clearTimeout(reloadSpinTimerRef.current);
      }
    };
  }, []);

  function finishReload() {
    reloadTrackRef.current = null;
    if (unmountedRef.current) return;
    setReloadAnnounce("done");
    // Let the icon complete its current rotation before stopping.
    const started = spinStartRef.current ?? performance.now();
    const elapsed = performance.now() - started;
    const tail = RELOAD_SPIN_CYCLE_MS - (elapsed % RELOAD_SPIN_CYCLE_MS);
    if (reloadSpinTimerRef.current != null) {
      window.clearTimeout(reloadSpinTimerRef.current);
    }
    reloadSpinTimerRef.current = window.setTimeout(() => {
      reloadSpinTimerRef.current = null;
      spinStartRef.current = null;
      setReloadSpinning(false);
      setReloadAnnounce("idle");
    }, tail);
  }

  function handleReloadClick() {
    // A new reload supersedes a still-running spin tail — kill its pending
    // stop timer, or it would fire mid-flight and halt the spinner while
    // trees are still fetching.
    if (reloadSpinTimerRef.current != null) {
      window.clearTimeout(reloadSpinTimerRef.current);
      reloadSpinTimerRef.current = null;
    }
    const nextSeq = reloadSeq + 1;
    setReloadSeq(nextSeq);
    // Only (re)stamp the animation start when the icon is actually idle —
    // re-clicking mid-spin doesn't restart the CSS animation, so the
    // whole-rotation math must stay anchored to the original start.
    if (spinStartRef.current == null) {
      spinStartRef.current = performance.now();
    }
    setReloadSpinning(true);
    setReloadAnnounce("reloading");
    // Collapsed groups unmount their FileTree — they can't reload now and
    // will re-fetch from disk anyway when re-expanded, so only the visible
    // trees are worth waiting on. With none visible there's nothing to
    // await: report done immediately (the icon still shows one rotation).
    const visible = allRoots.filter((p) => !collapsedFolders.has(p));
    if (visible.length === 0) {
      finishReload();
      return;
    }
    reloadTrackRef.current = { seq: nextSeq, pending: new Set(visible) };
  }

  function handleTreeReloadDone(root: string, seq: number) {
    const track = reloadTrackRef.current;
    if (!track || seq !== track.seq) return;
    track.pending.delete(root);
    if (track.pending.size === 0) finishReload();
  }

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

  // Right-click menu for folder-group headers (parent nodes). Mirrors the
  // FileTree row context menu: Open in Finder / Open in Terminal / Rename.
  // Duplicate is omitted because recursive directory copy isn't supported
  // in the file-only fs_copy IPC.
  const [folderCtx, setFolderCtx] = useState<
    { root: string; x: number; y: number } | null
  >(null);
  const [folderRenameTarget, setFolderRenameTarget] = useState<string | null>(null);
  // Delete confirmation for a folder root opened from the explorer header
  // right-click menu. descendantCount is used to render "delete folder X
  // and N items inside" copy.
  const [folderDeleteTarget, setFolderDeleteTarget] = useState<
    { root: string; descendantCount: number } | null
  >(null);
  // "New File…" / "New Folder…" target for the folder-header menu. The
  // created entry lands inside the folder root the user right-clicked.
  const [folderCreateTarget, setFolderCreateTarget] = useState<
    { parentDir: string; kind: "file" | "folder" } | null
  >(null);

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
        onClick={handleReloadClick}
        className="aside-header-btn"
        data-reload-state={reloadSpinning ? "reloading" : "idle"}
        aria-busy={reloadAnnounce === "reloading"}
      >
        <ReloadIcon />
      </button>
      {/* Polite announcement of the REAL work state (not the cosmetic
          rotation tail) so VoiceOver users get the same "it actually
          reloaded" signal. */}
      <span role="status" className="visually-hidden">
        {reloadAnnounce === "reloading"
          ? "Reloading folder contents…"
          : reloadAnnounce === "done"
            ? "Folder contents reloaded"
            : ""}
      </span>
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
                onHeaderContextMenu={(x, y) => setFolderCtx({ root: p, x, y })}
                filter={searchOpen ? query : ""}
                expandAllSeq={expandByPath.get(p) ?? 0}
                collapseAllSeq={collapseByPath.get(p) ?? 0}
                reloadSeq={reloadSeq}
                onReloadDone={handleTreeReloadDone}
                onOpenFile={onOpenFile}
              />
            ))}
        </>
      )}
      {folderCtx && (
        <FileTreeContextMenu
          x={folderCtx.x}
          y={folderCtx.y}
          actions={[
            {
              label: "New File…",
              onSelect: () => {
                setFolderCreateTarget({
                  parentDir: folderCtx.root,
                  kind: "file",
                });
              },
            },
            {
              label: "New Folder…",
              onSelect: () => {
                setFolderCreateTarget({
                  parentDir: folderCtx.root,
                  kind: "folder",
                });
              },
            },
            {
              label: "Open in Finder",
              separatorAbove: true,
              onSelect: () => {
                shellRevealInFinder(folderCtx.root).catch(console.error);
              },
            },
            {
              label: "Open in Terminal",
              onSelect: () => {
                shellOpenInTerminal(folderCtx.root).catch(console.error);
              },
            },
            {
              label: "Rename…",
              separatorAbove: true,
              onSelect: () => {
                setFolderRenameTarget(folderCtx.root);
              },
            },
            {
              label: "Delete",
              separatorAbove: true,
              destructive: true,
              onSelect: async () => {
                const root = folderCtx.root;
                try {
                  const count = await fsCountRecursive(root);
                  setFolderDeleteTarget({ root, descendantCount: count });
                } catch (err) {
                  console.warn(
                    "count_recursive failed, prompting without count:",
                    err,
                  );
                  setFolderDeleteTarget({ root, descendantCount: 0 });
                }
              },
            },
          ]}
          onClose={() => setFolderCtx(null)}
        />
      )}
      {folderRenameTarget && (
        <PromptDialog
          title="Rename folder"
          initialValue={folderRenameTarget.split("/").pop() ?? ""}
          submitLabel="Rename"
          onCancel={() => setFolderRenameTarget(null)}
          onSubmit={async (newName) => {
            const oldPath = folderRenameTarget;
            setFolderRenameTarget(null);
            const trimmed = newName.trim();
            if (!trimmed) return;
            const oldBase = oldPath.split("/").pop() ?? "";
            if (trimmed === oldBase) return;
            const slash = oldPath.lastIndexOf("/");
            const parent = slash >= 0 ? oldPath.slice(0, slash) : "";
            const newPath = parent ? `${parent}/${trimmed}` : trimmed;
            try {
              await fsRename(oldPath, newPath);
              onRenameFolder?.(oldPath, newPath);
            } catch (err) {
              console.error("rename folder failed:", err);
            }
          }}
        />
      )}
      {folderCreateTarget && (
        <PromptDialog
          title={folderCreateTarget.kind === "file" ? "New file" : "New folder"}
          placeholder={
            folderCreateTarget.kind === "file" ? "Untitled.md" : "New folder"
          }
          submitLabel="Create"
          onCancel={() => setFolderCreateTarget(null)}
          onSubmit={async (rawName) => {
            const target = folderCreateTarget;
            setFolderCreateTarget(null);
            const trimmed = rawName.trim();
            if (!trimmed) return;
            if (trimmed.includes("/")) {
              console.warn("New file/folder name may not contain '/'");
              return;
            }
            const finalName =
              target.kind === "file" && !trimmed.includes(".")
                ? `${trimmed}.md`
                : trimmed;
            const dst = `${target.parentDir}/${finalName}`;
            try {
              if (target.kind === "file") {
                await fsCreate(dst);
              } else {
                await fsCreateDir(dst);
              }
              // Bump the global reloadSeq so every cached tree re-fetches —
              // the new entry's parent is one of the open roots, and this
              // is the cheapest way to force its FileTree to refresh
              // without plumbing a per-root reload counter all the way
              // down. Other trees revalidating is harmless.
              setReloadSeq((n) => n + 1);
              if (target.kind === "file") {
                onOpenFile(dst);
              }
            } catch (err) {
              console.error(`create ${target.kind} failed:`, err);
            }
          }}
        />
      )}
      {folderDeleteTarget && (() => {
        const basename =
          folderDeleteTarget.root.split("/").pop() ?? folderDeleteTarget.root;
        return (
          <ConfirmDialog
            title="Delete folder?"
            message={
              folderDeleteTarget.descendantCount > 0 ? (
                <>
                  This will permanently delete <strong>{basename}</strong> and
                  the {folderDeleteTarget.descendantCount}{" "}
                  {folderDeleteTarget.descendantCount === 1 ? "item" : "items"}{" "}
                  inside it. This cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete <strong>{basename}</strong>. This
                  cannot be undone.
                </>
              )
            }
            confirmLabel="Delete"
            cancelLabel="Cancel"
            tone="danger"
            onConfirm={async () => {
              const root = folderDeleteTarget.root;
              setFolderDeleteTarget(null);
              try {
                await fsDelete(root);
                closeDocsUnderPath(root);
                // Drop the now-vanished folder from the explorer's roots.
                onCloseFolder(root);
              } catch (err) {
                console.error("delete folder failed:", err);
              }
            }}
            onCancel={() => setFolderDeleteTarget(null)}
          />
        );
      })()}
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
  onHeaderContextMenu,
  filter,
  expandAllSeq,
  collapseAllSeq,
  reloadSeq,
  onReloadDone,
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
  /** Right-click on the header strip; coords are page-relative. */
  onHeaderContextMenu?(x: number, y: number): void;
  filter: string;
  expandAllSeq: number;
  collapseAllSeq: number;
  reloadSeq: number;
  /** Forwarded to the FileTree so reload completion reports back up. */
  onReloadDone?(root: string, seq: number): void;
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
        onContextMenu={(e) => {
          if (!onHeaderContextMenu) return;
          e.preventDefault();
          e.stopPropagation();
          onHeaderContextMenu(e.clientX, e.clientY);
        }}
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
            onReloadDone={onReloadDone}
          />
        </div>
      )}
    </section>
  );
}

// All header icons share the same 14 × 14 render size, 14-unit viewBox,
// and 1.5 stroke so they line up visually in the action row.
const HEADER_ICON = {
  width: 14,
  height: 14,
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
  // ⟳ — clockwise open-circle arrow, resting at the same angle as the
  // Unicode glyph: the gap sits on the RIGHT (head just above 3 o'clock,
  // tail at ~4:30), with a tangential V arrowhead pointing down-right
  // along the direction of travel. Geometry: circle center (7, 7), r 4.4,
  // 300° sweep from +45° to −15°; the V's wings are ±30° off the tangent.
  return (
    <svg {...HEADER_ICON}>
      <path d="M 10.11 10.11 A 4.4 4.4 0 1 1 11.25 5.86" />
      <polyline points="9.42 4.07 11.25 5.86 11.94 3.4" />
    </svg>
  );
}

function OpenFolderIcon() {
  // Outlined folder. The tab's drop to the body top is 1.8 units (~1.7px
  // at render size) — deep enough that the silhouette still reads as
  // "folder" instead of a rounded blob at 14px.
  return (
    <svg {...HEADER_ICON}>
      <path d="M 1.5 10.5 V 4 Q 1.5 3 2.5 3 H 5.3 L 7 4.8 H 11.5 Q 12.5 4.8 12.5 5.8 V 10.5 Q 12.5 11.5 11.5 11.5 H 2.5 Q 1.5 11.5 1.5 10.5 Z" />
    </svg>
  );
}

function ExpandAllIcon() {
  // Stacked double chevron pointing DOWN — the established "unfold all"
  // idiom (VS Code unfold, JetBrains expand-all). Two strokes of motion
  // in the same direction read as "all levels", where the old single
  // chevron + bar mushed into an ambiguous glyph at this size.
  return (
    <svg {...HEADER_ICON}>
      <polyline points="3 2.8 7 6.3 11 2.8" />
      <polyline points="3 7.7 7 11.2 11 7.7" />
    </svg>
  );
}

function CollapseAllIcon() {
  // Stacked double chevron pointing UP — "fold all".
  return (
    <svg {...HEADER_ICON}>
      <polyline points="3 6.3 7 2.8 11 6.3" />
      <polyline points="3 11.2 7 7.7 11 11.2" />
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

