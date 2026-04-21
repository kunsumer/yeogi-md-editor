/**
 * Simple, modern mark for Evhan .MD Editor.
 *
 * A rounded-square badge filled with an indigo → violet gradient, holding
 * a glyph inspired by the official Markdown mark (an "M" with a down-chevron
 * to its right). Stroke-based so it stays crisp at any size; works at 16 px
 * in the sidebar and scales up cleanly for a toolbar or empty state.
 */
interface Props {
  size?: number;
  title?: string;
}

export function Logo({ size = 22, title = "Evhan .MD Editor" }: Props) {
  const id = `logo-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect x="1" y="3" width="22" height="18" rx="4" fill={`url(#${id})`} />
      {/* "M" on the left */}
      <path
        d="M6 16 V9 L9 13 L12 9 V16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* down-chevron on the right */}
      <path
        d="M16 10 V15 M14 13 L16 15 L18 13"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
