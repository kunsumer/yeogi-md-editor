import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Selection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import { WysiwygEditor } from "./WysiwygEditor";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));
vi.mock("../../lib/ipc/commands", () => ({
  fsRead: vi.fn(),
  watcherSubscribe: vi.fn(),
}));

// Tiptap v3 exposes the live editor instance on the ProseMirror root
// element (`dom.editor = this`) — that's our handle into selection state
// without widening the component's props for tests.
async function mountEditor(content: string) {
  const utils = render(<WysiwygEditor content={content} onChange={() => {}} />);
  await waitFor(() => {
    const dom = utils.container.querySelector(".tiptap") as
      | (HTMLElement & { editor?: Editor })
      | null;
    expect(dom?.editor).toBeTruthy();
  });
  const dom = utils.container.querySelector(".tiptap") as HTMLElement & {
    editor?: Editor;
  };
  return { editor: dom.editor!, ...utils };
}

const LONG_DOC =
  "# Title\n\n" +
  Array.from({ length: 30 }, (_, i) => `Paragraph ${i + 1}.`).join("\n\n");

describe("WysiwygEditor initial caret position", () => {
  it("opens a multi-block document focused with the caret at the start, not the end", async () => {
    const { editor } = await mountEditor(LONG_DOC);

    // Focus (and the create-time caret placement) settles in a
    // requestAnimationFrame after mount — assert the settled state, not
    // the pre-onCreate default.
    await waitFor(() => expect(editor.isFocused).toBe(true));

    const { doc, selection } = editor.state;
    const start = Selection.atStart(doc).from;
    const end = Selection.atEnd(doc).from;
    // Sanity: with 30+ blocks, start and end must differ — otherwise the
    // assertion below couldn't distinguish the two behaviors.
    expect(start).not.toBe(end);

    // Opening a document must land the user at the top: caret at the
    // first selectable position, so nothing scrolls the view to the
    // bottom on mount.
    expect(selection.from).toBe(start);
  });

  it("still focuses an empty document so the caret is ready to type", async () => {
    const { editor } = await mountEditor("");
    // Focus is acquired in a requestAnimationFrame after create.
    await waitFor(() => expect(editor.isFocused).toBe(true));
    const { doc, selection } = editor.state;
    expect(selection.from).toBe(Selection.atStart(doc).from);
  });

  it("never node-selects a leading frontmatter atom — typing must not delete it", async () => {
    // Selection.atStart on this doc is a NodeSelection of the (invisible)
    // frontmatter atom; focusing that would make the first keystroke
    // REPLACE the node — silent data loss. The caret must land on the
    // first text position instead.
    const { editor } = await mountEditor(
      "---\ntitle: Test\nauthor: Me\n---\n\n# Hello\n\nWorld.",
    );
    await waitFor(() => expect(editor.isFocused).toBe(true));

    expect(editor.state.selection.toJSON().type).toBe("text");

    // The proof that matters: a keystroke right after opening keeps the
    // frontmatter intact.
    editor.commands.insertContent("x");
    let hasFrontmatter = false;
    editor.state.doc.descendants((n) => {
      if (n.type.name === "frontmatter") hasFrontmatter = true;
    });
    expect(hasFrontmatter).toBe(true);
  });
});

describe("WysiwygEditor external content sync", () => {
  it("keeps the caret near its old position instead of jumping to the end", async () => {
    // Watcher-driven silent reloads swap `content` on a mounted editor.
    // Core setContent's full-range replace maps any inner caret to the
    // END of the doc — without a restore, the next keystroke would land
    // at the bottom.
    const { editor, rerender } = await mountEditor(LONG_DOC);
    await waitFor(() => expect(editor.isFocused).toBe(true));

    const updated = LONG_DOC + "\n\nAppended externally.";
    rerender(<WysiwygEditor content={updated} onChange={() => {}} />);
    await waitFor(() =>
      expect(editor.state.doc.textContent).toContain("Appended externally."),
    );

    const { doc, selection } = editor.state;
    expect(selection.from).not.toBe(Selection.atEnd(doc).from);
    // Caret was at the very start before the swap; it must stay there.
    expect(selection.from).toBe(Selection.atStart(doc).from);
  });
});
