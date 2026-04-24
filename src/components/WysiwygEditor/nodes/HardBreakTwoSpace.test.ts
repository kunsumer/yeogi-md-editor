import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { HardBreakTwoSpace } from "./HardBreakTwoSpace";

function makeEditor() {
  return new Editor({
    extensions: [
      StarterKit.configure({ hardBreak: false }),
      HardBreakTwoSpace,
      Markdown.configure({ html: true, tightLists: true, breaks: false }),
    ],
    content: "",
  });
}

function toMd(e: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (e.storage as any).markdown.getMarkdown();
}

describe("HardBreakTwoSpace serializer", () => {
  it("emits two trailing spaces for hard breaks (not backslash)", () => {
    const editor = makeEditor();
    // Source uses two-trailing-spaces hard break form.
    editor.commands.setContent("Line one  \nLine two\n");
    const md = toMd(editor);
    // Output should contain "  \n" hard break, not "\\\n".
    expect(md).toContain("Line one  \nLine two");
    expect(md).not.toContain("Line one\\\n");
    editor.destroy();
  });

  it("normalizes backslash hard breaks to two-space form on round-trip", () => {
    const editor = makeEditor();
    // Source uses backslash hard break form.
    editor.commands.setContent("First\\\nSecond\n");
    const md = toMd(editor);
    // Acceptable normalization: backslash form gets canonicalized.
    expect(md).toMatch(/First\s{2}\nSecond/);
    editor.destroy();
  });

  it("does not emit a stray hard break at end of paragraph", () => {
    // Edge case mirrored from prosemirror-markdown: trailing hard breaks
    // before the close of a block produce a useless line; the upstream
    // serializer skips them, and so should ours.
    const editor = makeEditor();
    editor.commands.setContent("Just a line.\n");
    const md = toMd(editor);
    // Last char should be just a newline, no trailing two-space sequence.
    expect(md).not.toMatch(/  \n+$/);
    editor.destroy();
  });
});
