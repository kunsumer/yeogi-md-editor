/**
 * markdown-it plugin: `[[Target]]` → `<span class="wikilink" data-wiki-target="Target">Target</span>`
 *
 * Installed into tiptap-markdown's internal markdown-it so WYSIWYG picks up
 * Obsidian/Logseq-style wiki-links. The emitted span is picked up downstream
 * by the Tiptap `wikiLink` mark (inline) which also owns round-trip
 * serialization back to `[[…]]` on save.
 *
 * The piped form `[[Target|Display]]` is intentionally NOT supported here —
 * MVP only. Tiptap marks don't have a clean path for "store target attr
 * separately from visible text" without promoting to an atom node, and
 * cases where display text differs from the link target are rare.
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
    const inner = src.slice(pos + 2, end);
    // Bail on newlines, pipes (piped display form not supported), or nested
    // brackets — let markdown-it's regular link rules handle edge forms.
    if (/[\n\[\]|]/.test(inner)) return false;
    const target = inner.trim();
    if (!target) return false;
    if (!silent) {
      const token = state.push("html_inline", "", 0);
      token.content =
        '<span class="wikilink" data-wiki-target="' +
        escHtml(target) +
        '">' +
        escHtml(target) +
        "</span>";
    }
    state.pos = end + 2;
    return true;
  });
}
