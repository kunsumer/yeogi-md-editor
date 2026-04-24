import { Node, mergeAttributes } from "@tiptap/core";

/**
 * HTML `<details>` / `<summary>` passthrough.
 *
 * Tiptap's default schema drops unknown tags, so raw `<details>` in markdown
 * degrades to plain text. These two nodes whitelist the tags, preserve them
 * in the ProseMirror doc, and — via NodeView — restore native disclosure
 * behavior inside the contenteditable editor. The serializer re-emits the
 * `<details>` / `<summary>` wrapper with blank lines around the body so
 * markdown inside still parses on the next load.
 */

interface SerializeState {
  renderContent: (node: unknown) => void;
  renderInline: (node: unknown) => void;
  closeBlock: (node: unknown) => void;
  write: (s: string) => void;
  ensureNewLine: () => void;
  // Internal ProseMirror markdown serializer fields we read to walk children
  // without letting the outer block wrap us.
}

interface ProseNode {
  forEach: (cb: (child: ProseNode, offset: number, i: number) => void) => void;
  attrs: Record<string, unknown>;
  textContent: string;
  firstChild: ProseNode | null;
  childCount: number;
  type: { name: string };
}

export const Details = Node.create({
  name: "details",
  group: "block",
  content: "summary block+",
  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (el) => el.hasAttribute("open"),
        renderHTML: (attrs) => (attrs.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["details", mergeAttributes(HTMLAttributes), 0];
  },

  // Native `<details>` disclosure doesn't fire inside a contenteditable host:
  // ProseMirror captures pointer events on the editor root for caret
  // placement, and even if we toggle the `open` attribute externally, its
  // MutationObserver sees the mismatch and reverts the DOM back to match
  // its model.
  //
  // Fix: mousedown handler on the node's <details> element, dispatching a
  // proper ProseMirror transaction that sets the `open` attribute on the
  // node. That goes through the view's normal update path, DOM and model
  // stay in sync, and the toggle survives the observer.
  //
  // Because this routes through node state, the toggled open/closed state
  // also round-trips through markdown save — flipping it in WYSIWYG writes
  // `<details open>` (or `<details>`) back to disk.
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const dom = document.createElement("details");
      const attrs = mergeAttributes(HTMLAttributes) as Record<string, unknown>;
      for (const [k, v] of Object.entries(attrs)) {
        if (v != null && k !== "open") dom.setAttribute(k, String(v));
      }
      if (node.attrs.open) dom.setAttribute("open", "");

      const handleMousedown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const summary = target.closest("summary");
        if (!summary || summary.parentElement !== dom) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof getPos !== "function") return;
        const pos = getPos();
        if (typeof pos !== "number") return;
        const current = !!node.attrs.open;
        editor.view.dispatch(
          editor.view.state.tr.setNodeAttribute(pos, "open", !current),
        );
      };
      dom.addEventListener("mousedown", handleMousedown);

      return {
        dom,
        contentDOM: dom,
        // Sync DOM when node.attrs.open changes (via our transaction or
        // external edits).
        update(updated) {
          if (updated.type.name !== "details") return false;
          const isOpen = !!updated.attrs.open;
          if (isOpen && !dom.hasAttribute("open")) dom.setAttribute("open", "");
          if (!isOpen && dom.hasAttribute("open")) dom.removeAttribute("open");
          return true;
        },
        // Tell ProseMirror to ignore the `open` attribute mutation — we own
        // it here and drive syncing via `update` above. `mutation` is
        // ProseMirror's ViewMutationRecord union (MutationRecord | selection
        // event); narrow on type before reading attribute fields.
        ignoreMutation(mutation) {
          if (mutation.type !== "attributes") return false;
          if (mutation.target !== dom) return false;
          return mutation.attributeName === "open";
        },
        destroy() {
          dom.removeEventListener("mousedown", handleMousedown);
        },
      };
    };
  },

  addStorage() {
    return {
      markdown: {
        // Emit a proper HTML block so markdown inside round-trips. CommonMark
        // HTML block type 6 ends at a blank line, so open tag on its own
        // line → blank → body markdown → blank → close tag. With that
        // spacing, markdown-it and remark both parse the inner paragraphs
        // / code fences as markdown on the next load.
        serialize(state: SerializeState, node: ProseNode) {
          const open = node.attrs.open ? " open" : "";
          state.write(`<details${open}>`);
          state.ensureNewLine();

          // Children: first is summary, rest are blocks. Emit summary on its
          // own line as `<summary>…</summary>`, then a blank line, then the
          // remaining block children rendered as markdown.
          let childIndex = 0;
          node.forEach((child) => {
            if (childIndex === 0 && child.type.name === "summary") {
              state.write("<summary>");
              state.renderInline(child);
              state.write("</summary>");
              state.ensureNewLine();
              state.write("\n"); // blank line separating summary from body
            } else {
              // Delegate to the normal block renderer for paragraphs, code
              // fences, lists, etc. The existing state handles spacing.
              // @ts-expect-error — ProseMirror markdown serializer exposes render
              state.render(child);
            }
            childIndex++;
          });
          state.ensureNewLine();
          state.write("</details>");
          state.closeBlock(node);
        },
      },
    };
  },
});

export const Summary = Node.create({
  name: "summary",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },

  // No-op serializer: Details handles summary emission itself so the
  // `<summary>` tag stays adjacent to `<details>` on save.
  addStorage() {
    return {
      markdown: {
        serialize() {
          // intentionally empty — Details.serialize walks children directly
        },
      },
    };
  },
});
