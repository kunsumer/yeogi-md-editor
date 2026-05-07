import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Details, Summary } from "./Details";

// Mirror the minimum WYSIWYG extension set needed to exercise Details parse +
// serialize. markdown-it (via tiptap-markdown) handles the parse side when
// `html: true` is set; Details' own storage.markdown handles the serialize.
function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit,
      Details,
      Summary,
      Markdown.configure({ html: true, tightLists: true }),
    ],
    content: "",
  });
}

function toMarkdown(editor: Editor): string {
  // tiptap-markdown attaches getMarkdown() to the Markdown storage slot;
  // the storage typing in v0.9 predates Tiptap v3's stricter index signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor.storage as any).markdown.getMarkdown();
}

describe("Details/Summary markdown round-trip", () => {
  const sample = `<details>
<summary>Click to expand</summary>

Hidden content with **Markdown** still rendered.

\`\`\`js
console.log("surprise!");
\`\`\`

</details>`;

  it("preserves the <details> wrapper, summary text, and inner markdown", () => {
    const editor = makeEditor();
    editor.commands.setContent(sample);
    const md = toMarkdown(editor);

    expect(md).toContain("<details>");
    expect(md).toContain("<summary>Click to expand</summary>");
    expect(md).toContain("Hidden content with **Markdown** still rendered.");
    expect(md).toContain("```js");
    expect(md).toContain('console.log("surprise!");');
    expect(md).toContain("</details>");

    editor.destroy();
  });

  it("is idempotent across a second round-trip", () => {
    const e1 = makeEditor();
    e1.commands.setContent(sample);
    const once = toMarkdown(e1);
    e1.destroy();

    const e2 = makeEditor();
    e2.commands.setContent(once);
    const twice = toMarkdown(e2);
    e2.destroy();

    expect(twice).toBe(once);
  });

  it("preserves the `open` attribute on round-trip", () => {
    const editor = makeEditor();
    editor.commands.setContent(`<details open>
<summary>Already open</summary>

Body.

</details>`);
    const md = toMarkdown(editor);
    expect(md).toContain("<details open>");
    editor.destroy();
  });
});
