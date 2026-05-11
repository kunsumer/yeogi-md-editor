import { TOC } from "../TOC";
import type { Heading } from "../../lib/toc";
import { AsidePanel } from "./AsidePanel";
import { useBacklinks } from "../../hooks/useBacklinks";

interface Props {
  hasDocument: boolean;
  headings: Heading[];
  /** The currently-focused pane's active doc path; null when no doc open. */
  activeDocPath: string | null;
  /** The open folder in the Files panel; null when no folder picked. */
  folder: string | null;
  onJump(h: Heading, index: number): void;
  /** Fired when the user clicks a backlink entry. */
  onOpenBacklink(path: string): void;
  /** Dismisses the panel (equivalent to the View menu / ⌥⌘2 toggle). */
  onClose?: () => void;
}

export function TocPanel({
  hasDocument,
  headings,
  activeDocPath,
  folder,
  onJump,
  onOpenBacklink,
  onClose,
}: Props) {
  const empty = !hasDocument
    ? "No document open."
    : headings.length === 0
      ? "No headings."
      : null;

  const { entries: backlinks, loading: backlinksLoading } = useBacklinks(
    folder,
    activeDocPath,
  );

  return (
    <AsidePanel title="Outline" ariaLabel="Outline" onClose={onClose}>
      {empty ? (
        <div
          style={{
            padding: "16px 8px",
            color: "var(--text-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {empty}
        </div>
      ) : (
        <TOC headings={headings} onJump={onJump} />
      )}
      {/* Backlinks section. Only renders when a folder is open and we have
          an active doc — without those, there's nothing to scan. */}
      {folder && activeDocPath && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "var(--text-faint)",
              padding: "0 6px 6px",
            }}
          >
            Backlinks
          </div>
          {backlinksLoading ? (
            <div
              style={{
                padding: "4px 8px",
                color: "var(--text-faint)",
                fontSize: 12,
                fontStyle: "italic",
              }}
            >
              Scanning…
            </div>
          ) : backlinks.length === 0 ? (
            <div
              style={{
                padding: "4px 8px",
                color: "var(--text-faint)",
                fontSize: 12,
                fontStyle: "italic",
              }}
            >
              No backlinks.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {backlinks.map((b) => (
                <BacklinkRow
                  key={b.sourcePath}
                  name={b.sourceName}
                  preview={b.preview}
                  additionalCount={b.additionalCount}
                  onClick={() => onOpenBacklink(b.sourcePath)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AsidePanel>
  );
}

function BacklinkRow({
  name,
  preview,
  additionalCount,
  onClick,
}: {
  name: string;
  preview: string;
  additionalCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${name}${additionalCount > 0 ? ` (${additionalCount + 1} matches)` : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        alignItems: "stretch",
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        border: 0,
        borderRadius: 4,
        background: "transparent",
        cursor: "pointer",
        color: "var(--text)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {name}
        </span>
        {additionalCount > 0 && (
          <span
            aria-label={`${additionalCount} more match${additionalCount === 1 ? "" : "es"}`}
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-muted)",
              background: "var(--bg-hover)",
              padding: "1px 6px",
              borderRadius: 8,
              flexShrink: 0,
            }}
          >
            +{additionalCount}
          </span>
        )}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {preview}
      </span>
    </button>
  );
}
