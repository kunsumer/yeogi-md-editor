import BaseSubscript from "@tiptap/extension-subscript";
import BaseSuperscript from "@tiptap/extension-superscript";
import BaseHighlight from "@tiptap/extension-highlight";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItMark from "markdown-it-mark";

// tiptap-markdown calls setup() on every parse; the plugins guard against
// double-install internally but we still gate so we only add them once per
// markdown-it instance.
const subInstalled = new WeakSet<object>();
const supInstalled = new WeakSet<object>();
const markInstalled = new WeakSet<object>();

/**
 * Pandoc / extended-markdown inline marks:
 *   H~2~O              → H<sub>2</sub>O
 *   E = mc^2^          → E = mc<sup>2</sup>
 *   ==highlighted==    → <mark>highlighted</mark>
 *
 * Each wraps a Tiptap mark with tiptap-markdown metadata so the syntax
 * round-trips:
 *   - parse:     a markdown-it plugin turns the delimited form into the
 *                matching HTML tag; tiptap-markdown applies the mark.
 *   - serialize: tiptap-markdown wraps the marked range with the configured
 *                open/close delimiters.
 *
 * Delimiter collisions considered safe:
 *   - single `~` sub vs GFM `~~` strikethrough: markdown-it parses the
 *     double-tilde variant first, so `~~foo~~` stays strikethrough.
 *   - `==` highlight doesn't collide with any core markdown syntax.
 */
export const Subscript = BaseSubscript.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "~",
          close: "~",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(md: object) {
            if (subInstalled.has(md)) return;
            subInstalled.add(md);
            (md as { use: (plugin: unknown) => void }).use(markdownItSub);
          },
        },
      },
    };
  },
});

export const Superscript = BaseSuperscript.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "^",
          close: "^",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(md: object) {
            if (supInstalled.has(md)) return;
            supInstalled.add(md);
            (md as { use: (plugin: unknown) => void }).use(markdownItSup);
          },
        },
      },
    };
  },
});

export const Highlight = BaseHighlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "==",
          close: "==",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(md: object) {
            if (markInstalled.has(md)) return;
            markInstalled.add(md);
            (md as { use: (plugin: unknown) => void }).use(markdownItMark);
          },
        },
      },
    };
  },
});
