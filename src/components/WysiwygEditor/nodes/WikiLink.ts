import { Mark, mergeAttributes } from "@tiptap/core";
import { markdownItWikiLinks } from "../../../lib/markdown/markdownItWikiLinks";

/**
 * Obsidian/Logseq-style `[[Target]]` wiki-link as a Tiptap inline mark.
 *
 * Wraps the display text with a class="wikilink" span; the link target is
 * stored on the mark so the round-trip back to `[[…]]` on save works even
 * when the user edits the display text. Click handling lives in
 * WysiwygEditor.tsx where it can reach the active folder state.
 */
const installed = new WeakSet<object>();

export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,
  // Higher than Link (1000) so `<a class="wikilink">` variants don't get
  // swallowed by the plain Link mark.
  priority: 1001,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (el) => {
          const node = el as HTMLElement;
          return (
            node.getAttribute("data-wiki-target") ?? (node.textContent ?? "").trim()
          );
        },
        renderHTML: (attrs) => {
          const target = String((attrs as { target: string }).target || "");
          return target ? { "data-wiki-target": target } : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: "span.wikilink" },
      // The preview pipeline emits an <a> — cover that too for parity if a
      // wiki-style link ever rides in through pasted HTML.
      { tag: "a.wikilink" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "wikilink" }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "[[",
          close: "]]",
          mixable: false,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(md: object) {
            if (installed.has(md)) return;
            installed.add(md);
            markdownItWikiLinks(md as Parameters<typeof markdownItWikiLinks>[0]);
          },
        },
      },
    };
  },
});
