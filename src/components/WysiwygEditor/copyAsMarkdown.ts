import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { postProcessMarkdown } from "./postProcessMarkdown";

/**
 * Serialize the current selection to markdown source, using the same
 * tiptap-markdown serializer + post-processing the save path uses — so
 * ⇧⌘C output matches what the .md file would contain.
 *
 * Uses `doc.cut(from, to)` rather than the selection slice so ancestor
 * context survives: selecting text inside a heading yields `# text`, a
 * cell selection yields a pipe table, etc.
 *
 * Returns null when there's nothing to copy (empty selection) or the
 * markdown storage isn't available (shouldn't happen in this editor).
 */
export function selectionToMarkdown(editor: Editor): string | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const storage = (editor.storage as unknown as Record<string, unknown>).markdown as
    | { serializer?: { serialize(content: PMNode): string } }
    | undefined;
  if (!storage?.serializer) return null;
  const cut = editor.state.doc.cut(from, to);
  return postProcessMarkdown(storage.serializer.serialize(cut)).replace(/\n+$/, "");
}

/**
 * Copy the selection as markdown source to the system clipboard.
 * Returns true when a copy was initiated (so the keyboard shortcut is
 * marked handled), false on an empty selection (letting ⇧⌘C fall
 * through, mirroring ⌘C's no-op on nothing).
 */
export function copySelectionAsMarkdown(editor: Editor): boolean {
  const md = selectionToMarkdown(editor);
  if (md === null) return false;
  void navigator.clipboard?.writeText(md).catch((err) => {
    console.warn("copy as markdown failed", err);
  });
  return true;
}

/**
 * ⇧⌘C — Copy as Markdown. Plain ⌘C stays native (plain text +
 * rich HTML flavors); this shortcut is the explicit "give me the
 * markdown source" escape hatch.
 */
export const CopyAsMarkdown = Extension.create({
  name: "copyAsMarkdown",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-c": () => copySelectionAsMarkdown(this.editor),
    };
  },
});
