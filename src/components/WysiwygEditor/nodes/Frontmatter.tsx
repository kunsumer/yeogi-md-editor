import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

/**
 * YAML frontmatter (`---\n…\n---` at the top of the file).
 *
 * markdown-it parses `---` as an HR, so without this node the frontmatter
 * leaks into the document as a huge "title: … author: …" paragraph sandwiched
 * between two rules. We strip it off in a parse wrapper and re-inject a
 * compact muted pill, preserving the source for round-trip.
 */

function FrontmatterView({ node }: NodeViewProps) {
  const source = (node.attrs.source as string) || "";
  const lines = source.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const keys = lines
    .map((l) => l.match(/^(\w[\w\-]*)\s*:/)?.[1])
    .filter((k): k is string => Boolean(k));

  return (
    <NodeViewWrapper
      as="div"
      className="frontmatter-block"
      contentEditable={false}
      data-frontmatter=""
      data-source={source}
      title={source}
    >
      <span className="frontmatter-label">YAML frontmatter</span>
      {keys.length > 0 && <span className="frontmatter-keys">{keys.join(" · ")}</span>}
    </NodeViewWrapper>
  );
}

// Bridge between the src-rewrite in `setup` (where markdown-it operates on a
// raw string) and the DOM-level injection in `updateDOM`. tiptap-markdown
// parses synchronously, so a single slot is safe.
let pendingFrontmatter: string | null = null;

interface MDWithParse {
  parse: (src: string, env: unknown) => unknown[];
  __frontmatterWrapped?: boolean;
}

export const Frontmatter = Node.create({
  name: "frontmatter",
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
        tag: "div[data-frontmatter]",
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
        "data-frontmatter": "",
        "data-source": (node.attrs.source as string) || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FrontmatterView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (node: unknown) => void },
          node: { attrs: { source: string } },
        ) {
          state.write("---\n" + node.attrs.source + "\n---");
          state.closeBlock(node);
        },
        parse: {
          setup(md: MDWithParse) {
            if (md.__frontmatterWrapped) return;
            md.__frontmatterWrapped = true;
            const origParse = md.parse.bind(md);
            md.parse = (src: string, env: unknown) => {
              pendingFrontmatter = null;
              const stripped = stripFrontmatter(src);
              if (stripped) {
                pendingFrontmatter = stripped.body;
                return origParse(stripped.rest, env);
              }
              return origParse(src, env);
            };
          },
          updateDOM(element: HTMLElement) {
            if (pendingFrontmatter === null) return;
            const div = document.createElement("div");
            div.setAttribute("data-frontmatter", "");
            div.setAttribute("data-source", pendingFrontmatter);
            element.prepend(div);
            pendingFrontmatter = null;
          },
        },
      },
    };
  },
});

function stripFrontmatter(src: string): { body: string; rest: string } | null {
  // Must start with --- at the very first char.
  if (!src.startsWith("---")) return null;
  const firstEol = src.indexOf("\n");
  if (firstEol < 0) return null;
  // Open fence line must be only `---` (possibly with trailing CR).
  const openLine = src.slice(0, firstEol).replace(/\r$/, "");
  if (openLine !== "---") return null;
  // Closing `---` on its own line.
  const after = src.slice(firstEol + 1);
  const closeRegex = /^---\s*$/m;
  const m = closeRegex.test(after) ? after.match(closeRegex) : null;
  if (!m || m.index === undefined) return null;
  const body = after.slice(0, m.index).replace(/\r?\n$/, "");
  const endIdx = firstEol + 1 + m.index + m[0].length;
  let rest = src.slice(endIdx);
  if (rest.startsWith("\r\n")) rest = rest.slice(2);
  else if (rest.startsWith("\n")) rest = rest.slice(1);
  return { body, rest };
}
