import { fsList, type DirEntry } from "./ipc/commands";

const MD_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd"]);

/**
 * Resolves an Obsidian/Logseq-style wiki-link target ("Some Note" or
 * "Some Note.md") to an absolute file path inside the currently-open
 * folder, or null if no match.
 *
 * The target may include the markdown extension (`[[README.md]]`) or omit
 * it (`[[README]]`) — we match either form. Matching order:
 *   1. Case-sensitive basename match at the shallowest depth that has it.
 *   2. Case-insensitive fallback at the same depth.
 *
 * BFS so shallow matches win over deep namespace collisions — mirrors
 * Obsidian's default vault behaviour closely enough for v0.1.
 */
export async function resolveWikiLink(
  folder: string,
  target: string,
): Promise<string | null> {
  const trimmed = target.trim();
  if (!trimmed) return null;
  // Accept both "README" and "README.md" forms by stripping any trailing
  // markdown extension from the target before comparing.
  const exact = stripMdExt(trimmed);
  const lower = exact.toLowerCase();
  if (!exact) return null;

  let queue: string[] = [folder];
  // Bound total visits so a huge folder can't wedge the UI. 500 dirs is
  // plenty for a typical vault and skips into "unreasonable" territory
  // for a desktop scratch folder.
  let budget = 500;
  while (queue.length > 0 && budget > 0) {
    const next: string[] = [];
    for (const dir of queue) {
      budget--;
      if (budget < 0) break;
      let entries: DirEntry[];
      try {
        entries = await fsList(dir);
      } catch {
        continue;
      }
      // First pass: check this directory's markdown files directly.
      for (const e of entries) {
        if (e.is_dir) continue;
        const base = basenameNoExt(e.name);
        if (!base) continue;
        const ext = extOf(e.name);
        if (!ext || !MD_EXTENSIONS.has(ext.toLowerCase())) continue;
        if (base === exact) return e.path;
      }
      // Second pass: case-insensitive fallback at this depth.
      for (const e of entries) {
        if (e.is_dir) continue;
        const base = basenameNoExt(e.name);
        if (!base) continue;
        const ext = extOf(e.name);
        if (!ext || !MD_EXTENSIONS.has(ext.toLowerCase())) continue;
        if (base.toLowerCase() === lower) return e.path;
      }
      // Queue subdirectories for the next BFS layer.
      for (const e of entries) {
        if (e.is_dir) next.push(e.path);
      }
    }
    queue = next;
  }
  return null;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1);
}

function basenameNoExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

/** Strip a trailing markdown extension from a wiki-link target if present. */
export function stripMdExt(target: string): string {
  const dot = target.lastIndexOf(".");
  if (dot === -1) return target;
  const ext = target.slice(dot + 1).toLowerCase();
  return MD_EXTENSIONS.has(ext) ? target.slice(0, dot) : target;
}
