import BaseHardBreak from "@tiptap/extension-hard-break";

/**
 * HardBreak that serializes as the canonical CommonMark "two trailing
 * spaces + newline" form rather than prosemirror-markdown's default
 * `\\\n` (backslash + newline).
 *
 * Both forms render identically — they're equivalent CommonMark hard
 * breaks. Choosing one consistently solves the round-trip noise where
 * a user typed two spaces, opened the file in WYSIWYG, saved, and saw
 * the source flip to backslash form. The two-space form is the more
 * conventional choice in the wild and is what most rendered-markdown
 * tools produce when asked for "canonical" output.
 *
 * Tradeoff: anyone who deliberately typed `\\\n` will see their source
 * flip to two-space on save. Acceptable — backslash hard breaks are an
 * uncommon style choice and the rendered output is identical.
 */

interface SerializerState {
  write: (s: string) => void;
}

interface ProseNode {
  type: { name: string };
}

interface ProseParent {
  childCount: number;
  child: (i: number) => ProseNode;
}

export const HardBreakTwoSpace = BaseHardBreak.extend({
  addStorage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent = (this.parent?.() as Record<string, any>) ?? {};
    return {
      ...parent,
      markdown: {
        serialize(
          state: SerializerState,
          node: ProseNode,
          parsedParent: ProseParent,
          index: number,
        ) {
          // Mirror prosemirror-markdown's collapse logic: only emit a hard
          // break if there's more inline content after this node — trailing
          // hard breaks at the end of a block would just produce a stray
          // line. Difference from upstream: emit "  \n" instead of "\\\n".
          for (let i = index + 1; i < parsedParent.childCount; i++) {
            if (parsedParent.child(i).type !== node.type) {
              state.write("  \n");
              return;
            }
          }
        },
      },
    };
  },
});
