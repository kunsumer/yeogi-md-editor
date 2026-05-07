/**
 * Tiny markdown-it plugin: inline `$…$` and block `$$…$$` math.
 *
 * Avoids dragging in an extra dep. Emits HTML placeholders that the Tiptap
 * nodes below parse back into atomic `mathInline` / `mathBlock` nodes:
 *
 *   <span data-math-inline data-source="…"></span>
 *   <div  data-math-block  data-source="…"></div>
 *
 * Rules cribbed from the well-known markdown-it-katex reference impl:
 *  - inline `$…$` requires non-space/non-digit neighbors so `$20 bucks` stays
 *    plain text,
 *  - `\$` escapes,
 *  - block `$$` must stand alone or wrap a paragraph.
 */
type MDIt = {
  inline: { ruler: { after: (a: string, n: string, fn: unknown) => void } };
  block: { ruler: { after: (a: string, n: string, fn: unknown, opts?: unknown) => void } };
  renderer: { rules: Record<string, (tokens: unknown[], idx: number) => string> };
};

// tiptap-markdown re-runs every extension's `setup(md)` on every parse against
// the same markdown-it instance. Guard against duplicate rule registration —
// Ruler.after doesn't dedupe by name.
const initialized = new WeakSet<object>();

export function mathPlugin(md: MDIt) {
  if (initialized.has(md)) return;
  initialized.add(md);

  md.inline.ruler.after("escape", "math_inline", inlineMath);
  md.block.ruler.after("blockquote", "math_block", blockMath, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });

  md.renderer.rules.math_inline = (tokens, idx) => {
    const t = tokens[idx] as { content: string };
    return `<span data-math-inline data-source="${escAttr(t.content)}"></span>`;
  };
  md.renderer.rules.math_block = (tokens, idx) => {
    const t = tokens[idx] as { content: string };
    return `<div data-math-block data-source="${escAttr(t.content)}"></div>\n`;
  };
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ---------- inline $…$ rule ---------- */
// state is a markdown-it InlineState; keep it permissive.
interface InlineState {
  src: string;
  pos: number;
  posMax: number;
  pending: string;
  push(type: string, tag: string, nesting: number): { markup: string; content: string };
}

function isValidDelim(state: InlineState, pos: number) {
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1;
  // Opening: previous char is start-of-string / space / punctuation;
  // next char is not whitespace.
  const canOpen = nextChar !== 0x20 && nextChar !== 0x09 && nextChar !== 0x0a;
  // Closing: previous char is not whitespace; next char is not a digit.
  const canClose = prevChar !== 0x20 && prevChar !== 0x09 && prevChar !== 0x0a;
  const nextIsDigit = nextChar >= 0x30 && nextChar <= 0x39;
  return { canOpen, canClose: canClose && !nextIsDigit };
}

function inlineMath(state: InlineState, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;

  const { canOpen } = isValidDelim(state, state.pos);
  if (!canOpen) {
    if (!silent) state.pending += "$";
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  let match = start;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    // Walk backwards past any escaping backslashes.
    let pos = match - 1;
    while (state.src[pos] === "\\") pos -= 1;
    if ((match - pos) % 2 === 1) break; // unescaped $
    match += 1;
  }

  if (match === -1) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }
  if (match - start === 0) {
    if (!silent) state.pending += "$$";
    state.pos = start + 1;
    return true;
  }

  const { canClose } = isValidDelim(state, match);
  if (!canClose) {
    if (!silent) state.pending += "$";
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }
  state.pos = match + 1;
  return true;
}

/* ---------- block $$…$$ rule ---------- */
interface BlockState {
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  sCount: number[];
  blkIndent: number;
  src: string;
  line: number;
  lineMax: number;
  md: { options: unknown };
  push(type: string, tag: string, nesting: number): { block: boolean; content: string; map: [number, number]; markup: string };
  getLines(begin: number, end: number, indent: number, keepLastLF: boolean): string;
}

function blockMath(
  state: BlockState,
  start: number,
  end: number,
  silent: boolean,
): boolean {
  const startPos = state.bMarks[start] + state.tShift[start];
  const max = state.eMarks[start];

  if (startPos + 2 > max) return false;
  if (state.src.slice(startPos, startPos + 2) !== "$$") return false;

  let pos = startPos + 2;
  let firstLine = state.src.slice(pos, max);
  if (silent) return true;

  let found = firstLine.trimEnd().endsWith("$$");
  let lastLine = "";
  let next = start;
  let lastPos = -1;

  if (found) {
    // Single-line $$ ... $$
    const trimmed = firstLine.trimEnd();
    firstLine = trimmed.slice(0, trimmed.length - 2);
    lastPos = max;
  } else {
    while (!found) {
      next += 1;
      if (next >= end) break;
      pos = state.bMarks[next] + state.tShift[next];
      const line = state.src.slice(pos, state.eMarks[next]);
      if (line.trimEnd().endsWith("$$")) {
        lastPos = state.eMarks[next];
        lastLine = line.trimEnd();
        lastLine = lastLine.slice(0, lastLine.length - 2);
        found = true;
      }
    }
  }

  if (!found) return false;

  const content =
    firstLine && lastLine
      ? firstLine + "\n" + state.getLines(start + 1, next, state.tShift[start], false) + lastLine
      : firstLine || state.getLines(start + 1, next, state.tShift[start], false) + lastLine;

  state.line = next + 1;
  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = content.trim();
  token.map = [start, state.line];
  token.markup = "$$";
  // Silence unused var warnings.
  void lastPos;
  return true;
}
