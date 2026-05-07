import { visit, SKIP } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Text, Parent, PhrasingContent } from "mdast";

/**
 * Adds Obsidian/Logseq-style wiki-links to the preview pipeline:
 *
 *   [[Page Name]]  →  <a class="wikilink" data-wiki-target="Page Name"
 *                        href="#wiki:Page%20Name">Page Name</a>
 *
 * The resulting anchor is intercepted by PreviewPane's click handler which
 * resolves the target against the currently-open folder (same behaviour as
 * the Tiptap `wikiLink` mark in WYSIWYG).
 *
 * Constraints match the markdown-it sibling:
 *   - no newlines, brackets, or pipes inside the link body
 *   - pure text nodes only (we skip code / inlineCode parents)
 */
const WIKI_RE = /\[\[([^\[\]\n|]+)\]\]/g;

export const remarkWikiLinks: Plugin<[], Root> = () => (tree) => {
  visit(tree, "text", (node: Text, index, parent: Parent | null) => {
    if (!parent || index == null) return;
    const value = node.value;
    if (!value.includes("[[")) return;
    const matches = Array.from(value.matchAll(WIKI_RE));
    if (matches.length === 0) return;
    const replacements: PhrasingContent[] = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.index === undefined) continue;
      const start = match.index;
      if (start > cursor) {
        replacements.push({ type: "text", value: value.slice(cursor, start) });
      }
      const target = match[1].trim();
      // Raw HTML is picked up by rehype-raw downstream; the equivalent mdast
      // link node requires an hProperties shim we'd rather avoid.
      replacements.push({
        type: "html",
        value:
          '<a class="wikilink" href="#wiki:' +
          encodeURIComponent(target) +
          '" data-wiki-target="' +
          escAttr(target) +
          '">' +
          escText(target) +
          "</a>",
      });
      cursor = start + match[0].length;
    }
    if (cursor < value.length) {
      replacements.push({ type: "text", value: value.slice(cursor) });
    }
    parent.children.splice(index, 1, ...replacements);
    return [SKIP, index + replacements.length];
  });
};

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
