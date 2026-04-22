/**
 * Yeogi .MD Editor mark — red document outline with a folded top-right
 * corner, "MD" wordmark centered inside, and a short underline bar mimicking
 * a line of text. Matches the brand mark (hollow outline variant) so the
 * sidebar brand and Dock icon read as the same product.
 */
interface Props {
  size?: number;
  title?: string;
  /** Optional override; defaults to the brand red. */
  color?: string;
}

const BRAND_RED = "#ef3b3b";

export function Logo({ size = 24, title = "Yeogi .MD Editor", color = BRAND_RED }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Document body: rounded rectangle with a 12×12 corner-fold cut on
          the top-right. Traced counter-clockwise so stroke-linejoin rounds
          all outer corners consistently. */}
      <path
        d="M16 6
           H38
           L54 20
           V52
           C54 55.3137 51.3137 58 48 58
           H16
           C12.6863 58 10 55.3137 10 52
           V12
           C10 8.6863 12.6863 6 16 6
           Z"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Folded-corner indicator: short L bringing the diagonal down and
          across so it reads as a dog-ear. */}
      <path
        d="M38 6 V20 H54"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* "MD" wordmark centered in the body. */}
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif"
        fontWeight={900}
        fontSize="15"
        letterSpacing="-0.4"
        fill={color}
      >
        MD
      </text>
      {/* Short bar under "MD" suggesting a line of body text. */}
      <rect x="22" y="46" width="20" height="3" rx="1.5" fill={color} />
    </svg>
  );
}
