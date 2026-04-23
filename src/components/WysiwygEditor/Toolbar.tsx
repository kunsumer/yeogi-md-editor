import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { PromptDialog } from "./PromptDialog";
import { ImageDialog } from "./ImageDialog";
import { InsertCodeDialog } from "./InsertCodeDialog";

interface Props {
  editor: Editor;
}

type Level = 1 | 2 | 3 | 4 | 5 | 6;
type Block = "p" | `h${Level}`;

const BLOCK_OPTIONS: { value: Block; label: string; className: string }[] = [
  { value: "p", label: "Paragraph", className: "hdopt-p" },
  { value: "h1", label: "Heading 1", className: "hdopt-h1" },
  { value: "h2", label: "Heading 2", className: "hdopt-h2" },
  { value: "h3", label: "Heading 3", className: "hdopt-h3" },
  { value: "h4", label: "Heading 4", className: "hdopt-h4" },
  { value: "h5", label: "Heading 5", className: "hdopt-h5" },
  { value: "h6", label: "Heading 6", className: "hdopt-h6" },
];

export function Toolbar({ editor }: Props) {
  const [linkDialog, setLinkDialog] = useState<{ initial: string } | null>(null);
  const [imageDialog, setImageDialog] = useState(false);
  const [codeDialog, setCodeDialog] = useState<"mermaid" | "math" | null>(null);
  const [footnoteDialog, setFootnoteDialog] = useState<{ initial: string } | null>(
    null,
  );
  const [wikiDialog, setWikiDialog] = useState<{ initial: string } | null>(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const headingBtnRef = useRef<HTMLButtonElement | null>(null);
  const headingMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the heading popover on outside click / Escape.
  useEffect(() => {
    if (!headingOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (headingBtnRef.current?.contains(t)) return;
      if (headingMenuRef.current?.contains(t)) return;
      setHeadingOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHeadingOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [headingOpen]);

  // Keyboard shortcuts for actions that need our custom dialogs (Tiptap's
  // defaults for Cmd+B, Cmd+I, Cmd+U, Cmd+E, Cmd+Shift+X, Cmd+Alt+1..6,
  // Cmd+Shift+7/8, Cmd+Alt+C, Cmd+Shift+B, Cmd+Z, Cmd+Shift+Z are inside
  // StarterKit and fire before this). We only handle the ones that drive
  // toolbar UI.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!editor.isFocused) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Cmd+K → link dialog (Tiptap has no default; we need the modal
      // because window.prompt is disabled in WKWebView).
      if (key === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const prev = (editor.getAttributes("link").href as string) ?? "";
        setLinkDialog({ initial: prev });
        return;
      }

      // Cmd+Shift+M → insert Mermaid diagram dialog.
      if (key === "m" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        setCodeDialog("mermaid");
        return;
      }

      // Cmd+Shift+L → insert LaTeX math dialog.
      if (key === "l" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        setCodeDialog("math");
        return;
      }

      // Cmd+Shift+9 → toggle task list (TaskList has no default).
      if (key === "9" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        editor.chain().focus().toggleTaskList().run();
        return;
      }

      // Cmd+Shift+T → insert table (no default; mnemonic "T").
      if (key === "t" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor]);

  const activeLevel = ([1, 2, 3, 4, 5, 6] as Level[]).find((l) =>
    editor.isActive("heading", { level: l }),
  );
  const activeBlock: Block = activeLevel ? (`h${activeLevel}` as Block) : "p";
  const activeOption = BLOCK_OPTIONS.find((o) => o.value === activeBlock) ?? BLOCK_OPTIONS[0];

  function setBlock(value: Block) {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(value[1]) as Level }).run();
    setHeadingOpen(false);
  }

  function openLinkDialog() {
    const prev = (editor.getAttributes("link").href as string) ?? "";
    setLinkDialog({ initial: prev });
  }

  function applyLink(url: string) {
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkDialog(null);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialog(null);
  }

  function applyImage(url: string) {
    if (url) editor.chain().focus().setImage({ src: url }).run();
    setImageDialog(false);
  }

  function nextFootnoteId(): string {
    const taken = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name === "footnoteRef" || node.type.name === "footnoteItem") {
        const id = String(node.attrs.id ?? "").trim();
        if (id) taken.add(id);
      }
    });
    let n = 1;
    while (taken.has(String(n))) n++;
    return String(n);
  }

  function applyFootnote(id: string) {
    const label = id.trim();
    if (!label) {
      setFootnoteDialog(null);
      return;
    }
    // Insert the ref at cursor.
    editor
      .chain()
      .focus()
      .insertContent({
        type: "footnoteRef",
        attrs: { id: label, label },
      })
      .run();
    // Make sure the FootnoteSection carries a stub item for this ref so the
    // user has somewhere to type the body. If a section already exists,
    // append to it; otherwise create one at the end of the doc.
    const { state, view } = editor;
    const schema = state.schema;
    const sectionType = schema.nodes.footnoteSection;
    const itemType = schema.nodes.footnoteItem;
    const paragraphType = schema.nodes.paragraph;
    if (!sectionType || !itemType || !paragraphType) {
      setFootnoteDialog(null);
      return;
    }
    let secPos = -1;
    let secNode: import("@tiptap/pm/model").Node | null = null;
    state.doc.forEach((n, offset) => {
      if (n.type.name === "footnoteSection") {
        secPos = offset;
        secNode = n;
      }
    });
    // Skip if the section already has a matching item — prevents duplicate
    // stubs when the user inserts a footnote with an id that's already
    // defined somewhere in the doc.
    let hasExistingItem = false;
    if (secNode) {
      (secNode as import("@tiptap/pm/model").Node).forEach((child) => {
        if (
          child.type.name === "footnoteItem" &&
          String(child.attrs.id ?? "") === label
        ) {
          hasExistingItem = true;
        }
      });
    }
    if (hasExistingItem) {
      setFootnoteDialog(null);
      return;
    }
    const newItem = itemType.create({ id: label }, paragraphType.create());
    const tr = state.tr;
    if (secPos === -1) {
      tr.insert(state.doc.content.size, sectionType.create({}, newItem));
    } else {
      const section = secNode as unknown as import("@tiptap/pm/model").Node;
      const itemPos = secPos + section.nodeSize - 1;
      tr.insert(itemPos, newItem);
    }
    view.dispatch(tr);
    setFootnoteDialog(null);
  }

  function applyWikiLink(target: string) {
    const t = target.trim();
    if (!t) {
      setWikiDialog(null);
      return;
    }
    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="wikilink" data-wiki-target="${esc(t)}">${esc(t)}</span>`,
      )
      .run();
    setWikiDialog(null);
  }

  function insertTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  const inTable = editor.isActive("table");

  return (
    <>
      <div className="ribbon" role="toolbar" aria-label="Formatting">
        <Group label="Font">
          <Btn
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (⌘B)"
            aria-label="Bold"
          >
            <span style={{ fontWeight: 700 }}>B</span>
          </Btn>
          <Btn
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (⌘I)"
            aria-label="Italic"
          >
            <span style={{ fontStyle: "italic" }}>I</span>
          </Btn>
          <Btn
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (⌘U)"
            aria-label="Underline"
          >
            <span style={{ textDecoration: "underline" }}>U</span>
          </Btn>
          <Btn
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <span style={{ textDecoration: "line-through" }}>S</span>
          </Btn>
          <Btn
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
            aria-label="Inline code"
          >
            <CodeIcon />
          </Btn>
          <Btn
            active={editor.isActive("subscript")}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                toggleSubscript: () => { run: () => void };
              })
                .toggleSubscript()
                .run()
            }
            title="Subscript (⌘,)"
            aria-label="Subscript"
          >
            <span style={{ fontSize: 11 }}>
              X<sub style={{ fontSize: 9 }}>2</sub>
            </span>
          </Btn>
          <Btn
            active={editor.isActive("superscript")}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                toggleSuperscript: () => { run: () => void };
              })
                .toggleSuperscript()
                .run()
            }
            title="Superscript (⌘.)"
            aria-label="Superscript"
          >
            <span style={{ fontSize: 11 }}>
              X<sup style={{ fontSize: 9 }}>2</sup>
            </span>
          </Btn>
          <Btn
            active={editor.isActive("highlight")}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                toggleHighlight: () => { run: () => void };
              })
                .toggleHighlight()
                .run()
            }
            title="Highlight (⇧⌘H)"
            aria-label="Highlight"
          >
            <HighlightIcon />
          </Btn>
        </Group>

        <Sep />

        <Group label="Style">
          <div style={{ position: "relative" }}>
            <button
              ref={headingBtnRef}
              type="button"
              className="ribbon-heading-btn"
              onClick={() => setHeadingOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={headingOpen}
              title="Paragraph style"
            >
              <span className={activeOption.className}>{activeOption.label}</span>
              <CaretIcon />
            </button>
            {headingOpen && (
              <div
                ref={headingMenuRef}
                className="ribbon-heading-menu"
                role="listbox"
                aria-label="Paragraph style"
              >
                {BLOCK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ribbon-heading-item${opt.value === activeBlock ? " is-active" : ""}`}
                    role="option"
                    aria-selected={opt.value === activeBlock}
                    onClick={() => setBlock(opt.value)}
                  >
                    <span className={opt.className}>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Group>

        <Sep />

        <Group label="Paragraph">
          <Btn
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bulleted list"
            aria-label="Bulleted list"
          >
            <BulletIcon />
          </Btn>
          <Btn
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
            aria-label="Numbered list"
          >
            <OrderedIcon />
          </Btn>
          <Btn
            active={editor.isActive("taskList")}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Task list (⇧⌘9)"
            aria-label="Task list"
          >
            <TaskIcon />
          </Btn>
          <Btn
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
            aria-label="Blockquote"
          >
            <QuoteIcon />
          </Btn>
          <Btn
            active={editor.isActive("codeBlock")}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
            aria-label="Code block"
          >
            <BlockCodeIcon />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
            aria-label="Horizontal rule"
          >
            <HrIcon />
          </Btn>
        </Group>

        <Sep />

        <Group label="Align">
          <Btn
            active={editor.isActive({ textAlign: "left" })}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                setTextAlign: (v: string) => { run: () => void };
              })
                .setTextAlign("left")
                .run()
            }
            title="Align left"
            aria-label="Align left"
          >
            <AlignLeftIcon />
          </Btn>
          <Btn
            active={editor.isActive({ textAlign: "center" })}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                setTextAlign: (v: string) => { run: () => void };
              })
                .setTextAlign("center")
                .run()
            }
            title="Align center"
            aria-label="Align center"
          >
            <AlignCenterIcon />
          </Btn>
          <Btn
            active={editor.isActive({ textAlign: "right" })}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                setTextAlign: (v: string) => { run: () => void };
              })
                .setTextAlign("right")
                .run()
            }
            title="Align right"
            aria-label="Align right"
          >
            <AlignRightIcon />
          </Btn>
          <Btn
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() =>
              (editor.chain().focus() as unknown as {
                setTextAlign: (v: string) => { run: () => void };
              })
                .setTextAlign("justify")
                .run()
            }
            title="Justify"
            aria-label="Justify"
          >
            <AlignJustifyIcon />
          </Btn>
        </Group>

        <Sep />

        <Group label="Insert">
          <Btn
            active={editor.isActive("link")}
            onClick={openLinkDialog}
            title="Link (⌘K)"
            aria-label="Link"
          >
            <LinkIcon />
          </Btn>
          <Btn onClick={() => setImageDialog(true)} title="Image" aria-label="Image">
            <ImageIcon />
          </Btn>
          <Btn onClick={insertTable} title="Insert table (⇧⌘T)" aria-label="Insert table">
            <TableIcon />
          </Btn>
          <Btn
            onClick={() => setCodeDialog("mermaid")}
            title="Insert Mermaid diagram (⇧⌘M)"
            aria-label="Insert Mermaid diagram"
          >
            <MermaidIcon />
          </Btn>
          <Btn
            onClick={() => setCodeDialog("math")}
            title="Insert LaTeX math (⇧⌘L)"
            aria-label="Insert LaTeX math"
          >
            <MathIcon />
          </Btn>
          <Btn
            onClick={() => setWikiDialog({ initial: "" })}
            title="Insert wiki-link [[…]]"
            aria-label="Insert wiki-link"
          >
            <WikiIcon />
          </Btn>
          <Btn
            onClick={() => setFootnoteDialog({ initial: nextFootnoteId() })}
            title="Insert footnote [^id]"
            aria-label="Insert footnote"
          >
            <FootnoteIcon />
          </Btn>
        </Group>

        {inTable && (
          <>
            <Sep />
            <Group label="Table">
              <Btn
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                title="Add column before"
                aria-label="Add column before"
              >
                <ColBeforeIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Add column after"
                aria-label="Add column after"
              >
                <ColAfterIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Delete column"
                aria-label="Delete column"
              >
                <ColDeleteIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().addRowBefore().run()}
                title="Add row above"
                aria-label="Add row above"
              >
                <RowBeforeIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Add row below"
                aria-label="Add row below"
              >
                <RowAfterIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="Delete row"
                aria-label="Delete row"
              >
                <RowDeleteIcon />
              </Btn>
              <Btn
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Delete table"
                aria-label="Delete table"
              >
                <TableDeleteIcon />
              </Btn>
            </Group>
            <Sep />
            <Group label="Column alignment">
              {(["left", "center", "right"] as const).map((align) => (
                <Btn
                  key={align}
                  active={editor.isActive("tableCell", { align }) || editor.isActive("tableHeader", { align })}
                  onClick={() =>
                    (
                      editor.chain().focus() as unknown as {
                        setCellAttribute: (
                          n: string,
                          v: string | null,
                        ) => { run: () => void };
                      }
                    )
                      .setCellAttribute("align", align)
                      .run()
                  }
                  title={`Align column ${align} (set on header to align the whole column)`}
                  aria-label={`Align column ${align}`}
                >
                  {align === "left" ? (
                    <AlignLeftIcon />
                  ) : align === "center" ? (
                    <AlignCenterIcon />
                  ) : (
                    <AlignRightIcon />
                  )}
                </Btn>
              ))}
            </Group>
          </>
        )}

        <Sep />

        <Group label="History">
          <Btn
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <UndoIcon />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
          >
            <RedoIcon />
          </Btn>
        </Group>
      </div>

      {linkDialog && (
        <PromptDialog
          title="Link URL"
          placeholder="https://example.com"
          initialValue={linkDialog.initial}
          submitLabel="Apply"
          allowRemove={!!linkDialog.initial}
          onSubmit={applyLink}
          onRemove={removeLink}
          onCancel={() => setLinkDialog(null)}
        />
      )}
      {imageDialog && (
        <ImageDialog
          onInsert={applyImage}
          onCancel={() => setImageDialog(false)}
        />
      )}
      {codeDialog && (
        <InsertCodeDialog
          kind={codeDialog}
          onInsert={(source) => {
            if (codeDialog === "mermaid") {
              editor
                .chain()
                .focus()
                .insertContent({ type: "mermaid", attrs: { source } })
                .run();
            } else {
              editor
                .chain()
                .focus()
                .insertContent({ type: "mathBlock", attrs: { source } })
                .run();
            }
            setCodeDialog(null);
          }}
          onCancel={() => setCodeDialog(null)}
        />
      )}
      {wikiDialog && (
        <PromptDialog
          title="Wiki-link target"
          placeholder="Some Note"
          initialValue={wikiDialog.initial}
          submitLabel="Insert"
          onSubmit={applyWikiLink}
          onCancel={() => setWikiDialog(null)}
        />
      )}
      {footnoteDialog && (
        <PromptDialog
          title="Footnote id"
          placeholder="1"
          initialValue={footnoteDialog.initial}
          submitLabel="Insert"
          onSubmit={applyFootnote}
          onCancel={() => setFootnoteDialog(null)}
        />
      )}
    </>
  );
}

function Group({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="ribbon-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function Sep() {
  return <span className="ribbon-sep" aria-hidden="true" />;
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function Btn({ active, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={`ribbon-btn${active ? " is-active" : ""}${className ? " " + className : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// 16×16 monochrome icons, currentColor. Thin, hairline weight to match
// macOS SF Symbols "regular" / Apple's toolbar icon style.
const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CodeIcon() {
  return (
    <svg {...ICON}>
      <polyline points="5 4 1 8 5 12" />
      <polyline points="11 4 15 8 11 12" />
    </svg>
  );
}
function HighlightIcon() {
  // Upright marker: short bristle strokes on top, rounded-rect body, and a
  // yellow wedge tip below the body. Reads as a highlighter icon at 16×16
  // and the color-coded yellow tip makes the intent unmistakable.
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Three short felt-tip bristle strokes at the cap. */}
      <line x1="6" y1="1.5" x2="6" y2="3" />
      <line x1="8" y1="1.5" x2="8" y2="3" />
      <line x1="10" y1="1.5" x2="10" y2="3" />
      {/* Marker body — rounded rectangle. */}
      <rect x="4.5" y="3" width="7" height="8" rx="1" />
      {/* Yellow triangular tip pointing down. */}
      <path d="M4.5 11 L11.5 11 L8 15 Z" fill="#facc15" />
    </svg>
  );
}
function CaretIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 4 5 7 8 4" />
    </svg>
  );
}
function BulletIcon() {
  return (
    <svg {...ICON}>
      <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
      <line x1="6" y1="4" x2="14" y2="4" />
      <line x1="6" y1="8" x2="14" y2="8" />
      <line x1="6" y1="12" x2="14" y2="12" />
    </svg>
  );
}
function OrderedIcon() {
  return (
    <svg {...ICON}>
      <text x="1" y="6" fontSize="5" fontFamily="system-ui" fill="currentColor" stroke="none">
        1
      </text>
      <text x="1" y="11" fontSize="5" fontFamily="system-ui" fill="currentColor" stroke="none">
        2
      </text>
      <line x1="6" y1="4" x2="14" y2="4" />
      <line x1="6" y1="9" x2="14" y2="9" />
      <line x1="6" y1="14" x2="14" y2="14" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg {...ICON}>
      <rect x="1" y="2" width="5" height="5" rx="1" />
      <polyline points="2 4.5 3 5.5 5 3.5" />
      <rect x="1" y="9" width="5" height="5" rx="1" />
      <line x1="8" y1="4.5" x2="15" y2="4.5" />
      <line x1="8" y1="11.5" x2="15" y2="11.5" />
    </svg>
  );
}
function QuoteIcon() {
  return (
    <svg {...ICON}>
      <line x1="3" y1="3" x2="3" y2="13" strokeWidth="1.6" />
      <line x1="7" y1="5" x2="14" y2="5" />
      <line x1="7" y1="8" x2="14" y2="8" />
      <line x1="7" y1="11" x2="12" y2="11" />
    </svg>
  );
}
function BlockCodeIcon() {
  return (
    <svg {...ICON}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <polyline points="5 6 3 8 5 10" />
      <polyline points="11 6 13 8 11 10" />
    </svg>
  );
}
function HrIcon() {
  return (
    <svg {...ICON}>
      <line x1="2" y1="8" x2="14" y2="8" strokeWidth="1.4" />
    </svg>
  );
}
function AlignLeftIcon() {
  return (
    <svg {...ICON}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="7.5" x2="10" y2="7.5" />
      <line x1="2" y1="11" x2="12" y2="11" />
      <line x1="2" y1="14.5" x2="8" y2="14.5" />
    </svg>
  );
}
function AlignCenterIcon() {
  return (
    <svg {...ICON}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="4" y1="7.5" x2="12" y2="7.5" />
      <line x1="3" y1="11" x2="13" y2="11" />
      <line x1="5" y1="14.5" x2="11" y2="14.5" />
    </svg>
  );
}
function AlignRightIcon() {
  return (
    <svg {...ICON}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="6" y1="7.5" x2="14" y2="7.5" />
      <line x1="4" y1="11" x2="14" y2="11" />
      <line x1="8" y1="14.5" x2="14" y2="14.5" />
    </svg>
  );
}
function AlignJustifyIcon() {
  return (
    <svg {...ICON}>
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="7.5" x2="14" y2="7.5" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <line x1="2" y1="14.5" x2="14" y2="14.5" />
    </svg>
  );
}
function LinkIcon() {
  // Tabler-style chain: two diagonal pill halves linked by a visible middle
  // segment — reads as a chain more clearly than two bracketed arcs.
  return (
    <svg {...ICON}>
      <line x1="6" y1="10" x2="10" y2="6" />
      <path d="M8 4 L9 3 a3 3 0 0 1 4 4 L12 8" />
      <path d="M8 12 L7 13 a3 3 0 0 1 -4 -4 L4 8" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg {...ICON}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <circle cx="5.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <polyline points="2 12 6 8 10 11 14 7" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg {...ICON}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <line x1="1.5" y1="6" x2="14.5" y2="6" />
      <line x1="1.5" y1="10" x2="14.5" y2="10" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" />
      <line x1="10" y1="2.5" x2="10" y2="13.5" />
    </svg>
  );
}
function UndoIcon() {
  // Curved hairpin arrow: arrow tip at top-left, body sweeps right and down.
  return (
    <svg {...ICON}>
      <polyline points="5 3.5 2.5 5.5 5 7.5" />
      <path d="M2.5 5.5 H10 a3.5 3.5 0 0 1 3.5 3.5 V12.5" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg {...ICON}>
      <polyline points="11 3.5 13.5 5.5 11 7.5" />
      <path d="M13.5 5.5 H6 a3.5 3.5 0 0 0 -3.5 3.5 V12.5" />
    </svg>
  );
}
function ColBeforeIcon() {
  return (
    <svg {...ICON}>
      <rect x="7" y="2" width="7" height="12" rx="1" />
      <line x1="2.5" y1="8" x2="4.5" y2="8" strokeWidth="1.4" />
      <line x1="3.5" y1="6.5" x2="3.5" y2="9.5" strokeWidth="1.4" />
    </svg>
  );
}
function ColAfterIcon() {
  return (
    <svg {...ICON}>
      <rect x="2" y="2" width="7" height="12" rx="1" />
      <line x1="11.5" y1="8" x2="13.5" y2="8" strokeWidth="1.4" />
      <line x1="12.5" y1="6.5" x2="12.5" y2="9.5" strokeWidth="1.4" />
    </svg>
  );
}
function ColDeleteIcon() {
  return (
    <svg {...ICON}>
      <rect x="5" y="2" width="6" height="12" rx="1" />
      <line x1="6" y1="6" x2="10" y2="10" strokeWidth="1.4" stroke="currentColor" />
      <line x1="10" y1="6" x2="6" y2="10" strokeWidth="1.4" stroke="currentColor" />
    </svg>
  );
}
function RowBeforeIcon() {
  return (
    <svg {...ICON}>
      <rect x="2" y="7" width="12" height="7" rx="1" />
      <line x1="8" y1="2.5" x2="8" y2="4.5" strokeWidth="1.4" />
      <line x1="6.5" y1="3.5" x2="9.5" y2="3.5" strokeWidth="1.4" />
    </svg>
  );
}
function RowAfterIcon() {
  return (
    <svg {...ICON}>
      <rect x="2" y="2" width="12" height="7" rx="1" />
      <line x1="8" y1="11.5" x2="8" y2="13.5" strokeWidth="1.4" />
      <line x1="6.5" y1="12.5" x2="9.5" y2="12.5" strokeWidth="1.4" />
    </svg>
  );
}
function RowDeleteIcon() {
  return (
    <svg {...ICON}>
      <rect x="2" y="5" width="12" height="6" rx="1" />
      <line x1="6" y1="6" x2="10" y2="10" strokeWidth="1.4" />
      <line x1="10" y1="6" x2="6" y2="10" strokeWidth="1.4" />
    </svg>
  );
}
function TableDeleteIcon() {
  return (
    <svg {...ICON}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <line x1="4" y1="5" x2="12" y2="13" strokeWidth="1.4" />
      <line x1="12" y1="5" x2="4" y2="13" strokeWidth="1.4" />
    </svg>
  );
}
function MermaidIcon() {
  return (
    <svg {...ICON}>
      <rect x="6" y="1.5" width="4" height="3" rx="0.5" />
      <rect x="1.5" y="10.5" width="4" height="3" rx="0.5" />
      <rect x="10.5" y="10.5" width="4" height="3" rx="0.5" />
      <line x1="8" y1="4.5" x2="3.5" y2="10.5" />
      <line x1="8" y1="4.5" x2="12.5" y2="10.5" />
    </svg>
  );
}
function WikiIcon() {
  // Double-bracket glyph reading as the Obsidian/Logseq `[[ ]]` wiki-link
  // syntax. Four distinct brackets — the previous version packed the two
  // halves too tightly and the horizontal caps vanished, reading as `||`.
  return (
    <svg {...ICON}>
      {/* [[ — outer then inner */}
      <path d="M4 3 H2 V13 H4" />
      <path d="M7 3 H5 V13 H7" />
      {/* ]] — inner then outer */}
      <path d="M9 3 H11 V13 H9" />
      <path d="M12 3 H14 V13 H12" />
    </svg>
  );
}
function FootnoteIcon() {
  // Six-pointed asterisk — traditional footnote marker. Sized to sit in the
  // same ~10 px optical box as the rest of the ribbon icons, and picks up
  // the shared ICON preset so strokeWidth matches.
  return (
    <svg {...ICON}>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3.67" y1="5.5" x2="12.33" y2="10.5" />
      <line x1="12.33" y1="5.5" x2="3.67" y2="10.5" />
    </svg>
  );
}
function MathIcon() {
  // Word's Equation icon is a serif "π". Sized to match the visual weight
  // of the surrounding icons — any smaller and it floats above the row.
  return (
    <svg {...ICON}>
      <text
        x="8"
        y="13.5"
        textAnchor="middle"
        fontFamily='"Times New Roman", "Cambria Math", Georgia, serif'
        fontSize="16"
        fontWeight="500"
        fontStyle="italic"
        fill="currentColor"
        stroke="none"
      >
        π
      </text>
    </svg>
  );
}
