import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import type { Plugin } from "unified";
import type { Root } from "hast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import { rehypeMermaidInline } from "./mermaid-plugin";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    pre: ["className", "style", "tabIndex"],
    code: ["className", "style"],
    span: [...(defaultSchema.attributes?.span || []), "className", "style"],
    div: [...(defaultSchema.attributes?.div || []), "className", "style"],
    svg: ["className", "viewBox", "xmlns", "width", "height", "role", "ariaLabel"],
    path: ["d", "fill", "stroke", "strokeWidth"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "svg",
    "path",
    "g",
    "line",
    "rect",
    "circle",
    "text",
    "tspan",
  ],
};

export async function renderMarkdown(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeMermaidInline)
    .use(rehypeRaw as Plugin<[], Root>)
    .use(rehypeKatex, { throwOnError: false, errorColor: "#cc0000" })
    .use(rehypeShiki, { theme: "github-dark" })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
  const file = await processor.process(md);
  return String(file);
}
