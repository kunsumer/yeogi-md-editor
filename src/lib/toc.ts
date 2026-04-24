import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Heading as MdastHeading, Text } from "mdast";

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
}

export interface Block {
  /** mdast node type (heading, paragraph, code, list, blockquote, etc.). */
  type: string;
  /** 1-indexed source line where the block starts. */
  line: number;
}

const parser = unified().use(remarkParse).use(remarkGfm);

export function extractHeadings(md: string): Heading[] {
  const tree = parser.parse(md) as Root;
  const headings: Heading[] = [];
  visit(tree, "heading", (node: MdastHeading) => {
    const text = node.children
      .filter((c): c is Text => c.type === "text")
      .map((c) => c.value)
      .join("")
      .replace(/\s*#+\s*$/, "")
      .trim();
    if (!text) return;
    const line = node.position?.start.line ?? 1;
    headings.push({ level: node.depth as Heading["level"], text, line });
  });
  return headings;
}

/**
 * Top-level block anchors for finer-grained view-mode scroll sync than
 * headings alone. Each entry corresponds to a direct child of the mdast
 * root, modulo a few filters that keep the list aligned with what actually
 * renders as a top-level child in the WYSIWYG DOM:
 *
 *   - `yaml` / `toml` frontmatter is skipped (rendered as a hidden node)
 *   - `definition` (link reference definitions like `[foo]: url`) is skipped
 *     (invisible in rendered output — no corresponding DOM block)
 *   - consecutive `footnoteDefinition` entries collapse into a single
 *     "footnoteSection" anchor (they render as one `<section>` bundle)
 *
 * These filters keep the i-th block in the returned array ordinally aligned
 * with the i-th visible top-level DOM child of the ProseMirror content.
 */
export function extractBlocks(md: string): Block[] {
  const tree = parser.parse(md) as Root;
  const blocks: Block[] = [];
  let inFootnoteRun = false;
  for (const child of tree.children) {
    const type = child.type;
    // yaml frontmatter renders as a hidden node; `toml` etc. aren't produced
    // by remark-parse without a plugin, but guard in case one's added later.
    if (type === "yaml" || (type as string) === "toml") continue;
    if (type === "definition") continue;
    if (type === "footnoteDefinition") {
      if (inFootnoteRun) continue;
      inFootnoteRun = true;
      const line = child.position?.start.line ?? 1;
      blocks.push({ type: "footnoteSection", line });
      continue;
    }
    inFootnoteRun = false;
    const line = child.position?.start.line ?? 1;
    blocks.push({ type, line });
  }
  return blocks;
}
