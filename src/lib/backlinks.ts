import { fsList, fsRead, type DirEntry } from "./ipc/commands";
import { stripMdExt } from "./resolveWikiLink";

const MD_EXTENSIONS = new Set(["md", "markdown", "mdown", "mkd"]);
const SCAN_DIR_BUDGET = 500;
const PREVIEW_MAX = 120;

export interface BacklinkEntry {
  /** Absolute path of the file that contains the wiki-link. */
  sourcePath: string;
  /** `sourcePath`'s basename with the markdown extension stripped. */
  sourceName: string;
  /** The single preview line. May be truncated with ellipses. */
  preview: string;
  /** Extra occurrences in the SAME source file beyond the first one. */
  additionalCount: number;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1);
}

function basenameNoExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * Pull the single line containing the match and trim/ellipsize if it's
 * longer than PREVIEW_MAX. When truncating, the window is centered on the
 * wiki-link so the match itself stays visible rather than being lost in the
 * middle of a long line.
 */
export function extractPreviewLine(
  content: string,
  matchStart: number,
  matchLen: number,
): string {
  const lineStart = content.lastIndexOf("\n", Math.max(0, matchStart - 1)) + 1;
  const nlEnd = content.indexOf("\n", matchStart);
  const lineEnd = nlEnd === -1 ? content.length : nlEnd;
  const rawLine = content.slice(lineStart, lineEnd);
  const leadingStripped = rawLine.length - rawLine.trimStart().length;
  const line = rawLine.trim();
  if (line.length <= PREVIEW_MAX) return line;

  const relMatchStart = matchStart - lineStart - leadingStripped;
  const half = Math.max(
    0,
    Math.floor((PREVIEW_MAX - 2) / 2) - Math.floor(matchLen / 2),
  );
  let left = Math.max(0, relMatchStart - half);
  let right = Math.min(line.length, left + PREVIEW_MAX - 2);
  if (right === line.length) left = Math.max(0, right - (PREVIEW_MAX - 2));
  const prefix = left > 0 ? "…" : "";
  const suffix = right < line.length ? "…" : "";
  return prefix + line.slice(left, right) + suffix;
}

/**
 * Exported for unit testing. Scans a single content string for wiki-links
 * whose target (case-insensitively) equals `targetLower`. Uses `matchAll`
 * rather than .exec() to iterate — both are valid, but matchAll is easier
 * to reason about in one pass.
 */
export function findLinksTo(
  content: string,
  targetLower: string,
): { firstIdx: number; firstLen: number; count: number } | null {
  const re = /\[\[([^\[\]\n|]+)(?:\|[^\[\]\n]+)?\]\]/g;
  let firstIdx = -1;
  let firstLen = 0;
  let count = 0;
  for (const m of content.matchAll(re)) {
    // Normalize the match the same way the resolver does — strip a
    // trailing `.md`/`.markdown`/`.mdown`/`.mkd` so `[[README.md]]` and
    // `[[README]]` both count as a link to README.md.
    const normalized = stripMdExt(m[1].trim()).toLowerCase();
    if (normalized !== targetLower) continue;
    if (firstIdx === -1) {
      firstIdx = m.index ?? 0;
      firstLen = m[0].length;
    }
    count++;
  }
  if (count === 0) return null;
  return { firstIdx, firstLen, count };
}

/**
 * Scan the folder tree for markdown files that wiki-link back to
 * `activeDocPath`. Light implementation: regex-based, no persistent index,
 * 500-directory BFS budget, one preview line per source file (with a count
 * indicator when the same source links multiple times).
 *
 * Target resolution is a case-insensitive basename match — in the rare case
 * of colliding basenames, this may over-match. Acceptable for v1.
 */
export async function scanBacklinks(
  folder: string,
  activeDocPath: string,
): Promise<BacklinkEntry[]> {
  const activeFilename = activeDocPath.split("/").pop() ?? "";
  const activeLower = basenameNoExt(activeFilename).toLowerCase();
  if (!activeLower) return [];

  // BFS-collect every markdown file under the folder.
  const files: string[] = [];
  let queue: string[] = [folder];
  let budget = SCAN_DIR_BUDGET;
  while (queue.length > 0 && budget > 0) {
    const next: string[] = [];
    for (const dir of queue) {
      if (budget <= 0) break;
      budget--;
      let entries: DirEntry[];
      try {
        entries = await fsList(dir);
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.is_dir) {
          next.push(e.path);
          continue;
        }
        const ext = extOf(e.name).toLowerCase();
        if (!MD_EXTENSIONS.has(ext)) continue;
        files.push(e.path);
      }
    }
    queue = next;
  }

  const results: BacklinkEntry[] = [];
  for (const sourcePath of files) {
    // Skip self-links — a doc referencing itself isn't a "backlink."
    if (sourcePath === activeDocPath) continue;
    let content: string;
    try {
      const r = await fsRead(sourcePath);
      content = r.content;
    } catch {
      continue;
    }
    const match = findLinksTo(content, activeLower);
    if (!match) continue;
    const sourceName = basenameNoExt(sourcePath.split("/").pop() ?? "");
    results.push({
      sourcePath,
      sourceName,
      preview: extractPreviewLine(content, match.firstIdx, match.firstLen),
      additionalCount: match.count - 1,
    });
  }

  results.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  return results;
}
