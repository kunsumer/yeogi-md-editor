import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

/**
 * In-editor "Find" for WYSIWYG mode.
 *
 * Uses ProseMirror decorations so matches are visually highlighted without
 * disturbing the user's text cursor or selection — the old window.find()
 * approach moved focus into the contenteditable, which caused "press Enter
 * to find next" to instead insert a newline.
 */

interface Match {
  from: number;
  to: number;
}

export interface SearchState {
  query: string;
  matches: Match[];
  currentIndex: number;
}

type Meta =
  | { type: "setQuery"; query: string }
  | { type: "next" }
  | { type: "prev" }
  | { type: "clear" };

export const searchPluginKey = new PluginKey<SearchState>("wysiwygSearch");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(doc: PMNode, query: string): Match[] {
  if (!query) return [];
  const out: Match[] = [];
  const re = new RegExp(escapeRegex(query), "gi");
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text ?? "";
    for (const m of text.matchAll(re)) {
      if (m.index === undefined || m[0].length === 0) continue;
      out.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  });
  return out;
}

function buildDecorations(state: SearchState, doc: PMNode): DecorationSet {
  if (state.matches.length === 0) return DecorationSet.empty;
  const decos = state.matches.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === state.currentIndex ? "search-match search-match-current" : "search-match",
    }),
  );
  return DecorationSet.create(doc, decos);
}

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchPluginKey,
        state: {
          init(): SearchState {
            return { query: "", matches: [], currentIndex: -1 };
          },
          apply(tr: Transaction, prev: SearchState): SearchState {
            const meta = tr.getMeta(searchPluginKey) as Meta | undefined;
            if (meta) {
              if (meta.type === "setQuery") {
                const matches = findMatches(tr.doc, meta.query);
                return {
                  query: meta.query,
                  matches,
                  currentIndex: matches.length > 0 ? 0 : -1,
                };
              }
              if (meta.type === "next") {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex: (prev.currentIndex + 1) % prev.matches.length,
                };
              }
              if (meta.type === "prev") {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex:
                    (prev.currentIndex - 1 + prev.matches.length) % prev.matches.length,
                };
              }
              if (meta.type === "clear") {
                return { query: "", matches: [], currentIndex: -1 };
              }
            }
            // Document edits invalidate matches — recompute if we have an
            // active query so highlights track new text.
            if (tr.docChanged && prev.query) {
              const matches = findMatches(tr.doc, prev.query);
              const currentIndex =
                matches.length === 0
                  ? -1
                  : Math.min(Math.max(prev.currentIndex, 0), matches.length - 1);
              return { ...prev, matches, currentIndex };
            }
            return prev;
          },
        },
        props: {
          decorations(state: EditorState) {
            const s = searchPluginKey.getState(state);
            if (!s) return null;
            return buildDecorations(s, state.doc);
          },
        },
      }),
    ];
  },
});

/* ---------- Imperative helpers used by WysiwygSearchBar ---------- */

function scrollToCurrent(view: EditorView, state: SearchState): void {
  if (state.currentIndex < 0) return;
  const match = state.matches[state.currentIndex];
  if (!match) return;
  const coords = view.coordsAtPos(match.from);
  // Walk up from the editor DOM to find the actual scroll container
  // (`.wysiwyg-scroll`) and nudge it so the match is centered.
  let scroller: HTMLElement | null = view.dom.parentElement;
  while (scroller) {
    const style = window.getComputedStyle(scroller);
    if (style.overflowY === "auto" || style.overflowY === "scroll") break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const rect = scroller.getBoundingClientRect();
  const target = coords.top - rect.top - rect.height / 2 + scroller.scrollTop;
  scroller.scrollTo({ top: target, behavior: "smooth" });
}

export function searchSetQuery(editor: Editor, query: string): SearchState {
  const { view } = editor;
  view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: "setQuery", query }));
  const s = searchPluginKey.getState(view.state);
  if (s) scrollToCurrent(view, s);
  return s ?? { query, matches: [], currentIndex: -1 };
}

export function searchNext(editor: Editor): SearchState | undefined {
  const { view } = editor;
  view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: "next" }));
  const s = searchPluginKey.getState(view.state);
  if (s) scrollToCurrent(view, s);
  return s;
}

export function searchPrev(editor: Editor): SearchState | undefined {
  const { view } = editor;
  view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: "prev" }));
  const s = searchPluginKey.getState(view.state);
  if (s) scrollToCurrent(view, s);
  return s;
}

export function searchClear(editor: Editor): void {
  const { view } = editor;
  view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: "clear" }));
}

/* ---------- Replace helpers ---------- */

export function replaceCurrent(editor: Editor, replacement: string): SearchState | undefined {
  const { view } = editor;
  const s = searchPluginKey.getState(view.state);
  if (!s || s.currentIndex < 0) return s;
  const match = s.matches[s.currentIndex];
  if (!match) return s;
  // Replace the current match's text span. docChanged triggers match
  // recomputation in the plugin's apply().
  const tr = view.state.tr.insertText(replacement, match.from, match.to);
  view.dispatch(tr);
  const next = searchPluginKey.getState(view.state);
  if (next) scrollToCurrent(view, next);
  return next;
}

export function replaceAll(editor: Editor, replacement: string): number {
  const { view } = editor;
  const s = searchPluginKey.getState(view.state);
  if (!s || s.matches.length === 0) return 0;
  // Walk matches in reverse so earlier positions stay valid.
  let tr = view.state.tr;
  const matches = [...s.matches].sort((a, b) => b.from - a.from);
  for (const m of matches) {
    tr = tr.insertText(replacement, m.from, m.to);
  }
  view.dispatch(tr);
  return matches.length;
}
