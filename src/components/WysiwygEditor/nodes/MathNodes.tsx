import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { mathPlugin } from "./math-markdown-it";

/* ---------- Shared NodeView ---------- */

function KatexView({ source, display }: { source: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(source, ref.current, {
        throwOnError: false,
        displayMode: display,
      });
    } catch (err) {
      // KaTeX already throws only on malformed input; this catch handles
      // unexpected runtime errors (e.g., DOM reuse).
      ref.current.textContent = `$${display ? "$" : ""}${source}$${display ? "$" : ""}`;
      console.warn("KaTeX render failed:", err);
    }
  }, [source, display]);
  return <span ref={ref} />;
}

function MathBlockView({ node }: NodeViewProps) {
  const source = (node.attrs.source as string) || "";
  return (
    <NodeViewWrapper
      as="div"
      className="math-block"
      contentEditable={false}
      data-math-block=""
      data-source={source}
    >
      <KatexView source={source} display />
    </NodeViewWrapper>
  );
}

function MathInlineView({ node }: NodeViewProps) {
  const source = (node.attrs.source as string) || "";
  return (
    <NodeViewWrapper
      as="span"
      className="math-inline"
      contentEditable={false}
      data-math-inline=""
      data-source={source}
    >
      <KatexView source={source} display={false} />
    </NodeViewWrapper>
  );
}

/* ---------- Tiptap Nodes ---------- */

export const MathBlock = Node.create({
  name: "mathBlock",
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
        tag: "div[data-math-block]",
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
        "data-math-block": "",
        "data-source": (node.attrs.source as string) || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (node: unknown) => void }, node: { attrs: { source: string } }) {
          state.write("$$\n" + node.attrs.source + "\n$$");
          state.closeBlock(node);
        },
        parse: {
          setup(markdownit: Parameters<typeof mathPlugin>[0]) {
            mathPlugin(markdownit);
          },
        },
      },
    };
  },
});

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      source: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-math-inline]",
        getAttrs: (el) => ({
          source: (el as HTMLElement).getAttribute("data-source") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": "",
        "data-source": (node.attrs.source as string) || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void }, node: { attrs: { source: string } }) {
          state.write("$" + node.attrs.source + "$");
        },
        // Parse hook shared with MathBlock — only need to register once, but
        // idempotency is fine since mathPlugin adds named rules that markdown-it
        // will refuse to re-register with the same name (second call is a no-op
        // because `after` + same name throws; we avoid that by registering only
        // from MathBlock).
      },
    };
  },
});
