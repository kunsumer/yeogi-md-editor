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
  // Active row promotes weight one notch and forces full text colour so
  // a deep H4/H5 isn't hard to read when it's the section you're in.
  fontWeight: active ? 600 : level === 1 ? 500 : 400,
  color: active || level === 1 ? "var(--text)" : "var(--text-muted)",
  cursor: "pointer",
  userSelect: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  // box-shadow inset draws the left-bar accent without taking up width,
  // so adding/removing the active state doesn't shift the row's content.
  background: active ? "rgba(247, 50, 63, 0.10)" : "transparent",
  boxShadow: active ? "inset 2px 0 0 0 var(--brand-red)" : "none",
  transition: "background 120ms ease, box-shadow 120ms ease",
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
      // Hover overlays a slightly darker tint on top of the active wash
      // (or the transparent base) without overwriting the active accent.
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = active
          ? "rgba(247, 50, 63, 0.16)"
          : "rgba(0,0,0,0.04)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = active
          ? "rgba(247, 50, 63, 0.10)"
          : "transparent")
      }
      style={baseStyle}
      aria-current={active ? "location" : undefined}
      title={heading.text}
    >
      {heading.text}
    </div>
  );
}
