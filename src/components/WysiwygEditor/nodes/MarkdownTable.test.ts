import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { MarkdownTable } from "./MarkdownTable";
import { MathInline, MathBlock } from "./MathNodes";
import { WikiLink } from "./WikiLink";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      MarkdownTable,
      TableRow,
      TableHeader,
      TableCell,
      MathInline,
      MathBlock,
      WikiLink,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
}

function toMd(e: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e.storage as any).markdown.getMarkdown();
}

describe("MarkdownTable cell serialization", () => {
  it("preserves inline math in a cell", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "| Feature | Syntax |\n|---------|--------|\n| LaTeX | $\\LaTeX$ |\n",
    );
    const md = toMd(editor);
    // Cell must still carry the math — the exact form may vary ($\LaTeX$ vs
    // $\LaTeX$ with different escaping), but the LaTeX source must appear.
    expect(md).toMatch(/LaTeX \| \$.*LaTeX.*\$/);
    editor.destroy();
  });

  it("preserves wiki-links in a cell", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "| Label | Target |\n|-------|--------|\n| Note | [[Internal Note]] |\n",
    );
    const md = toMd(editor);
    // Serializer-level output is the un-collapsed `[[Target|Display]]` form;
    // App.getMarkdown later collapses `[[X|X]]` → `[[X]]`. Either is fine
    // here — just confirm the target made it through at all.
    expect(md).toMatch(/\[\[Internal Note(\|[^\]]+)?\]\]/);
    editor.destroy();
  });

  it("still renders empty cells as empty (no false-positive from fix)", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "| A | B | C |\n|---|---|---|\n| 1 |   | 3 |\n",
    );
    const md = toMd(editor);
    // Empty middle cell shows up as `| |` / `|  |` — zero content between the
    // bars, not the literal word "empty" or anything unexpected.
    expect(md).toMatch(/\| 1 \|\s*\| 3 \|/);
    editor.destroy();
  });
});
