import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ResizableImage } from "./nodes/ResizableImage";
import { TableKit } from "@tiptap/extension-table";
import BaseTaskList from "@tiptap/extension-task-list";
import BaseTaskItem from "@tiptap/extension-task-item";
// tiptap-markdown can't auto-detect GFM `- [x]` syntax — its built-in
// TaskList storage isn't picked up because our TaskList extension instances
// don't carry the blueprint metadata it expects. Wire the markdown-it
// plugin + DOM post-processor ourselves.
import taskListPlugin from "markdown-it-task-lists";

type MDParseCtx = { use: (plugin: unknown) => unknown };

const taskListInstalled = new WeakSet<object>();

const TaskList = BaseTaskList.extend({
  addStorage() {
    const parent = (this.parent?.() as Record<string, unknown> | undefined) ?? {};
    return {
      ...parent,
      markdown: {
        serialize(
          state: { renderList: (n: unknown, indent: string, marker: () => string) => void },
          node: unknown,
        ) {
          state.renderList(node, "  ", () => "- ");
        },
        parse: {
          setup(md: MDParseCtx) {
            if (taskListInstalled.has(md)) return;
            taskListInstalled.add(md);
            md.use(taskListPlugin);
          },
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("ul.contains-task-list").forEach((ul) => {
              ul.setAttribute("data-type", "taskList");
            });
          },
        },
      },
    };
  },
});

const TaskItem = BaseTaskItem.extend({
  addStorage() {
    const parent = (this.parent?.() as Record<string, unknown> | undefined) ?? {};
    return {
      ...parent,
      markdown: {
        serialize(
          state: {
            write: (s: string) => void;
            renderContent: (node: unknown) => void;
          },
          node: { attrs: { checked: boolean } },
        ) {
          state.write(node.attrs.checked ? "[x] " : "[ ] ");
          state.renderContent(node);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            element.querySelectorAll("li.task-list-item").forEach((li) => {
              const input = li.querySelector("input");
              li.setAttribute("data-type", "taskItem");
              if (input) {
                li.setAttribute("data-checked", String(input.checked));
                input.remove();
              }
            });
          },
        },
      },
    };
  },
});
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { openUrl } from "@tauri-apps/plugin-opener";
import { slugify } from "../../lib/slug";
import { Toolbar } from "./Toolbar";
import { WysiwygSearchBar } from "./WysiwygSearchBar";
import { MathBlock, MathInline } from "./nodes/MathNodes";
import { Mermaid } from "./nodes/Mermaid";
import { Frontmatter } from "./nodes/Frontmatter";
import { Details, Summary } from "./nodes/Details";
import { FootnoteRef, FootnoteSection, FootnoteItem } from "./nodes/Footnote";
import { CodeBlockView } from "./nodes/CodeBlockView";
import { FocusCell } from "./nodes/FocusCell";
import { SearchHighlight } from "./nodes/SearchHighlight";
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
  searchOpen?: boolean;
  searchReplace?: boolean;
  onSearchClose?: () => void;
}

export function WysiwygEditor({
  content,
  onChange,
  readOnly = false,
  searchOpen = false,
  searchReplace = false,
  onSearchClose,
}: Props) {
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
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        // Corner handles give a "proper image resize" affordance like
        // Pages/Word; aspect ratio is locked so users can't accidentally
        // squash the image. Min 40px keeps it grabbable.
        resize: {
          enabled: true,
          directions: ["bottom-right", "bottom-left"],
          minWidth: 40,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      TableKit.configure({ table: { resizable: true, handleWidth: 5 } }),
      FocusCell,
      SearchHighlight,
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
  // browser, in-document `#anchor` links scroll to the matching heading.
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
        return;
      }
      if (href.startsWith("#") && root) {
        // Slug-match the fragment against each heading's text. This sidesteps
        // having to inject id= attributes onto the heading nodes, and matches
        // the GitHub-style `[text](#heading-text)` convention users type in
        // markdown.
        e.preventDefault();
        const target = href.slice(1);
        if (!target) return;
        const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
        for (const h of Array.from(headings)) {
          if (slugify((h as HTMLElement).textContent ?? "") === target) {
            (h as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
            break;
          }
        }
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [editor]);

  return (
    <div className="wysiwyg-shell">
      {editor && !readOnly && <Toolbar editor={editor} />}
      {editor && searchOpen && onSearchClose && (
        <WysiwygSearchBar
          editor={editor}
          withReplace={searchReplace}
          onClose={onSearchClose}
        />
      )}
      <div className="wysiwyg-scroll">
        <EditorContent editor={editor} className="wysiwyg-content preview-content" />
      </div>
    </div>
  );
}
