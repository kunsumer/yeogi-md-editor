import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Toolbar } from "./Toolbar";
import { MathBlock, MathInline } from "./nodes/MathNodes";
import { Mermaid } from "./nodes/Mermaid";
import { Frontmatter } from "./nodes/Frontmatter";
import { Details, Summary } from "./nodes/Details";
import { FootnoteRef, FootnoteSection, FootnoteItem } from "./nodes/Footnote";
import { CodeBlockView } from "./nodes/CodeBlockView";
import { FocusCell } from "./nodes/FocusCell";
import "./wysiwyg.css";
import "../PreviewPane/preview-content.css";

// One lowlight instance covers the whole app — syntax grammars are loaded
// lazily by the `common` bundle (~30 popular languages).
const lowlight = createLowlight(common);

// Override CodeBlockLowlight to render with our Copy-button NodeView while
// keeping its markdown-it parse/serialize hooks intact.
const CodeBlockWithCopy = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
});

// tiptap-markdown declares its storage slot at runtime. The types in the
// package predate Tiptap v3's stricter Storage index signature, so reach
// for it through an unsafe cast at this single point.
function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as Record<
    string,
    { getMarkdown: () => string } | undefined
  >;
  return storage.markdown?.getMarkdown() ?? "";
}

interface Props {
  content: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
}

export function WysiwygEditor({ content, onChange, readOnly = false }: Props) {
  // Track the last markdown we emitted so external prop changes that simply
  // echo our own edit don't trigger a second setContent (which would reset
  // the cursor mid-typing).
  const lastEmittedRef = useRef<string>(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable StarterKit's plain CodeBlock — we swap in the Lowlight-backed
        // variant below for syntax highlighting.
        codeBlock: false,
      }),
      CodeBlockWithCopy.configure({
        lowlight,
        HTMLAttributes: { spellcheck: "false" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TableKit.configure({ table: { resizable: true, handleWidth: 5 } }),
      FocusCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Frontmatter,
      MathBlock,
      MathInline,
      Mermaid,
      Details,
      Summary,
      FootnoteRef,
      FootnoteSection,
      FootnoteItem,
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    editable: !readOnly,
    content,
    onUpdate({ editor }) {
      const md = getMarkdown(editor);
      lastEmittedRef.current = md;
      onChange(md);
    },
  });

  // Sync external content changes (e.g. tab switch, external reload) without
  // clobbering the user's cursor when the change came from ourselves.
  useEffect(() => {
    if (!editor) return;
    if (content === lastEmittedRef.current) return;
    // Parse the incoming markdown; `emitUpdate: false` prevents an onUpdate
    // feedback loop from the programmatic set.
    editor.commands.setContent(content, { emitUpdate: false });
    lastEmittedRef.current = content;
  }, [content, editor]);

  // Mirror PreviewPane: external web/mailto links open in the default
  // browser instead of navigating the webview.
  useEffect(() => {
    const root = editor?.view.dom;
    if (!root) return;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (/^(https?:|mailto:)/.test(href)) {
        // Cmd/Ctrl+Click lets Tiptap's built-in link handler edit the URL;
        // plain clicks open externally.
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        openUrl(href).catch((err) => console.warn("openUrl failed:", href, err));
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editor]);

  return (
    <div className="wysiwyg-shell">
      {editor && !readOnly && <Toolbar editor={editor} />}
      <div className="wysiwyg-scroll">
        <EditorContent editor={editor} className="wysiwyg-content preview-content" />
      </div>
    </div>
  );
}
