import { Node, mergeAttributes } from "@tiptap/core";
import markdownItDeflist from "markdown-it-deflist";

/**
 * Pandoc / extended-markdown definition lists:
 *
 *   Markdown
 *   : A lightweight markup language with plain-text formatting syntax.
 *
 *   LaTeX
 *   : A typesetting system widely used for technical and scientific docs.
 *
 * Without this extension Tiptap drops the `<dl><dt><dd>` HTML produced
 * by markdown-it-deflist into plain paragraphs (or, before the deflist
 * plugin was wired, the source itself flattens to `Markdown : defn` on
 * round-trip). Three nodes here match the HTML structure 1:1:
 *
 *   DefinitionList         ↔ <dl>
 *   DefinitionTerm         ↔ <dt>
 *   DefinitionDescription  ↔ <dd>
 *
 * Serializer emits the source form: `term\n: defn\n\n` per grouping.
 *
 * The markdown-it-deflist plugin is installed via DefinitionList's parse
 * setup() so it only fires inside the WYSIWYG markdown-it instance —
 * doesn't affect the Preview pipeline (which uses remark + remark-gfm).
 *
 * v1 scope limitation: term/description content is treated as inline-only
 * (text + marks). Multi-paragraph descriptions and nested block content
 * inside a description aren't supported — they're rare in practice and
 * adding them would require relaxing the content rule + handling block
 * boundaries in the serializer.
 */

const installed = new WeakSet<object>();

interface SerializerState {
  write: (s: string) => void;
  renderInline: (n: unknown) => void;
  closeBlock: (n: unknown) => void;
  ensureNewLine: () => void;
}

interface PMNodeLike {
  forEach: (cb: (child: PMNodeLike, offset: number, i: number) => void) => void;
  type: { name: string };
  childCount: number;
}

export const DefinitionList = Node.create({
  name: "definitionList",
  group: "block",
  // <dl> alternates dt+ dd+ groupings — accept either in any order so the
  // schema doesn't reject malformed-but-tolerable real-world DOM.
  content: "(definitionTerm | definitionDescription)+",
  defining: true,

  parseHTML() {
    return [{ tag: "dl" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["dl", mergeAttributes(HTMLAttributes, { class: "deflist" }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerializerState, node: PMNodeLike) {
          // Walk children and emit each in source form. Insert a blank
          // line between groupings (after a `dd` followed by a new `dt`)
          // so the next parse re-recognizes the boundary.
          let prevType: string | null = null;
          node.forEach((child) => {
            if (child.type.name === "definitionTerm") {
              if (prevType === "definitionDescription") {
                state.ensureNewLine();
                state.write("\n");
              }
              state.renderInline(child);
              state.ensureNewLine();
            } else {
              state.write(": ");
              state.renderInline(child);
              state.ensureNewLine();
            }
            prevType = child.type.name;
          });
          state.closeBlock(node);
        },
        parse: {
          setup(md: object) {
            if (installed.has(md)) return;
            installed.add(md);
            (md as { use: (plugin: unknown) => void }).use(markdownItDeflist);
          },
        },
      },
    };
  },
});

export const DefinitionTerm = Node.create({
  name: "definitionTerm",
  // Inline content: marks like bold/italic survive, but multi-paragraph
  // terms aren't a thing in the markdown source form anyway.
  content: "inline*",
  defining: true,

  parseHTML() {
    // Priority bump defends against extension drift claiming generic <dt>.
    return [{ tag: "dt", priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["dt", mergeAttributes(HTMLAttributes), 0];
  },
});

export const DefinitionDescription = Node.create({
  name: "definitionDescription",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "dd", priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["dd", mergeAttributes(HTMLAttributes), 0];
  },
});
