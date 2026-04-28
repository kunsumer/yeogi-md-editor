import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import {
  DefinitionList,
  DefinitionTerm,
  DefinitionDescription,
} from "./DefinitionList";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      DefinitionList,
      DefinitionTerm,
      DefinitionDescription,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
}

function toMd(e: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e.storage as any).markdown.getMarkdown();
}

describe("DefinitionList round-trip", () => {
  it("preserves a single term + description", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "Markdown\n: A lightweight markup language with plain-text formatting syntax.\n",
    );
    const md = toMd(editor);
    expect(md).toContain("Markdown");
    expect(md).toMatch(/:\s+A lightweight markup language/);
    // Source must NOT have collapsed to inline `Markdown : ...` form
    // (single line with " : " in the middle). Use horizontal-whitespace
    // class to keep the test honest — newline is the whole point.
    expect(md).not.toMatch(/^Markdown[ \t]*:[ \t]+A lightweight/m);
    editor.destroy();
  });

  it("preserves multiple groupings with blank-line boundary", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "Markdown\n: A lightweight markup language.\n\nLaTeX\n: A typesetting system.\n",
    );
    const md = toMd(editor);
    // Both terms present.
    expect(md).toContain("Markdown");
    expect(md).toContain("LaTeX");
    // Both descriptions in source form.
    expect(md).toMatch(/:\s+A lightweight markup language/);
    expect(md).toMatch(/:\s+A typesetting system/);
    editor.destroy();
  });

  it("is idempotent across a second round-trip", () => {
    const sample = "Term one\n: First defn.\n\nTerm two\n: Second defn.\n";
    const e1 = makeEditor();
    e1.commands.setContent(sample);
    const once = toMd(e1);
    e1.destroy();

    const e2 = makeEditor();
    e2.commands.setContent(once);
    const twice = toMd(e2);
    e2.destroy();

    expect(twice).toBe(once);
  });

  it("keeps inline marks (bold/italic/code) inside terms and descriptions", () => {
    const editor = makeEditor();
    editor.commands.setContent(
      "**Bold** term\n: Description with *italic* and `code`.\n",
    );
    const md = toMd(editor);
    expect(md).toContain("**Bold**");
    expect(md).toContain("*italic*");
    expect(md).toContain("`code`");
    editor.destroy();
  });
});
