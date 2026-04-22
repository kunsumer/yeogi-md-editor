import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

// "strict" security: mermaid sanitizes its own output, so we can skip the
// serialize → DOMPurify → DOMParser round trip. That round trip was
// dropping the `<foreignObject><div>` text labels on flowcharts.
let initialized = false;
function initMermaid() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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

  useEffect(() => {
    let cancelled = false;
    initMermaid();
    const run = async () => {
      if (cancelled || !ref.current) return;
      const host = ref.current;
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
  }, [source]);

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
