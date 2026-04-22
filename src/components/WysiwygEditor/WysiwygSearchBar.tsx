import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  replaceAll,
  replaceCurrent,
  searchClear,
  searchNext,
  searchPrev,
  searchSetQuery,
  type SearchState,
} from "./nodes/SearchHighlight";

interface Props {
  editor: Editor;
  withReplace: boolean;
  onClose: () => void;
}

/**
 * In-WYSIWYG find bar. Drives the SearchHighlight ProseMirror plugin so
 * matches are rendered as decorations without moving the editor's text
 * cursor. When `withReplace` is true, shows a second row with replacement
 * input + Replace / Replace All buttons.
 */
export function WysiwygSearchBar({ editor, withReplace, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [state, setState] = useState<SearchState>({
    query: "",
    matches: [],
    currentIndex: -1,
  });
  const queryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    queryRef.current?.focus();
    queryRef.current?.select();
    return () => {
      searchClear(editor);
    };
  }, [editor]);

  // Re-run the search when the query input changes (debounced so typing
  // isn't hamstrung on giant docs).
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchSetQuery(editor, query);
      setState(next);
    }, 120);
    return () => window.clearTimeout(t);
  }, [query, editor]);

  function onNext() {
    const s = searchNext(editor);
    if (s) setState(s);
    /* noop if undefined */
  }
  function onPrev() {
    const s = searchPrev(editor);
    if (s) setState(s);
    /* noop if undefined */
  }
  function onReplace() {
    const s = replaceCurrent(editor, replacement);
    if (s) setState(s);
    /* noop if undefined */
  }
  function onReplaceAll() {
    const count = replaceAll(editor, replacement);
    if (count > 0) {
      const s = searchSetQuery(editor, query);
      setState(s);
    }
  }

  function onQueryKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  function onReplaceKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey) onReplaceAll();
      else onReplace();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  const total = state.matches.length;
  const current = state.currentIndex + 1;
  const statusText =
    !query ? "" : total === 0 ? "No matches" : `${current} of ${total}`;

  return (
    <div className="wysiwyg-search" role="search">
      <div className="wysiwyg-search-row">
        <input
          ref={queryRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onQueryKey}
          placeholder="Find in document"
          aria-label="Find in document"
        />
        <button
          type="button"
          className="btn-ghost wysiwyg-search-btn"
          onClick={onPrev}
          disabled={total === 0}
          aria-label="Previous match"
          title="Previous (⇧⏎)"
        >
          ↑
        </button>
        <button
          type="button"
          className="btn-ghost wysiwyg-search-btn"
          onClick={onNext}
          disabled={total === 0}
          aria-label="Next match"
          title="Next (⏎)"
        >
          ↓
        </button>
        <span
          className={`wysiwyg-search-status${total === 0 && query ? " miss" : ""}`}
          aria-live="polite"
        >
          {statusText}
        </span>
        <button
          type="button"
          className="btn-ghost wysiwyg-search-btn"
          onClick={onClose}
          aria-label="Close find"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>
      {withReplace && (
        <div className="wysiwyg-search-row">
          <input
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={onReplaceKey}
            placeholder="Replace with"
            aria-label="Replace with"
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={onReplace}
            disabled={total === 0}
            title="Replace current (⏎)"
          >
            Replace
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onReplaceAll}
            disabled={total === 0}
            title="Replace all (⌘⏎)"
          >
            Replace all
          </button>
        </div>
      )}
    </div>
  );
}
