import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { MarkdownTable } from "./nodes/MarkdownTable";
import { selectionToMarkdown, copySelectionAsMarkdown } from "./copyAsMarkdown";

function makeEditor(content = "") {
  const editor = new Editor({
    extensions: [
      StarterKit,
      MarkdownTable,
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
  if (content) editor.commands.setContent(content);
  return editor;
}

describe("selectionToMarkdown", () => {
  it("returns null for an empty selection", () => {
    const editor = makeEditor("Some text.");
    // Fresh editor: collapsed caret at start.
    expect(selectionToMarkdown(editor)).toBeNull();
    editor.destroy();
  });

  it("keeps inline markdown syntax (bold) in the output", () => {
    const editor = makeEditor("This is **bold** text.");
    editor.commands.selectAll();
    const md = selectionToMarkdown(editor);
    expect(md).toContain("**bold**");
    editor.destroy();
  });

  it("serializes a selected simple table as GFM pipes, not HTML", () => {
    const editor = makeEditor(
      "| User agent | Version |\n|---|---|\n| Safari | 17 |\n",
    );
    editor.commands.selectAll();
    const md = selectionToMarkdown(editor);
    expect(md).toContain("| User agent |");
    expect(md).not.toContain("<table>");
    editor.destroy();
  });
});

describe("copySelectionAsMarkdown", () => {
  /** jsdom has no navigator.clipboard — install a recording stub. */
  function stubClipboard() {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    return {
      writeText,
      restore() {
        delete (navigator as { clipboard?: unknown }).clipboard;
      },
    };
  }

  it("writes the markdown to the clipboard and reports handled", () => {
    const { writeText, restore } = stubClipboard();
    try {
      const editor = makeEditor("Some **bold** text.");
      editor.commands.selectAll();
      expect(copySelectionAsMarkdown(editor)).toBe(true);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain("**bold**");
      editor.destroy();
    } finally {
      restore();
    }
  });

  it("does nothing (and reports unhandled) for an empty selection", () => {
    const { writeText, restore } = stubClipboard();
    try {
      const editor = makeEditor("Some text.");
      expect(copySelectionAsMarkdown(editor)).toBe(false);
      expect(writeText).not.toHaveBeenCalled();
      editor.destroy();
    } finally {
      restore();
    }
  });
});
