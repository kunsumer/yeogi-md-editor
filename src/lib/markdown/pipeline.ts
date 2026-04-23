import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import type { Plugin } from "unified";
import type { Root } from "hast";
import { rehypeMermaidInline } from "./mermaid-plugin";
import { remarkInlineMarks } from "./remarkInlineMarks";
import { remarkWikiLinks } from "./remarkWikiLinks";
import { THEMES, type ResolvedThemeId } from "../themes";

/**
 * Read the currently-applied theme id from the document root and look up
 * its Shiki theme name. Defaults to "github-dark" if the attribute is
 * missing (server-side rendering, first-render race, etc.).
 */
function currentShikiTheme(): string {
  if (typeof document === "undefined") return "github-dark";
  const id = document.documentElement.dataset.themeId as ResolvedThemeId | undefined;
  return id && THEMES[id] ? THEMES[id].shikiTheme : "github-dark";
}

/**
 * Render markdown to an HTML string.
 *
 * This pipeline does NOT include rehype-sanitize. Mermaid's generated SVG
 * carries a <style> element and a wide cast of SVG attributes (fill, stroke,
 * transform, text-anchor, font-family, markers, …) that rehype-sanitize
 * silently strips, leaving diagrams as misshapen black blobs. Sanitation is
 * instead handled at the DOM-insertion boundary by `safeReplaceChildren`
 * (DOMPurify with the SVG + MathML profiles). Every DOM insertion of the
 * HTML this pipeline produces MUST go through that helper — nothing else.
 */
export async function renderMarkdown(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    // Runs after remark-gfm so single-~ sub doesn't fight double-~ strike.
    .use(remarkInlineMarks)
    // Wiki-links (`[[Target]]`) render as anchors with class "wikilink"
    // that PreviewPane resolves against the active folder on click.
    .use(remarkWikiLinks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeMermaidInline)
    .use(rehypeRaw as Plugin<[], Root>)
    .use(rehypeKatex, { throwOnError: false, errorColor: "#cc0000" })
    .use(rehypeShiki, { theme: currentShikiTheme() })
    .use(rehypeStringify, { allowDangerousHtml: true });
  const file = await processor.process(md);
  return String(file);
}
