/**
 * Markdown file extensions the app treats as "first-class" — eligible for
 * WYSIWYG rendering, the formatting toolbar, the heading outline, etc.
 *
 * Other text extensions (.txt / .json / .sh / .yaml / .yml / .toml / .log /
 * .csv) open in Edit mode only — they're shown in the explorer and editable
 * as plain text but bypass every markdown-specific feature.
 */
const MD_EXTENSIONS = ["md", "markdown", "mdown", "mkd"] as const;

/**
 * Returns true when `path` should be treated as markdown. Used to gate
 * WYSIWYG mode availability + toggle visibility.
 *
 * A null/undefined path (untitled buffer) is treated as markdown so newly
 * created docs default into the markdown experience.
 */
export function isMarkdownPath(path: string | null | undefined): boolean {
  if (!path) return true;
  const lower = path.toLowerCase();
  return MD_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}
