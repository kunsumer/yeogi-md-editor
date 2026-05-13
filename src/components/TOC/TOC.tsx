import type { Heading } from "../../lib/toc";

interface Props {
  headings: Heading[];
  /** Index of the section the user is currently reading (-1 for none). */
  activeIndex?: number;
  onJump: (heading: Heading, index: number) => void;
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
};

const row = (level: number, active: boolean): React.CSSProperties => ({
  paddingLeft: 6 + (level - 1) * 12,
  paddingRight: 6,
  paddingTop: 4,
  paddingBottom: 4,
  borderRadius: 4,
  fontSize: level === 1 ? 13 : 12,
  fontWeight: level === 1 ? 500 : 400,
  // Active row tints the text colour toward the foreground (so a
  // muted H4/H5 reads at full strength when it's the one you're in)
  // but otherwise stays visually identical to its neighbours. No
  // background wash, no left bar — just a slightly stronger colour.
  color: active || level === 1 ? "var(--text)" : "var(--text-muted)",
  cursor: "pointer",
  userSelect: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  background: "transparent",
  // Thin, low-opacity left bar — present only on the active row.
  // 1px keeps it from feeling like a divider; the brand red at 60%
  // alpha is unmissable on hover-stop but doesn't distract while
  // reading the doc.
  boxShadow: active ? "inset 1px 0 0 0 rgba(247, 50, 63, 0.6)" : "none",
  transition: "color 120ms ease, box-shadow 120ms ease",
});

const emptyStyle: React.CSSProperties = {
  padding: "8px 6px",
  color: "var(--text-faint)",
  fontSize: 12,
  fontStyle: "italic",
};

export function TOC({ headings, activeIndex = -1, onJump }: Props) {
  if (headings.length === 0) {
    return <div style={emptyStyle}>No headings yet</div>;
  }
  return (
    <div style={wrap}>
      {headings.map((h, i) => (
        <TocRow
          key={i}
          heading={h}
          index={i}
          active={i === activeIndex}
          onJump={onJump}
        />
      ))}
    </div>
  );
}

function TocRow({
  heading,
  index,
  active,
  onJump,
}: {
  heading: Heading;
  index: number;
  active: boolean;
  onJump: (h: Heading, i: number) => void;
}) {
  const baseStyle = row(heading.level, active);
  return (
    <div
      onClick={() => onJump(heading, index)}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.04)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "transparent")
      }
      style={baseStyle}
      aria-current={active ? "location" : undefined}
      title={heading.text}
    >
      {heading.text}
    </div>
  );
}
