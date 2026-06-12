/**
 * Shared chrome icons.
 *
 * One geometry for every "close" affordance in the app — panel close,
 * folder close, tab close, search close — so the X reads identically
 * everywhere: an 8-unit X centered on a 14-unit grid, 1.5 stroke, round
 * caps. Render size varies per context (14 in panel headers, 12 inside
 * tabs and the search bar); the shared proportions are what keep it
 * consistent.
 */
export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="3" x2="11" y2="11" />
      <line x1="11" y1="3" x2="3" y2="11" />
    </svg>
  );
}
