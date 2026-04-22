import { useEffect, useRef, useState } from "react";

interface Props {
  onClose: () => void;
}

type WindowFindable = Window & {
  find?: (
    query: string,
    caseSensitive?: boolean,
    backwards?: boolean,
    wrap?: boolean,
  ) => boolean;
};

/**
 * Minimal in-WYSIWYG find bar. Uses WebKit's `window.find()` to jump the
 * browser selection to matches — same mechanism as macOS Safari's Cmd+F on
 * a web page. No custom highlight decorations, just native selection.
 */
export function WysiwygSearchBar({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "hit" | "miss">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function runFind(backwards: boolean) {
    if (!query) return;
    const w = window as WindowFindable;
    if (typeof w.find !== "function") {
      setStatus("miss");
      return;
    }
    const found = w.find(query, false, backwards, true);
    setStatus(found ? "hit" : "miss");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runFind(e.shiftKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="wysiwyg-search" role="search">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setStatus("idle");
        }}
        onKeyDown={onKey}
        placeholder="Find in document"
        aria-label="Find in document"
      />
      <button
        type="button"
        className="btn-ghost"
        onClick={() => runFind(true)}
        aria-label="Previous match"
        title="Previous (⇧⏎)"
      >
        ↑
      </button>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => runFind(false)}
        aria-label="Next match"
        title="Next (⏎)"
      >
        ↓
      </button>
      <span
        className={`wysiwyg-search-status${status === "miss" ? " miss" : ""}`}
        aria-live="polite"
      >
        {status === "miss" ? "No matches" : ""}
      </span>
      <button
        type="button"
        className="btn-ghost"
        onClick={onClose}
        aria-label="Close find"
        title="Close (Esc)"
      >
        ✕
      </button>
    </div>
  );
}
