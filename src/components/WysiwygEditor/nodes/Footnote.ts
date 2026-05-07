import { Node, mergeAttributes } from "@tiptap/core";
import markdownItFootnote from "markdown-it-footnote";

/**
 * Markdown footnotes (`[^id]` refs and `[^id]: body` defs).
 *
 * We delegate parsing to `markdown-it-footnote`, then override its renderers
 * to emit DOM shapes that match the Tiptap nodes below:
 *
 *   <sup data-footnote-ref="1"><a href="#fn1">1</a></sup>
 *   <section data-footnote-section> <ol> <li data-footnote-id="1">…</li> </ol> </section>
 *
 * Serializers round-trip back to `[^id]` / `[^id]: body` with best-effort
 * fidelity (multi-paragraph defs collapse to a single paragraph — an
 * acceptable v1 compromise).
 */

const wired = new WeakSet<object>();

export const FootnoteRef = Node.create({
  name: "footnoteRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        // Priority 60 > default 50 so FootnoteRef (Node, atom) wins over
        // Superscript (Mark, matches generic `sup`) and Link (Mark, matches
        // the inner `<a>`). Without this bump, the footnote `<sup><a>1</a></sup>`
        // gets parsed as a superscript-wrapped link and serializes back as
        // the grotesque `[^1^](#fn-1)` form.
        tag: "sup[data-footnote-ref]",
        priority: 60,
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-footnote-ref") ?? "",
          label: (el as HTMLElement).textContent ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-ref": (node.attrs.id as string) || "",
        class: "footnote-ref",
      }),
      ["a", { href: `#fn-${node.attrs.id as string}` }, (node.attrs.label as string) || String(node.attrs.id)],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: { attrs: { id: string; label: string } },
        ) {
          state.write(`[^${node.attrs.id || node.attrs.label}]`);
        },
        parse: {
          setup(md: {
            use: (plugin: unknown) => unknown;
            renderer: {
              rules: Record<
                string,
                | ((
                    tokens: Array<{
                      meta?: { id?: number; label?: string; subId?: number };
                    }>,
                    idx: number,
                    options: unknown,
                    env: unknown,
                    slf: unknown,
                  ) => string)
                | undefined
              >;
            };
          }) {
            if (wired.has(md)) return;
            wired.add(md);
            md.use(markdownItFootnote);

            md.renderer.rules.footnote_ref = (tokens, idx) => {
              const t = tokens[idx];
              const label = t.meta?.label ?? String((t.meta?.id ?? 0) + 1);
              const idAttr = esc(label);
              const textLabel = esc(label);
              return `<sup data-footnote-ref="${idAttr}" class="footnote-ref"><a href="#fn-${idAttr}">${textLabel}</a></sup>`;
            };
            // The anchor returned by footnote_anchor gets appended to the def;
            // make it a no-op so our FootnoteItem schema stays simple.
            md.renderer.rules.footnote_anchor = () => "";
            // Footnotes block: wrap in a section we can recognize.
            md.renderer.rules.footnote_open = (tokens, idx) => {
              const t = tokens[idx];
              const label = t.meta?.label ?? String((t.meta?.id ?? 0) + 1);
              return `<li data-footnote-id="${esc(label)}" class="footnote-item">`;
            };
            md.renderer.rules.footnote_close = () => "</li>\n";
            md.renderer.rules.footnote_block_open = () =>
              `<section data-footnote-section class="footnotes"><ol>\n`;
            md.renderer.rules.footnote_block_close = () => "</ol></section>\n";
            md.renderer.rules.footnote_caption = () => "";
          },
        },
      },
    };
  },
});

export const FootnoteSection = Node.create({
  name: "footnoteSection",
  group: "block",
  content: "footnoteItem+",

  parseHTML() {
    // Priority 60 > default 50 so FootnoteSection claims the wrapping
    // `<section><ol>…</ol></section>` before StarterKit's OrderedList
    // matches the inner `<ol>`. Without this, the footnote section
    // collapses into a plain ordered list and the section wrapper is lost.
    return [{ tag: "section[data-footnote-section]", priority: 60 }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-section": "",
        class: "footnotes",
      }),
      ["ol", 0],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { renderContent: (node: unknown) => void; closeBlock: (node: unknown) => void },
          node: unknown,
        ) {
          state.renderContent(node);
          state.closeBlock(node);
        },
      },
    };
  },
});

export const FootnoteItem = Node.create({
  name: "footnoteItem",
  group: "block",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return { id: { default: "" } };
  },

  parseHTML() {
    return [
      {
        // Priority 60 > default 50 so FootnoteItem beats StarterKit's
        // ListItem (generic `li`). Without the bump, the footnote definition
        // loses its `data-footnote-id` attr and serializes as a plain
        // ordered-list item (`1. body` instead of `[^1]: body`).
        tag: "li[data-footnote-id]",
        priority: 60,
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-footnote-id") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        "data-footnote-id": (node.attrs.id as string) || "",
        class: "footnote-item",
      }),
      0,
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            renderInline: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: { id: string }; forEach: (fn: (child: unknown) => void) => void },
        ) {
          state.write(`[^${node.attrs.id}]: `);
          // Render first paragraph's inline content on the same line.
          let first = true;
          node.forEach((child) => {
            const c = child as { type: { name: string } };
            if (first && c.type.name === "paragraph") {
              state.renderInline(child);
              first = false;
            } else {
              state.write("\n    ");
              state.renderInline(child);
            }
          });
          state.write("\n");
          state.closeBlock(node);
        },
      },
    };
  },
});

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
