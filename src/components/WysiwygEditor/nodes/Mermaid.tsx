import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { usePreferences } from "../../../state/preferences";

// "strict" security: mermaid sanitizes its own output, so we can skip the
// serialize → DOMPurify → DOMParser round trip. That round trip was
// dropping the `<foreignObject><div>` text labels on flowcharts.
//
// We re-call initialize() before each run because the config needs to vary
// by diagram type and container width:
//   - Gantt is the only built-in renderer that consumes a container-width
//     hint (`useWidth`). Passing the wrapper's current px width makes the
//     timeline genuinely re-flow when the user drags the resize handle.
//   - Everything else (flowchart, sequence, class, etc.) computes its
//     layout from graph content; auto-scaling to container via the default
//     `useMaxWidth: true` just makes the SVG visually bigger (fonts and
//     all) without actual re-layout. We turn it off so those diagrams
//     render at natural pixel size and the wrapper scrolls when needed.
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Mermaid's quadrantChart lexer treats `->`, `-->`, and a handful of other
 * sequences as reserved arrow tokens. A user who writes a data point like
 * `KR->JP pilot: [0.45, 0.72]` (i.e., a multi-word label that happens to
 * include `->`, hyphens, or other punctuation) hits a "Lexical error on
 * line N" with no obvious cause — the grammar requires the label to be
 * quoted in those cases.
 *
 * This preprocessor scans quadrantChart source for data-point lines of
 * the shape `Name: [x, y]` and wraps the unquoted name in double quotes
 * before handing it to mermaid.render. The user's saved markdown is
 * untouched — the quoting only happens on the way to the renderer, so
 * round-tripping (parse → serialize) stays a no-op.
 */
export function autoQuoteQuadrantLabels(source: string): string {
  // Cheap guard so we don't pay the per-line scan for every diagram type.
  // Looks at the first non-blank, non-comment, non-frontmatter line — same
  // shape detectDiagramType uses.
  if (detectDiagramType(source).toLowerCase() !== "quadrantchart") {
    return source;
  }
  // Match: <indent><label>: [<coords>]
  // - label first char must NOT be `"` (already quoted) or `[` (paranoia)
  // - label must contain at least one character we'd care about — the
  //   regex itself doesn't filter for the offending chars; we just quote
  //   ALL unquoted data-point labels so the renderer doesn't have to
  //   guess. If a label was already simple enough to parse unquoted,
  //   quoting it is harmless (mermaid accepts both forms).
  const dataPoint = /^(\s*)([^"\s\[][^:]*?)\s*:\s*\[([^\]]+)\]\s*$/;
  return source
    .split("\n")
    .map((line) => {
      const m = line.match(dataPoint);
      if (!m) return line;
      const [, indent, rawLabel, coords] = m;
      const label = rawLabel.trim();
      // Defensive — never quote a directive that somehow matched.
      if (/^(title|x-axis|y-axis|quadrant-[1-4])\b/i.test(label)) return line;
      return `${indent}"${label}": [${coords}]`;
    })
    .join("\n");
}

function detectDiagramType(source: string): string {
  // Mermaid 10+ supports YAML frontmatter (e.g. `---\ntitle: X\n---\n`) as
  // the first block of a diagram. We must track the open/close fence pair
  // so lines *inside* the frontmatter don't get mistaken for the diagram
  // declaration — without this, a Gantt with a title would detect as
  // "title:" and miss the per-type `useWidth` config that makes resize
  // re-flow work.
  let inFrontmatter = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("---")) {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;
    if (!line) continue;
    if (line.startsWith("%%")) continue; // mermaid comment
    const tok = (line.split(/\s/, 1)[0] || "").toLowerCase();
    if (tok === "graph") return "flowchart"; // legacy alias
    return tok;
  }
  return "";
}

function currentTheme(): "dark" | "default" {
  if (typeof document === "undefined") return "default";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "default";
}

function configureMermaid(type: string, width: number): void {
  const base = {
    startOnLoad: false,
    theme: currentTheme(),
    securityLevel: "strict" as const,
    fontFamily: FONT_STACK,
  };
  if (type === "gantt") {
    mermaid.initialize({
      ...base,
      gantt: { useWidth: Math.max(240, width) },
    });
    return;
  }
  // For non-Gantt renderers, disable useMaxWidth so the SVG keeps its
  // natural pixel size instead of scaling-to-fit the wrapper.
  mermaid.initialize({
    ...base,
    flowchart: { useMaxWidth: false, htmlLabels: true },
    sequence: { useMaxWidth: false },
    class: { useMaxWidth: false },
    state: { useMaxWidth: false },
    er: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    pie: { useMaxWidth: false },
    mindmap: { useMaxWidth: false },
    gitGraph: { useMaxWidth: false },
    quadrantChart: { useMaxWidth: false },
    xyChart: { useMaxWidth: false },
    c4: { useMaxWidth: false },
  });
}

// tiptap-markdown re-runs setup() on every parse; don't re-wrap the fence rule.
const fenceInstalled = new WeakSet<object>();

let idSeq = 0;

// Mermaid's global config + layout caches aren't concurrency-safe. When a
// document has several diagrams, their NodeViews all fire effects at once
// and mermaid.run() calls interleave, causing one diagram's content to
// bleed into another's host. Serializing the calls through a shared promise
// chain keeps them one-at-a-time.
let mermaidQueue: Promise<unknown> = Promise.resolve();

function queueMermaid(task: () => Promise<void>): Promise<void> {
  const next = mermaidQueue.then(task, task);
  mermaidQueue = next.catch(() => undefined);
  return next;
}

function MermaidView({ node }: NodeViewProps) {
  const source = (node.attrs.source as string) || "";
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `tick` forces a re-render whenever the user drags the resize handle.
  // Debounced in the ResizeObserver so we don't run mermaid every pixel.
  const [tick, setTick] = useState(0);
  // Subscribing to the theme preference re-runs the render effect when the
  // user flips appearance so the diagram picks up mermaid's "dark" theme.
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled || !ref.current) return;
      const host = ref.current;
      const block = host.parentElement; // .mermaid-block
      const hostStyle = window.getComputedStyle(host);
      const hostPadX =
        parseFloat(hostStyle.paddingLeft || "0") +
        parseFloat(hostStyle.paddingRight || "0");
      const width = block ? Math.max(240, block.clientWidth - hostPadX) : 800;
      configureMermaid(detectDiagramType(source), width);

      const placeholder = document.createElement("div");
      placeholder.className = "mermaid";
      placeholder.id = `mermaid-wysiwyg-${++idSeq}`;
      // Preprocess for known per-diagram-type quirks. Currently the only
      // one is auto-quoting unquoted quadrantChart labels; expand here
      // if other diagrams ever need similar shimming. The original
      // `source` (unmodified) is what gets serialized back to disk via
      // addStorage().markdown.serialize, so this is render-only.
      placeholder.textContent = autoQuoteQuadrantLabels(source);
      host.replaceChildren(placeholder);
      try {
        await mermaid.run({ nodes: [placeholder], suppressErrors: false });
        if (cancelled) return;
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(formatMermaidError(err));
      }
    };
    queueMermaid(run);
    return () => {
      cancelled = true;
    };
  }, [source, tick, theme]);

  // Re-run mermaid when the user drags the native resize handle so the
  // internal layout (Gantt date ticks especially) gets proper spacing at
  // the new width.
  useEffect(() => {
    if (!ref.current) return;
    const wrapper = ref.current.parentElement;
    if (!wrapper) return;
    let lastWidth = wrapper.clientWidth;
    let timer: number | null = null;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.width;
      if (Math.abs(next - lastWidth) < 12) return;
      lastWidth = next;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => setTick((t) => t + 1), 180);
    });
    obs.observe(wrapper);
    return () => {
      obs.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return (
    <NodeViewWrapper
      as="div"
      className="mermaid-block"
      contentEditable={false}
      data-mermaid=""
      data-source={source}
    >
      {error ? (
        <pre className="mermaid-error">
          {error}
          {"\n"}
          {source}
        </pre>
      ) : (
        <div ref={ref} className="mermaid" />
      )}
    </NodeViewWrapper>
  );
}

export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      source: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-mermaid]",
        getAttrs: (el) => ({
          source: (el as HTMLElement).getAttribute("data-source") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-mermaid": "",
        "data-source": (node.attrs.source as string) || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: { source: string } },
        ) {
          state.write("```mermaid\n" + node.attrs.source + "\n```");
          state.closeBlock(node);
        },
        parse: {
          setup(markdownit: {
            renderer: {
              rules: Record<
                string,
                | ((tokens: unknown[], idx: number, opts: unknown, env: unknown, slf: unknown) => string)
                | undefined
              >;
            };
          }) {
            if (fenceInstalled.has(markdownit)) return;
            fenceInstalled.add(markdownit);
            const original = markdownit.renderer.rules.fence;
            markdownit.renderer.rules.fence = (tokens, idx, opts, env, slf) => {
              const token = tokens[idx] as { info: string; content: string };
              if ((token.info || "").trim().toLowerCase() === "mermaid") {
                const esc = escAttr(token.content.replace(/\n$/, ""));
                return `<div data-mermaid data-source="${esc}"></div>\n`;
              }
              return original
                ? original(tokens, idx, opts, env, slf)
                : (slf as {
                    renderToken: (tokens: unknown[], idx: number, opts: unknown) => string;
                  }).renderToken(tokens, idx, opts);
            };
          },
        },
      },
    };
  },
});

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Mermaid throws a mix of shapes depending on which subsystem failed:
 *   - Real Error subclasses (`error.message`) for most parse / render paths.
 *   - Plain `{ str, hash }` objects from the Jison parser on grammar errors.
 *   - Plain strings from a few config validators.
 * `String(obj)` produces "[object Object]" for the Jison case, which is
 * useless. This helper extracts whichever message-like field is present
 * and falls back to a JSON dump so the user always sees something
 * actionable instead of a placeholder.
 */
function formatMermaidError(err: unknown): string {
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const candidate = obj.message ?? obj.str ?? obj.error;
    if (typeof candidate === "string") return candidate;
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}
