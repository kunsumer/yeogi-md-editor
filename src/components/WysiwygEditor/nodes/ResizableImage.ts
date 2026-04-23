import BaseImage from "@tiptap/extension-image";

/**
 * Image with Tiptap's built-in resize handles turned on, plus a markdown
 * serializer that preserves the resized dimensions via inline <img> HTML.
 *
 * Round-trip contract:
 *   - no width/height on the node → emit standard `![alt](src "title")`
 *   - width or height set         → emit `<img src alt title width height />`
 *     (markdown-it html:true parses this back, the base parseHTML rule
 *     picks it up, width/height attributes come back via the default
 *     attribute parser.)
 */
function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escMdUrl(s: string): string {
  // Parenthesis inside a markdown URL must be escaped.
  return s.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function escMdAlt(s: string): string {
  return s.replace(/([[\]])/g, "\\$1");
}

function escMdTitle(s: string): string {
  return s.replace(/"/g, '\\"');
}

interface ImageAttrs {
  src?: string | null;
  alt?: string | null;
  title?: string | null;
  width?: number | string | null;
  height?: number | string | null;
}

export const ResizableImage = BaseImage.extend({
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: ImageAttrs; type: { isBlock: boolean } },
        ) {
          const attrs = node.attrs || {};
          const src = attrs.src ?? "";
          const alt = attrs.alt ?? "";
          const title = attrs.title ?? "";
          const width = attrs.width;
          const height = attrs.height;
          const hasDim = (width != null && width !== "") || (height != null && height !== "");

          if (hasDim) {
            // Inline HTML carries the dimensions round-trip. Closing slash
            // keeps it valid in both HTML and XHTML-style parsers.
            const parts = [`src="${escAttr(src)}"`];
            if (alt) parts.push(`alt="${escAttr(alt)}"`);
            if (title) parts.push(`title="${escAttr(title)}"`);
            if (width != null && width !== "") parts.push(`width="${escAttr(String(width))}"`);
            if (height != null && height !== "")
              parts.push(`height="${escAttr(String(height))}"`);
            state.write(`<img ${parts.join(" ")} />`);
          } else {
            const titlePart = title ? ` "${escMdTitle(title)}"` : "";
            state.write(`![${escMdAlt(alt)}](${escMdUrl(src)}${titlePart})`);
          }
          // Image is configured as a block node; close the block so the
          // next paragraph isn't concatenated onto the same markdown line.
          if (node.type.isBlock) state.closeBlock(node);
        },
        parse: {
          // markdown-it handles `![]()` and, with html: true, raw <img> tags;
          // both paths reach the base parseHTML rule which picks up width/
          // height attributes via the default attribute parser.
        },
      },
    };
  },
});
