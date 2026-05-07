import { visit, SKIP } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root, Text, Parent, PhrasingContent } from "mdast";

/**
 * Adds Pandoc / extended-markdown inline marks that remark-gfm doesn't
 * cover:
 *
 *   H~2~O               →  H<sub>2</sub>O
 *   E = mc^2^           →  E = mc<sup>2</sup>
 *   ==highlighted==     →  <mark>highlighted</mark>
 *
 * Implemented as a text-node → html-node rewrite so rehype-raw picks
 * them up downstream. We skip emit inside code/inlineCode because those
 * are separate mdast node types (visit only sees `text` here).
 *
 * Design notes:
 *   - Single-`~` sub doesn't collide with GFM strikethrough because GFM
 *     parses the double-tilde variant as its own `delete` node *before*
 *     this plugin runs; the text node we see is already post-strikethrough.
 *   - `^…^` inside `$…$` math fences is safe because remark-math owns
 *     those as `inlineMath` / `math` nodes.
 *   - We require at least one non-whitespace char between delimiters, and
 *     forbid the delimiter itself in the body, so casual uses of `~`, `^`,
 *     or `==` as literal punctuation don't false-trigger (e.g. `a = b`
 *     doesn't match because it's a single `=`).
 */
const PATTERN =
  /(~)([^~\s][^~]*?[^~\s]|[^~\s])~|(\^)([^\^\s][^\^]*?[^\^\s]|[^\^\s])\^|(==)([^=\s][^=]*?[^=\s]|[^=\s])==/g;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const remarkInlineMarks: Plugin<[], Root> = () => (tree) => {
  visit(tree, "text", (node: Text, index, parent: Parent | null) => {
    if (!parent || index == null) return;
    const value = node.value;
    // Cheap opt-out: skip text nodes that can't possibly contain a match.
    if (!/[~^=]/.test(value)) return;
    const matches = Array.from(value.matchAll(PATTERN));
    if (matches.length === 0) return;
    const replacements: PhrasingContent[] = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.index === undefined) continue;
      if (m.index > cursor) {
        replacements.push({ type: "text", value: value.slice(cursor, m.index) });
      }
      let tag: "sub" | "sup" | "mark";
      let inner: string;
      if (m[1]) {
        tag = "sub";
        inner = m[2];
      } else if (m[3]) {
        tag = "sup";
        inner = m[4];
      } else {
        tag = "mark";
        inner = m[6];
      }
      replacements.push({
        type: "html",
        value: `<${tag}>${esc(inner)}</${tag}>`,
      });
      cursor = m.index + m[0].length;
    }
    if (cursor < value.length) {
      replacements.push({ type: "text", value: value.slice(cursor) });
    }
    parent.children.splice(index, 1, ...replacements);
    // Skip over the replaced nodes so we don't re-visit them (html nodes
    // have no `value` to re-scan anyway, but explicit is safer).
    return [SKIP, index + replacements.length];
  });
};
