import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { Root, Heading as MdastHeading, Text } from "mdast";

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
}

const parser = unified().use(remarkParse);

export function extractHeadings(md: string): Heading[] {
  const tree = parser.parse(md) as Root;
  const headings: Heading[] = [];
  visit(tree, "heading", (node: MdastHeading) => {
    const text = node.children
      .filter((c): c is Text => c.type === "text")
      .map((c) => c.value)
      .join("")
      .replace(/\s*#+\s*$/, "")
      .trim();
    if (!text) return;
    const line = node.position?.start.line ?? 1;
    headings.push({ level: node.depth as Heading["level"], text, line });
  });
  return headings;
}
