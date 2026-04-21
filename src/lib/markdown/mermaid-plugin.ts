import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

export const rehypeMermaidInline: Plugin<[], Root> = () => {
  return async (tree) => {
    const jobs: Array<{ node: Element; code: string }> = [];
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre" || !node.children?.[0]) return;
      const inner = node.children[0] as Element;
      if (inner.tagName !== "code") return;
      const classes = (inner.properties?.className || []) as string[];
      if (!classes.includes("language-mermaid")) return;
      const textNode = inner.children?.[0];
      if (textNode && textNode.type === "text") {
        jobs.push({ node, code: textNode.value });
      }
    });
    for (const job of jobs) {
      try {
        const { svg } = await mermaid.render(
          `m-${Math.random().toString(36).slice(2)}`,
          job.code,
        );
        job.node.tagName = "div";
        job.node.properties = { className: ["mermaid"] };
        job.node.children = [{ type: "raw", value: svg } as unknown as Element];
      } catch (e) {
        job.node.tagName = "pre";
        job.node.properties = { className: ["mermaid-error"] };
        job.node.children = [
          { type: "text", value: `Mermaid error: ${(e as Error).message}` } as unknown as Element,
        ];
      }
    }
  };
};
