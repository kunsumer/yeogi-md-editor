import { TOC } from "../TOC";
import type { Heading } from "../../lib/toc";
import { AsidePanel } from "./AsidePanel";

interface Props {
  hasDocument: boolean;
  headings: Heading[];
  onJump(h: Heading, index: number): void;
  /** Dismisses the panel (equivalent to the View menu / ⌥⌘2 toggle). */
  onClose?: () => void;
}

export function TocPanel({ hasDocument, headings, onJump, onClose }: Props) {
  const empty = !hasDocument
    ? "No document open."
    : headings.length === 0
      ? "No headings."
      : null;

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
    </AsidePanel>
  );
}
