import { useEffect, useState } from "react";
import { Logo } from "../Logo";
import { APP_VERSION_LABEL } from "../../version";
import "./Tutorial.css";

interface Props {
  onClose: () => void;
}

interface Step {
  title: string;
  body: React.ReactNode;
  illustration?: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Yeogi .MD Editor",
    illustration: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Logo size={72} />
        <span
          style={{
            fontSize: 11,
            letterSpacing: 0.4,
            color: "var(--text-faint)",
            textTransform: "uppercase",
          }}
        >
          {APP_VERSION_LABEL}
        </span>
      </div>
    ),
    body: (
      <p>
        A Markdown editor that lets you <strong>edit the rendered document directly</strong>
        {" "}— no more bouncing between a source pane and a preview. We opened{" "}
        <kbd>Welcome.md</kbd> so you can follow along. This quick tour covers the rest.
      </p>
    ),
  },
  {
    title: "WYSIWYG: edit the rendered view",
    illustration: (
      <div className="tutorial-ribbon">
        <span className="trb-btn"><b>B</b></span>
        <span className="trb-btn"><i>I</i></span>
        <span className="trb-btn"><u>U</u></span>
        <span className="trb-sep" />
        <span className="trb-pill">Heading 2 ▾</span>
        <span className="trb-sep" />
        <span className="trb-btn">🔗</span>
        <span className="trb-btn">🖼</span>
        <span className="trb-btn">⊞</span>
      </div>
    ),
    body: (
      <>
        <p>
          The <strong>WYSIWYG</strong> mode (the default) gives you a Word-style ribbon
          and lets you type into the rendered document itself. Bold, italics, headings,
          lists, tables, callouts — style-as-you-type, and every change round-trips
          cleanly back to Markdown on disk.
        </p>
        <p style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13 }}>
          Flip to raw Markdown any time from the <strong>WYSIWYG / Edit</strong> toggle
          in the top bar — your scroll position carries across.
        </p>
      </>
    ),
  },
  {
    title: "Rich content renders inline",
    illustration: (
      <div className="tutorial-chips">
        <span>📐 LaTeX math</span>
        <span>🧩 Mermaid</span>
        <span>✅ Task lists</span>
        <span>📋 Tables</span>
        <span>💬 Callouts</span>
        <span>{"</>"} Highlighted code</span>
        <span>📎 Footnotes</span>
        <span>▾ Collapsibles</span>
      </div>
    ),
    body: (
      <p>
        Math fences render through KaTeX, <kbd>```mermaid</kbd> blocks render through
        Mermaid, code fences get syntax highlighting, task lists have real checkboxes,
        footnotes collect at the bottom. All of them are editable in place — not
        read-only previews.
      </p>
    ),
  },
  {
    title: "Insert images — upload or URL",
    body: (
      <>
        <p>
          Click the image button in the ribbon (or press <kbd>⌘K</kbd> after typing{" "}
          <kbd>![]</kbd>) to open the Insert image dialog. Paste a URL, or click{" "}
          <strong>Choose file from your computer…</strong> to pick a local image — it's
          embedded in the Markdown as a data URL, so the document stays self-contained.
        </p>
        <p style={{ marginTop: 10 }}>
          Drag the corner handles on any image to resize it — aspect ratio is locked by
          default (hold <kbd>⇧</kbd> to override). Mermaid diagrams are resizable too:
          drag the bottom-right corner to give crammed Gantt charts more room.
        </p>
      </>
    ),
  },
  {
    title: "Diagrams & math with templates",
    illustration: (
      <div className="tutorial-ribbon">
        <span className="trb-pill">Symbols ▾</span>
        <span className="trb-pill">Templates ▾</span>
      </div>
    ),
    body: (
      <p>
        The Insert Mermaid (<kbd>⇧⌘M</kbd>) and Insert LaTeX (<kbd>⇧⌘L</kbd>) dialogs
        give you a live side-by-side preview. Click <strong>Templates ▾</strong> for
        a dozen starters (flowchart, Gantt, Gaussian integral, piecewise function, …),
        or <strong>Symbols ▾</strong> in the LaTeX dialog for a categorized palette
        of Greek letters, operators, relations, arrows, sets, and structures — every
        click inserts at your cursor.
      </p>
    ),
  },
  {
    title: "Cross-links, wiki-links, and footnotes",
    body: (
      <>
        <p>
          Besides standard <kbd>[text](url)</kbd> links, Yeogi understands two
          extras you can just type in place:
        </p>
        <ul>
          <li>
            <strong>Wiki-links.</strong> Type <kbd>[[Some Note]]</kbd> — clicking it
            opens the matching <kbd>.md</kbd> file anywhere inside the folder in
            the left sidebar. If no folder is open, the link renders but is
            inert.
          </li>
          <li>
            <strong>Footnotes.</strong> Drop a reference inline with{" "}
            <kbd>[^1]</kbd>, then define the body anywhere later in the file
            with <kbd>[^1]: the footnote text</kbd>. All definitions collect at
            the bottom of the rendered document.
          </li>
        </ul>
        <p style={{ marginTop: 10, color: "var(--text-muted)", fontSize: 13 }}>
          Use <kbd>File → Open Folder…</kbd> first so wiki-links have a vault
          to resolve against.
        </p>
      </>
    ),
  },
  {
    title: "Find, replace, and jump around",
    body: (
      <ul>
        <li>
          <kbd>⌘F</kbd> opens an in-editor <strong>Find</strong> bar in both WYSIWYG
          and raw modes — matches highlight without moving your cursor, and{" "}
          <kbd>Enter</kbd> cycles.
        </li>
        <li>
          <kbd>⌥⌘F</kbd> opens <strong>Find and Replace</strong>.
        </li>
        <li>
          The sidebar shows a live <strong>Table of Contents</strong>. Clicking a
          heading jumps there in your current mode (no forced switch).
        </li>
        <li>
          <strong>Anchor links</strong> in your document (e.g. <kbd>[top](#overview)</kbd>)
          scroll to the matching heading — handy for a manual TOC at the top of a long
          note.
        </li>
      </ul>
    ),
  },
  {
    title: "Autosave, per document",
    illustration: (
      <div className="tutorial-autosave-demo">
        <span>Autosave</span>
        <span className="tutorial-switch on">
          <span className="tutorial-switch-thumb" />
        </span>
      </div>
    ),
    body: (
      <p>
        The <strong>Autosave</strong> switch in the top bar toggles saving for the active
        document. When it's on, edits land on disk about half a second after you stop
        typing — or sooner during a long streak of typing (up to every two seconds).
        No saves fire when the buffer is clean. If an external change hits a clean file,
        the editor silently reloads; if you had unsaved edits, a banner lets you Keep or
        Reload.
      </p>
    ),
  },
  {
    title: "Open files and switch between tabs",
    illustration: (
      <div className="tutorial-tab-strip">
        <span className="tutorial-tab active">Welcome.md</span>
        <span className="tutorial-tab">notes.md</span>
        <span className="tutorial-plus">+</span>
      </div>
    ),
    body: (
      <ul>
        <li>
          <strong>File → Open…</strong> (<kbd>⌘O</kbd>) picks one or more Markdown files.
        </li>
        <li>
          <strong>File → Open Folder…</strong> (<kbd>⌥⌘O</kbd>) browses a directory tree
          in the sidebar.
        </li>
        <li>
          Or click the <kbd>+</kbd> at the end of the tab strip for a new document.
        </li>
        <li>
          <kbd>⌘W</kbd> closes the active tab. Your open tabs restore when you relaunch.
        </li>
      </ul>
    ),
  },
  {
    title: "Keyboard shortcuts",
    body: (
      <div className="tutorial-shortcuts">
        <kbd>⌘B</kbd><span>Bold</span>
        <kbd>⌘I</kbd><span>Italic</span>
        <kbd>⌘U</kbd><span>Underline</span>
        <kbd>⇧⌘X</kbd><span>Strikethrough</span>
        <kbd>⌘E</kbd><span>Inline code</span>
        <kbd>⌘,</kbd><span>Subscript</span>
        <kbd>⌘.</kbd><span>Superscript</span>
        <kbd>⇧⌘H</kbd><span>Highlight</span>
        <kbd>⌥⌘1…6</kbd><span>Heading 1 through 6</span>
        <kbd>⌥⌘0</kbd><span>Paragraph</span>
        <kbd>⇧⌘7</kbd><span>Numbered list</span>
        <kbd>⇧⌘8</kbd><span>Bulleted list</span>
        <kbd>⇧⌘9</kbd><span>Task list</span>
        <kbd>⇧⌘B</kbd><span>Blockquote</span>
        <kbd>⌥⌘C</kbd><span>Code block</span>
        <kbd>⌘K</kbd><span>Insert / edit link</span>
        <kbd>⇧⌘T</kbd><span>Insert table</span>
        <kbd>⇧⌘M</kbd><span>Insert Mermaid diagram</span>
        <kbd>⇧⌘L</kbd><span>Insert LaTeX math</span>
        <kbd>⌘F</kbd><span>Find</span>
        <kbd>⌥⌘F</kbd><span>Find and replace</span>
        <kbd>⌘O</kbd><span>Open files</span>
        <kbd>⌥⌘O</kbd><span>Open folder</span>
        <kbd>⌘W</kbd><span>Close tab</span>
        <kbd>⌥⌘1</kbd><span>Folder Explorer</span>
        <kbd>⌥⌘2</kbd><span>Outline</span>
        <kbd>⌘\</kbd><span>Hide both sidebars</span>
        <kbd>⌘=</kbd><span>Zoom in / out / reset (⌘− ⌘0)</span>
        <kbd>⌘Z</kbd><span>Undo / Redo (⇧⌘Z)</span>
      </div>
    ),
  },
  {
    title: "Make Yeogi .MD Editor the default for .md files",
    body: (
      <>
        <p>
          macOS requires a one-time consent to set a new default handler. It's two clicks
          in Finder:
        </p>
        <ol className="tutorial-steps-num">
          <li>
            In Finder, right-click any <kbd>.md</kbd> file and choose <strong>Get Info</strong>{" "}
            (or select it and press <kbd>⌘I</kbd>).
          </li>
          <li>
            In the <strong>Open with:</strong> section, pick{" "}
            <strong>Yeogi .MD Editor</strong> from the dropdown.
          </li>
          <li>
            Click <strong>Change All…</strong> and confirm <strong>Continue</strong> to
            apply it to every Markdown file on your Mac.
          </li>
        </ol>
        <p style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 13 }}>
          Double-clicking a <kbd>.md</kbd> file will then open it in this app as a new
          tab.
        </p>
      </>
    ),
  },
  {
    title: "You're set",
    illustration: <Logo size={48} />,
    body: (
      <p>
        Open <kbd>Welcome.md</kbd> and click around — every renderer is demoed inline.
        Reopen this tour any time from <strong>Help → Show Tutorial</strong>.
      </p>
    ),
  },
];

export function Tutorial({ onClose }: Props) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isLast) setI((n) => n + 1);
      if (e.key === "ArrowLeft" && i > 0) setI((n) => n - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, isLast, onClose]);

  return (
    <div
      className="tutorial-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started tour"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tutorial-card">
        <div className="tutorial-head">
          <span>
            Step {i + 1} of {STEPS.length}
          </span>
          <span className="tutorial-dots" aria-hidden="true">
            {STEPS.map((_, k) => (
              <span key={k} className={`tutorial-dot${k === i ? " active" : ""}`} />
            ))}
          </span>
        </div>
        <div className="tutorial-body">
          <h2>{step.title}</h2>
          {step.illustration && <div className="tutorial-illo">{step.illustration}</div>}
          {step.body}
        </div>
        <div className="tutorial-actions">
          <button className="btn-ghost" onClick={onClose}>
            {isLast ? "Close" : "Skip tour"}
          </button>
          <div className="spacer" />
          {i > 0 && (
            <button className="btn-ghost" onClick={() => setI((n) => n - 1)}>
              Back
            </button>
          )}
          <button
            className="btn-primary"
            onClick={isLast ? onClose : () => setI((n) => n + 1)}
          >
            {isLast ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
