import { useState } from "react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/**
 * NodeView for CodeBlockLowlight — same markup Tiptap would emit (`<pre><code>`)
 * plus a hover-only Copy button overlay, mirroring the PreviewPane behavior.
 */
export function CodeBlockView({ node }: NodeViewProps) {
  const [label, setLabel] = useState("Copy");
  const language = node.attrs.language as string | null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setLabel("Copied");
      window.setTimeout(() => setLabel("Copy"), 1500);
    } catch (err) {
      console.warn("clipboard.writeText failed", err);
    }
  }

  return (
    <NodeViewWrapper as="div" className="code-block-wrap">
      <pre className={language ? `language-${language}` : undefined}>
        <NodeViewContent<"code"> as="code" />
      </pre>
      <button
        type="button"
        className="copy-btn"
        contentEditable={false}
        onClick={copy}
        aria-label="Copy code to clipboard"
      >
        {label}
      </button>
    </NodeViewWrapper>
  );
}
