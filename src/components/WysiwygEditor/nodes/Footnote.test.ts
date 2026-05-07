import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Subscript, Superscript, Highlight } from "./SubSup";
import { FootnoteRef, FootnoteSection, FootnoteItem } from "./Footnote";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Subscript,
      Superscript,
      Highlight,
      FootnoteRef,
      FootnoteSection,
      FootnoteItem,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
}

function toMd(e: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e.storage as any).markdown.getMarkdown();
}

describe("Footnote round-trip", () => {
  it("preserves [^1] refs exactly (doesn't convert to [^1^](#fn-1))", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "Text with a footnote[^1] reference.\n\n[^1]: The note body.\n",
    );
    const md = toMd(editor);
    // The reference must round-trip as `[^1]`, not the superscript-link
    // degradation `[^1^](#fn-1)` we saw in production.
    expect(md).toContain("[^1]");
    expect(md).not.toMatch(/\[\^\d+\^\]\(/);
    editor.destroy();
  });

  it("preserves named footnotes like [^longnote]", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "Another[^longnote] reference.\n\n[^longnote]: Named footnote body.\n",
    );
    const md = toMd(editor);
    expect(md).toContain("[^longnote]");
    expect(md).not.toMatch(/\[\^longnote\^\]\(/);
    editor.destroy();
  });

  it("round-trips the footnote definition body", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "Ref[^1] here.\n\n[^1]: Body with **bold** and `code`.\n",
    );
    const md = toMd(editor);
    expect(md).toContain("[^1]: ");
    expect(md).toContain("**bold**");
    expect(md).toContain("`code`");
    editor.destroy();
  });
});
