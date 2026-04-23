import { fsWrite } from "./ipc/commands";

/**
 * Characters that are illegal in macOS filenames (or likely to confuse
 * path handling elsewhere). We collapse each to a hyphen so the target
 * "Bug #12: summary" becomes "Bug #12- summary.md" — still readable, still
 * valid.
 */
const UNSAFE = /[\/\\:*?"<>|\x00-\x1f]/g;
const MD_EXT_RE = /\.(md|markdown|mdown|mkd)$/i;

export function sanitizeWikiTargetFilename(target: string): string {
  const trimmed = target.trim().replace(UNSAFE, "-").replace(/\s+/g, " ");
  // Strip leading dots so we never create a ".hidden" file by accident.
  return trimmed.replace(/^\.+/, "");
}

/**
 * Create a brand-new empty markdown file for a wiki-link target that
 * didn't resolve to an existing file. Writes into the folder root.
 * Returns the absolute path of the newly-created file, or null if the
 * sanitized name came out empty (all illegal characters, for example).
 *
 * The target may or may not include a `.md` extension — either way, the
 * final file gets exactly one. `[[README.md]]` doesn't become
 * `README.md.md`.
 */
export async function createWikiLinkFile(
  folder: string,
  target: string,
): Promise<string | null> {
  const safe = sanitizeWikiTargetFilename(target);
  if (!safe) return null;
  const sep = folder.endsWith("/") || folder.endsWith("\\") ? "" : "/";
  const hasExt = MD_EXT_RE.test(safe);
  const filename = hasExt ? safe : `${safe}.md`;
  const path = `${folder}${sep}${filename}`;
  // Seed with a single H1 so the new doc isn't entirely empty when the
  // user opens it — it also makes the file's own slug match the wiki
  // target when the doc is later referenced from elsewhere.
  const h1 = hasExt ? safe.replace(MD_EXT_RE, "") : safe;
  await fsWrite(path, `# ${h1}\n`);
  return path;
}
