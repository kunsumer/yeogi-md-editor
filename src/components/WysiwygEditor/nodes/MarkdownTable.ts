import { Table as BaseTable } from "@tiptap/extension-table";

/**
 * tiptap-markdown's default Table serializer writes plain `| --- |` delimiter
 * rows, so GFM column alignment (`:---`, `:---:`, `---:`) is lost on every
 * save. We override `storage.markdown.serialize` to read each first-row
 * cell's `align` attribute (which Tiptap's own TableCell / TableHeader
 * already parse out of inline `style="text-align:…"` per the GFM spec) and
 * emit the correct delimiter.
 *
 * `addStorage` in Tiptap v3 replaces the parent storage unless we spread
 * it, so we keep parent markdown.parse semantics intact and only override
 * the serializer.
 */

interface SerializerState {
  write: (s: string) => void;
  ensureNewLine: () => void;
  closeBlock: (n: unknown) => void;
  renderInline: (n: unknown) => void;
  inTable?: boolean;
}

interface PMNodeLike {
  childCount: number;
  firstChild: PMNodeLike | null;
  attrs: Record<string, unknown>;
  type: { name: string };
  forEach: (
    fn: (child: PMNodeLike, offset: number, index: number) => void,
  ) => void;
}

function alignDelimiter(align: unknown): string {
  if (align === "left") return ":---";
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  return "---";
}

// Mirror of tiptap-markdown's isMarkdownSerializable: GFM can't represent
// colspan/rowspan, nested blocks inside cells, or mid-table header rows.
// When any of those are present, the default serializer falls back to raw
// HTML (via HTMLNode) — we mimic by returning false here.
function hasSpan(cell: PMNodeLike): boolean {
  const cs = (cell.attrs.colspan as number) ?? 1;
  const rs = (cell.attrs.rowspan as number) ?? 1;
  return cs > 1 || rs > 1;
}

function isGfmSerializable(table: PMNodeLike): boolean {
  const rows: PMNodeLike[] = [];
  table.forEach((r) => rows.push(r));
  const firstRow = rows[0];
  if (!firstRow) return false;
  let ok = true;
  firstRow.forEach((cell) => {
    if (
      cell.type.name !== "tableHeader" ||
      hasSpan(cell) ||
      cell.childCount > 1
    ) {
      ok = false;
    }
  });
  if (!ok) return false;
  for (const row of rows.slice(1)) {
    row.forEach((cell) => {
      if (
        cell.type.name === "tableHeader" ||
        hasSpan(cell) ||
        cell.childCount > 1
      ) {
        ok = false;
      }
    });
    if (!ok) break;
  }
  return ok;
}

export const MarkdownTable = BaseTable.extend({
  addStorage() {
    const parent =
      (this.parent?.() as Record<string, unknown> | undefined) ?? {};
    return {
      ...parent,
      markdown: {
        serialize(state: SerializerState, node: PMNodeLike) {
          if (!isGfmSerializable(node)) {
            // Fall back to HTML-in-markdown: write the table as-is using a
            // naïve <table> block. tiptap-markdown's html:true option picks
            // this back up on the next parse.
            state.write("<table>");
            node.forEach((row) => {
              state.write("<tr>");
              row.forEach((cell) => {
                const tag = cell.type.name === "tableHeader" ? "th" : "td";
                const align = cell.attrs.align as string | undefined;
                const attr = align ? ` style="text-align:${align}"` : "";
                state.write(`<${tag}${attr}>`);
                const content = cell.firstChild;
                if (content) state.renderInline(content);
                state.write(`</${tag}>`);
              });
              state.write("</tr>");
            });
            state.write("</table>");
            state.closeBlock(node);
            return;
          }
          state.inTable = true;
          // Capture alignment per column from the first row (the header).
          const aligns: Array<string | null> = [];
          const firstRow = node.firstChild;
          if (firstRow) {
            firstRow.forEach((cell) => {
              const a = cell.attrs.align;
              aligns.push(
                a === "left" || a === "center" || a === "right"
                  ? (a as string)
                  : null,
              );
            });
          }
          node.forEach((row, _p, i) => {
            state.write("| ");
            row.forEach((col, _p2, j) => {
              if (j) state.write(" | ");
              // Cell content is a single block child (paragraph, usually)
              // when the table is GFM-serializable; render its inline
              // children if any. Text nodes can appear directly when
              // markdown-it parses a raw <td>text</td>, so fall through
              // to rendering them too.
              const cellContent = col.firstChild as
                | (PMNodeLike & { textContent?: string })
                | null;
              const text = cellContent?.textContent ?? "";
              if (cellContent && text.trim().length > 0) {
                state.renderInline(cellContent);
              }
            });
            state.write(" |");
            state.ensureNewLine();
            if (i === 0) {
              const delim = aligns.map(alignDelimiter).join(" | ");
              state.write(`| ${delim} |`);
              state.ensureNewLine();
            }
          });
          state.closeBlock(node);
          state.inTable = false;
        },
        parse: {
          // handled by markdown-it (tables rule is in the default preset)
        },
      },
    };
  },
});
