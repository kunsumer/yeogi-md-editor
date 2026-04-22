import { Node, mergeAttributes } from "@tiptap/core";

/**
 * HTML `<details>` / `<summary>` passthrough.
 *
 * Tiptap's default schema drops unknown tags, so raw `<details>` in markdown
 * degrades to plain text. These two nodes whitelist the tags, preserve them
 * in the ProseMirror doc, and let the browser's built-in disclosure behavior
 * work (click-to-expand).
 */

export const Details = Node.create({
  name: "details",
  group: "block",
  content: "summary block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (el) => el.hasAttribute("open"),
        renderHTML: (attrs) => (attrs.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            renderContent: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
          },
          node: unknown,
        ) {
          state.renderContent(node);
          state.closeBlock(node);
        },
      },
    };
  },
});

export const Summary = Node.create({
  name: "summary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            renderInline: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
            write: (s: string) => void;
          },
          node: unknown,
        ) {
          state.renderInline(node);
          state.closeBlock(node);
        },
      },
    };
  },
});
