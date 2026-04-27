import BaseHeading from "@tiptap/extension-heading";

/**
 * Heading node that remembers its source syntax (ATX `# Title` vs Setext
 * `Title\n====`) across a WYSIWYG round-trip. The default tiptap-markdown
 * Heading serializer always emits ATX, so Setext users saw their source
 * rewritten on every save even though the rendered output was identical.
 *
 * Implementation:
 *   - `syntax` attr on the node: `"atx"` (default) or `"setext"`.
 *   - markdown-it parse hook writes `data-syntax` into the heading's HTML
 *     based on each heading_open token's `markup` field (markdown-it sets
 *     this to `#`/`##`/... for ATX, `=`/`-` for Setext).
 *   - parseHTML reads `data-syntax` back onto the node attr.
 *   - Serializer chooses ATX vs Setext based on the attr, falling back to
 *     ATX for levels 3+ (Setext is only defined for H1 and H2).
 */

type Token = { markup: string; attrSet: (name: string, value: string) => void };
type MdInstance = {
  renderer: {
    rules: Record<
      string,
      | ((
          tokens: Token[],
          idx: number,
          options: unknown,
          env: unknown,
          slf: { renderToken: (tokens: Token[], idx: number, options: unknown) => string },
        ) => string)
      | undefined
    >;
  };
};

// tiptap-markdown re-runs setup() on every parse; gate to avoid double-wrap.
const installed = new WeakSet<object>();

export const HeadingWithSyntax = BaseHeading.extend({
  addAttributes() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = (this.parent?.() as Record<string, any>) ?? {};
    return {
      ...parent,
      syntax: {
        default: "atx",
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-syntax") ?? "atx",
        renderHTML: () => ({
          // Don't render data-syntax back into the editor DOM — it's only
          // useful at the parse boundary. Keeping it out of renderHTML
          // avoids ProseMirror's MutationObserver worrying about it.
        }),
      },
    };
  },

  addStorage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = (this.parent?.() as Record<string, any>) ?? {};
    return {
      ...parent,
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            out: string;
            renderInline: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
            ensureNewLine: () => void;
          },
          node: { attrs: { level: number; syntax?: string } },
        ) {
          const level = node.attrs.level;
          const syntax = node.attrs.syntax ?? "atx";
          // Setext only exists for H1/H2. Levels 3+ always ATX.
          if (syntax === "setext" && (level === 1 || level === 2)) {
            const start = state.out.length;
            state.renderInline(node);
            const text = state.out.slice(start);
            state.ensureNewLine();
            const underline = (level === 1 ? "=" : "-").repeat(
              Math.max(3, text.length),
            );
            state.write(underline);
            state.closeBlock(node);
            return;
          }
          state.write("#".repeat(level) + " ");
          state.renderInline(node);
          state.closeBlock(node);
        },
        parse: {
          setup(md: MdInstance) {
            if (installed.has(md)) return;
            installed.add(md);
            const original = md.renderer.rules.heading_open;
            md.renderer.rules.heading_open = (tokens, idx, options, env, slf) => {
              const token = tokens[idx];
              // markdown-it sets `markup` to "=" / "-" for Setext, "#"/"##"/...
              // for ATX. Anything not starting with "#" is Setext.
              const isSetext =
                token.markup.length > 0 && token.markup[0] !== "#";
              token.attrSet("data-syntax", isSetext ? "setext" : "atx");
              return original
                ? original(tokens, idx, options, env, slf)
                : slf.renderToken(tokens, idx, options);
            };
          },
        },
      },
    };
  },
});
