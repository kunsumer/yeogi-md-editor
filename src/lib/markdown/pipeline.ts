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

// Attribute set broad enough to cover Mermaid's rendered SVG
// (positions, transforms, fonts, strokes, markers, gradients). Applied
// uniformly to every SVG-family tag; hast uses both camelCase and
// hyphenated forms depending on the parser path, so both are listed.
const svgAttrs = [
  "id",
  "class",
  "className",
  "style",
  "transform",
  "fill",
  "stroke",
  "stroke-width",
  "strokeWidth",
  "stroke-linecap",
  "strokeLinecap",
  "stroke-linejoin",
  "strokeLinejoin",
  "stroke-dasharray",
  "strokeDasharray",
  "stroke-opacity",
  "strokeOpacity",
  "fill-opacity",
  "fillOpacity",
  "opacity",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "viewBox",
  "xmlns",
  "preserveAspectRatio",
  "font-family",
  "fontFamily",
  "font-size",
  "fontSize",
  "font-weight",
  "fontWeight",
  "text-anchor",
  "textAnchor",
  "dominant-baseline",
  "dominantBaseline",
  "alignment-baseline",
  "alignmentBaseline",
  "dy",
  "dx",
  "marker-end",
  "markerEnd",
  "marker-start",
  "markerStart",
  "marker-mid",
  "markerMid",
  "orient",
  "marker-width",
  "markerWidth",
  "marker-height",
  "markerHeight",
  "refX",
  "refY",
  "offset",
  "stop-color",
  "stopColor",
  "stop-opacity",
  "stopOpacity",
  "gradientUnits",
  "gradientTransform",
  "role",
  "aria-label",
  "ariaLabel",
  "aria-hidden",
  "ariaHidden",
];

const svgTags = [
  "svg",
  "path",
  "g",
  "line",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "text",
  "tspan",
  "textPath",
  "defs",
  "marker",
  "use",
  "pattern",
  "mask",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "foreignObject",
];

const svgAttrMap: Record<string, string[]> = {};
for (const tag of svgTags) svgAttrMap[tag] = svgAttrs;

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    pre: ["className", "style", "tabIndex"],
    code: ["className", "style"],
    span: [...(defaultSchema.attributes?.span || []), "className", "style"],
    div: [...(defaultSchema.attributes?.div || []), "className", "style"],
    ...svgAttrMap,
  },
  tagNames: [...(defaultSchema.tagNames || []), ...svgTags],
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
