import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

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

function configureMermaid(type: string, width: number): void {
  const base = {
    startOnLoad: false,
    theme: "default" as const,
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
      placeholder.textContent = source; // user markdown, inserted as text
      host.replaceChildren(placeholder);
      try {
        await mermaid.run({ nodes: [placeholder], suppressErrors: false });
        if (cancelled) return;
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
      }
    };
    queueMermaid(run);
    return () => {
      cancelled = true;
    };
  }, [source, tick]);

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
