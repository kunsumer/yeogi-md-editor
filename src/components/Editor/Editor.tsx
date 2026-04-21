import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { search, searchKeymap } from "@codemirror/search";

// Make the CodeMirror view fill its flex parent and scroll internally
// instead of growing beyond it. Also gives the editor a calm light surface
// that matches the Meva-style chrome.
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "#ffffff",
    color: "#1a1a1a",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: "1.6",
    padding: "16px 24px",
  },
  ".cm-content": {
    caretColor: "#1a1a1a",
  },
  ".cm-gutters": {
    backgroundColor: "#fafafa",
    color: "#9ca3af",
    border: "none",
    borderRight: "1px solid #eeeeee",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f1f5f9",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#cfe4ff !important",
  },
});

interface Props {
  docId: string;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  onReady: (view: EditorView) => void;
}

export function Editor({ docId, value, onChange, readOnly, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        markdown(),
        search({ top: true }),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
        editorTheme,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onReady(view);
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, readOnly]);

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      style={{ height: "100%", width: "100%", minWidth: 0, overflow: "hidden" }}
    />
  );
}
