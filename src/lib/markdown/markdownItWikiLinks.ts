/**
 * markdown-it plugin: parses `[[Target]]` and `[[Target|Display]]` into
 * `<span class="wikilink" data-wiki-target="Target">Display</span>`.
 *
 * Installed into tiptap-markdown's internal markdown-it so WYSIWYG picks up
 * Obsidian/Logseq-style wiki-links. The emitted span is picked up downstream
 * by the Tiptap `wikiLink` mark (inline) which also owns round-trip
 * serialization back to `[[…]]` (or `[[…|…]]`) on save.
 *
 * Malformed inputs (`[[Unclosed`, `[[Empty|]]`, `[[|Nothing]]`, inner
 * newlines, nested brackets) fall through as plain text — the parser returns
 * false and markdown-it continues with normal rules.
 */
type RulerMd = {
  inline: {
    ruler: {
      after: (
        before: string,
        name: string,
        fn: (state: MdInlineState, silent: boolean) => boolean,
      ) => void;
    };
  };
};

interface MdInlineState {
  src: string;
  pos: number;
  push: (type: string, tag: string, nesting: number) => MdToken;
}

interface MdToken {
  content: string;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Parses the inner text of a wiki-link. Returns `null` for any malformed
 * input so the markdown-it rule can fall through to plain-text rendering.
 */
export function parseWikiLinkInner(
  inner: string,
): { target: string; display: string } | null {
  // No line breaks or nested brackets inside the delimiters.
  if (/[\n\[\]]/.test(inner)) return null;
  const pipeIdx = inner.indexOf("|");
  if (pipeIdx === -1) {
    const target = inner.trim();
    if (!target) return null;
    return { target, display: target };
  }
  // A pipe may appear at most once. Two-piped forms are rejected.
  if (inner.indexOf("|", pipeIdx + 1) !== -1) return null;
  const target = inner.slice(0, pipeIdx).trim();
  const display = inner.slice(pipeIdx + 1).trim();
  if (!target || !display) return null;
  return { target, display };
}

export function markdownItWikiLinks(md: RulerMd): void {
  md.inline.ruler.after("link", "wikilink", (state, silent) => {
    const src = state.src;
    const pos = state.pos;
    // Fast check: need "[[" here.
    if (
      src.charCodeAt(pos) !== 0x5b /* [ */ ||
      src.charCodeAt(pos + 1) !== 0x5b
    ) {
      return false;
    }
    const end = src.indexOf("]]", pos + 2);
    if (end === -1) return false;
    const parsed = parseWikiLinkInner(src.slice(pos + 2, end));
    if (!parsed) return false;
    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content =
        '<span class="wikilink" data-wiki-target="' +
        escHtml(parsed.target) +
        '">' +
        escHtml(parsed.display) +
        "</span>";
    }
    state.pos = end + 2;
    return true;
  });
}
