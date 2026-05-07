import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Decorates the table cell containing the text-cursor anchor with a
 * `has-focus` class, so CSS can draw an outline around it. Without this,
 * empty cells give no visible signal of where the cursor lives — the
 * 1-pixel default caret is effectively invisible against a white cell.
 */
export const FocusCell = Extension.create({
  name: "focusCell",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("focusCell"),
        props: {
          decorations(state) {
            const { selection, doc } = state;
            const $from = selection.$from;
            for (let depth = $from.depth; depth > 0; depth--) {
              const node = $from.node(depth);
              const name = node.type.name;
              if (name === "tableCell" || name === "tableHeader") {
                const pos = $from.before(depth);
                return DecorationSet.create(doc, [
                  Decoration.node(pos, pos + node.nodeSize, { class: "has-focus" }),
                ]);
              }
            }
            return DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
