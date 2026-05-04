import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Subscript, Superscript, Highlight } from "./SubSup";
import { MathBlock, MathInline } from "./MathNodes";
import { Frontmatter } from "./Frontmatter";
import { Details, Summary } from "./Details";
import { FootnoteRef, FootnoteSection, FootnoteItem } from "./Footnote";

describe("SubSup extensions via tiptap-markdown", () => {
  // Mirror the actual WysiwygEditor extension set (minus the NodeViews that
  // need DOM rendering — those don't participate in parse). Confirms that
  // nothing else in the markdown-it plugin chain disturbs `~x~` → <sub>.
  it("parses ~sub~, ^sup^, ==mark== alongside the full WYSIWYG extension set", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        Subscript,
        Superscript,
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        Frontmatter,
        MathBlock,
        MathInline,
        Details,
        Summary,
        FootnoteRef,
        FootnoteSection,
        FootnoteItem,
        Markdown.configure({ html: true, tightLists: true }),
      ],
      content: "",
    });

    editor.commands.setContent(
      "Subscript: H~2~O\n\nSuperscript: E = mc^2^\n\n==highlighted==",
    );
    const html = editor.getHTML();

    // eslint-disable-next-line no-console
    console.log("[SubSup test] HTML:", html);

    expect(html).toContain("<sub>2</sub>");
    expect(html).toContain("<sup>2</sup>");
    expect(html.toLowerCase()).toContain("<mark>highlighted</mark>");

    editor.destroy();
  });
});
