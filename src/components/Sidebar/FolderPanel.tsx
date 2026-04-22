import { useEffect, useRef, useState } from "react";
import { FileTree } from "../FileTree";
import { AsidePanel } from "./AsidePanel";

interface Props {
  /** Absolute filesystem path; null means no folder has been picked yet. */
  folder: string | null;
  /** Called when the user clicks "Choose folder…" — App.tsx owns the dialog. */
  onPickFolder(): void;
  /** Forwarded to FileTree — opens the clicked file as a tab. */
  onOpenFile(path: string): void;
  /** Dismisses the panel (equivalent to the View menu / ⌥⌘1 toggle). */
  onClose?: () => void;
}

export function FolderPanel({ folder, onPickFolder, onOpenFile, onClose }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandSeq, setExpandSeq] = useState(0);
  const [collapseSeq, setCollapseSeq] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const basename = folder ? (folder.split("/").pop() ?? "") : "";

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

  const actions = folder != null && (
    <>
      <button
        type="button"
        aria-label="Open folder"
        title="Open a different folder…"
        onClick={onPickFolder}
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
        aria-label="Expand all loaded folders"
        title="Expand all"
        onClick={() => setExpandSeq((n) => n + 1)}
        className="aside-header-btn"
      >
        <ExpandAllIcon />
      </button>
      <button
        type="button"
        aria-label="Collapse all folders"
        title="Collapse all"
        onClick={() => setCollapseSeq((n) => n + 1)}
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
          {basename && (
            <div
              style={{
                padding: "0 6px 6px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={folder}
            >
              {basename}
            </div>
          )}
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
          <FileTree
            root={folder}
            onOpenFile={onOpenFile}
            filter={searchOpen ? query : ""}
            expandAllSeq={expandSeq}
            collapseAllSeq={collapseSeq}
          />
        </>
      )}
    </AsidePanel>
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
