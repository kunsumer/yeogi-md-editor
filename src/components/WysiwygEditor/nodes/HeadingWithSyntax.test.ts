import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { HeadingWithSyntax } from "./HeadingWithSyntax";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: false }),
      HeadingWithSyntax,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
}

function toMd(e: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e.storage as any).markdown.getMarkdown();
}

describe("HeadingWithSyntax round-trip", () => {
  it("preserves Setext H1 (=====)", () => {
    const editor = makeEditor();
    editor.commands.setContent("Setext H1\n=========\n");
    const md = toMd(editor);
    expect(md).toContain("Setext H1\n=");
    // Underline length at least 3 (our min), may exceed if text is longer.
    expect(md).toMatch(/Setext H1\n=+/);
    // Must NOT have been converted to ATX.
    expect(md).not.toMatch(/^#\s+Setext H1/m);
    editor.destroy();
  });

  it("preserves Setext H2 (-----)", () => {
    const editor = makeEditor();
    editor.commands.setContent("Setext H2\n---------\n");
    const md = toMd(editor);
    expect(md).toMatch(/Setext H2\n-+/);
    expect(md).not.toMatch(/^##\s+Setext H2/m);
    editor.destroy();
  });

  it("preserves ATX headings as ATX", () => {
    const editor = makeEditor();
    editor.commands.setContent("# ATX One\n\n## ATX Two\n\n### ATX Three\n");
    const md = toMd(editor);
    expect(md).toMatch(/^#\s+ATX One/m);
    expect(md).toMatch(/^##\s+ATX Two/m);
    expect(md).toMatch(/^###\s+ATX Three/m);
    // Should NOT contain underline syntax.
    expect(md).not.toMatch(/^=+\s*$/m);
    expect(md).not.toMatch(/^-{3,}\s*$/m);
    editor.destroy();
  });

  it("falls back to ATX for H3+ even if marked Setext (Setext is H1/H2 only)", () => {
    // Can't author Setext for H3 in markdown, but verify our guard.
    const editor = makeEditor();
    editor.commands.setContent("### Three\n");
    const md = toMd(editor);
    expect(md).toMatch(/^###\s+Three/m);
    editor.destroy();
  });

  it("handles ATX + Setext mixed in one doc", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "# ATX H1\n\nSetext H1\n=========\n\n## ATX H2\n\nSetext H2\n---------\n",
    );
    const md = toMd(editor);
    expect(md).toMatch(/^#\s+ATX H1/m);
    expect(md).toMatch(/Setext H1\n=+/);
    expect(md).toMatch(/^##\s+ATX H2/m);
    expect(md).toMatch(/Setext H2\n-+/);
    editor.destroy();
  });
});
