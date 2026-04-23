import type { Heading } from "../../lib/toc";

interface Props {
  headings: Heading[];
  onJump: (heading: Heading, index: number) => void;
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
};

const row = (level: number, hover: boolean): React.CSSProperties => ({
  paddingLeft: 6 + (level - 1) * 12,
  paddingRight: 6,
  paddingTop: 4,
  paddingBottom: 4,
  borderRadius: 4,
  fontSize: level === 1 ? 13 : 12,
  fontWeight: level === 1 ? 500 : 400,
  color: level === 1 ? "var(--text)" : "var(--text-muted)",
  cursor: "pointer",
  userSelect: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  background: hover ? "rgba(0,0,0,0.04)" : "transparent",
});

const emptyStyle: React.CSSProperties = {
  padding: "8px 6px",
  color: "var(--text-faint)",
  fontSize: 12,
  fontStyle: "italic",
};

export function TOC({ headings, onJump }: Props) {
  if (headings.length === 0) {
    return <div style={emptyStyle}>No headings yet</div>;
  }
  return (
    <div style={wrap}>
      {headings.map((h, i) => (
        <TocRow key={i} heading={h} index={i} onJump={onJump} />
      ))}
    </div>
  );
}

function TocRow({
  heading,
  index,
  onJump,
}: {
  heading: Heading;
  index: number;
  onJump: (h: Heading, i: number) => void;
}) {
  return (
    <div
      onClick={() => onJump(heading, index)}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
      style={row(heading.level, false)}
      title={heading.text}
    >
      {heading.text}
    </div>
  );
}
