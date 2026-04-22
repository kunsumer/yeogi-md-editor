import { useEffect, useState } from "react";
import { Logo } from "../Logo";
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
    title: "Welcome to Evhan .MD Editor",
    illustration: <Logo size={72} />,
    body: (
      <p>
        A clean, fast Markdown editor for macOS. We opened <kbd>Welcome.md</kbd> for you —
        it's a tour of everything the editor can render. This quick walkthrough covers
        the rest.
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
          <strong>File → Open…</strong> (<kbd>⌘O</kbd>) to pick one or more Markdown files.
        </li>
        <li>
          <strong>File → Open Folder…</strong> (<kbd>⌥⌘O</kbd>) to browse a directory tree
          in the sidebar.
        </li>
        <li>
          Or click the <kbd>+</kbd> at the end of the tab strip — same as <kbd>⌘O</kbd>.
        </li>
        <li>
          <kbd>⌘W</kbd> closes the active tab. Your open tabs restore when you relaunch
          the app.
        </li>
      </ul>
    ),
  },
  {
    title: "Edit or Preview — same file, two views",
    illustration: (
      <div className="tutorial-segmented">
        <span>Edit</span>
        <span className="active">Preview</span>
      </div>
    ),
    body: (
      <p>
        The toggle in the top bar flips the main pane between raw Markdown (CodeMirror
        with syntax highlighting) and a rich "Preview" that you can edit directly —
        Word-style ribbon on top, rendered typography below. Changes round-trip back
        to Markdown, so Autosave keeps working either way.
      </p>
    ),
  },
  {
    title: "Jump by heading",
    body: (
      <p>
        The left sidebar shows a live Table of Contents of the active document — every
        heading, indented by level. Click any entry to jump the editor cursor to that
        line. Flip to Edit mode automatically if you were in Preview.
      </p>
    ),
  },
  {
    title: "Keyboard shortcuts",
    body: (
      <div className="tutorial-shortcuts">
        <kbd>⌘O</kbd>
        <span>Open files</span>
        <kbd>⌥⌘O</kbd>
        <span>Open folder</span>
        <kbd>⌘W</kbd>
        <span>Close tab</span>
        <kbd>⌘F</kbd>
        <span>Find</span>
        <kbd>⌘\</kbd>
        <span>Toggle sidebar</span>
        <kbd>⌘=</kbd>
        <span>Zoom in / out / reset (⌘− ⌘0)</span>
        <kbd>⌘Z</kbd>
        <span>Undo / Redo (⇧⌘Z)</span>
        <kbd>⌘B</kbd>
        <span>Bold</span>
        <kbd>⌘I</kbd>
        <span>Italic</span>
        <kbd>⌘U</kbd>
        <span>Underline</span>
        <kbd>⇧⌘X</kbd>
        <span>Strikethrough</span>
        <kbd>⌘E</kbd>
        <span>Inline code</span>
        <kbd>⌥⌘1…6</kbd>
        <span>Heading 1 through 6</span>
        <kbd>⌥⌘0</kbd>
        <span>Paragraph</span>
        <kbd>⇧⌘7</kbd>
        <span>Numbered list</span>
        <kbd>⇧⌘8</kbd>
        <span>Bulleted list</span>
        <kbd>⇧⌘9</kbd>
        <span>Task list</span>
        <kbd>⇧⌘B</kbd>
        <span>Blockquote</span>
        <kbd>⌥⌘C</kbd>
        <span>Code block</span>
        <kbd>⌘K</kbd>
        <span>Insert / edit link</span>
        <kbd>⇧⌘T</kbd>
        <span>Insert table</span>
        <kbd>⇧⌘M</kbd>
        <span>Insert Mermaid diagram</span>
        <kbd>⇧⌘L</kbd>
        <span>Insert LaTeX math</span>
      </div>
    ),
  },
  {
    title: "Autosave keeps your work safe",
    body: (
      <p>
        Every edit is written to disk two seconds after you stop typing — no <kbd>⌘S</kbd>
        {" "}needed. If an external change hits a clean file, the editor silently reloads
        it. If you had unsaved edits, a yellow banner lets you Keep yours or Reload from
        disk.
      </p>
    ),
  },
  {
    title: "Make Evhan .MD Editor the default for .md files",
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
            <strong>Evhan .MD Editor</strong> from the dropdown.
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
        Click through the headings in Welcome.md to see every renderer in action, or open
        your own <kbd>.md</kbd> file with <kbd>⌘O</kbd>. You can reopen this tour anytime
        from <strong>Help → Show Tutorial</strong>.
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
