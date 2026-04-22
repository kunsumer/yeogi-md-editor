import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";

interface Props {
  kind: "mermaid" | "math";
  initialValue?: string;
  onInsert: (source: string) => void;
  onCancel: () => void;
}

const PLACEHOLDERS: Record<Props["kind"], string> = {
  mermaid: `flowchart TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Ship it]
  B -->|No| D[Debug]`,
  math: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}",
};

const TITLES: Record<Props["kind"], string> = {
  mermaid: "Insert Mermaid diagram",
  math: "Insert LaTeX math",
};

let mermaidInitialized = false;
function ensureMermaid() {
  if (mermaidInitialized) return;
  mermaidInitialized = true;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  });
}

let previewIdSeq = 0;
let mermaidPreviewQueue: Promise<unknown> = Promise.resolve();

/**
 * Side-by-side source + live preview dialog for inserting Mermaid diagrams
 * or LaTeX math. Debounces preview on type so rendering stays snappy.
 */
export function InsertCodeDialog({ kind, initialValue = "", onInsert, onCancel }: Props) {
  const [source, setSource] = useState(initialValue);
  const [deferred, setDeferred] = useState(initialValue);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDeferred(source), 200);
    return () => window.clearTimeout(t);
  }, [source]);

  // Render preview whenever the debounced source changes.
  useEffect(() => {
    let cancelled = false;
    const host = previewRef.current;
    if (!host) return;
    if (!deferred.trim()) {
      host.replaceChildren();
      return;
    }
    if (kind === "math") {
      try {
        host.replaceChildren();
        katex.render(deferred, host, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (err) {
        host.textContent = String(err);
      }
    } else {
      ensureMermaid();
      const runTask = async () => {
        if (cancelled || !host) return;
        const placeholder = document.createElement("div");
        placeholder.className = "mermaid";
        placeholder.id = `mermaid-preview-${++previewIdSeq}`;
        placeholder.textContent = deferred;
        host.replaceChildren(placeholder);
        try {
          await mermaid.run({ nodes: [placeholder], suppressErrors: false });
        } catch (err) {
          if (cancelled) return;
          host.textContent = String(err);
        }
      };
      mermaidPreviewQueue = mermaidPreviewQueue.then(runTask, runTask);
    }
    return () => {
      cancelled = true;
    };
  }, [deferred, kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    if (!source.trim()) return;
    onInsert(source);
  }

  return (
    <div
      className="insert-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[kind]}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="insert-card">
        <div className="insert-title">{TITLES[kind]}</div>
        <div className="insert-body">
          <div className="insert-source-pane">
            <label className="insert-pane-label" htmlFor="insert-source">
              Source
            </label>
            <textarea
              id="insert-source"
              ref={textareaRef}
              value={source}
              placeholder={PLACEHOLDERS[kind]}
              onChange={(e) => setSource(e.target.value)}
              onKeyDown={(e) => {
                // Tab inserts a tab instead of moving focus.
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart;
                  const end = el.selectionEnd;
                  const next = source.slice(0, start) + "  " + source.slice(end);
                  setSource(next);
                  requestAnimationFrame(() => {
                    el.selectionStart = el.selectionEnd = start + 2;
                  });
                }
                // Cmd/Ctrl+Enter submits.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              spellCheck={false}
            />
          </div>
          <div className="insert-preview-pane">
            <div className="insert-pane-label">Preview</div>
            <div ref={previewRef} className="insert-preview preview-content" />
          </div>
        </div>
        <div className="insert-actions">
          <div style={{ flex: 1, color: "var(--text-faint)", fontSize: 11 }}>
            {kind === "mermaid" ? "Mermaid syntax" : "LaTeX (KaTeX subset)"} · ⌘⏎ to insert
          </div>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={!source.trim()}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
