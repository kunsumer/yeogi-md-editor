/**
 * Evhan .MD Editor mark — dark-navy folder with white ".MD" cut out of it.
 * Matches the app icon (src-tauri/icons/source.svg) so the sidebar brand,
 * toolbar, and Dock icon all read as the same product.
 */
interface Props {
  size?: number;
  title?: string;
}

export function Logo({ size = 24, title = "Evhan .MD Editor" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Folder silhouette: a rounded rectangle with a small tab notch on
          the top-left that reads as a folder without cluttering the glyph. */}
      <path
        d="M6 18
           C6 14 9 11 13 11
           L24 11
           L29 16
           L51 16
           C55 16 58 19 58 23
           L58 49
           C58 53 55 56 51 56
           L13 56
           C9 56 6 53 6 49
           Z"
        fill="#1e3a5f"
      />
      {/* ".MD" wordmark */}
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fontWeight={900}
        fontSize="17"
        letterSpacing="-0.5"
        fill="#ffffff"
      >
        .MD
      </text>
    </svg>
  );
}
