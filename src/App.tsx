import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { Editor } from "./components/Editor";
import { FolderPicker } from "./components/FolderPicker";
import { fsList, fsRead, fsWrite, watcherSubscribe, type DirEntry } from "./lib/ipc/commands";
import { useDocuments } from "./state/documents";
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { flushRef } from "./state/flushRef";

export default function App() {
  const [folder, setFolder] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const { documents, activeId, openDocument, setActive, setContent } = useDocuments();
  const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();
  const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
  const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
  const active = documents.find((d) => d.id === activeId) ?? null;
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (folder) fsList(folder).then(setEntries).catch(console.error);
  }, [folder]);

  const { flush } = useAutosave({
    enabled: autosaveEnabled && !!active?.path && !active?.readOnly,
    debounceMs: autosaveDebounceMs,
    content: active?.content ?? "",
    save: async (value) => {
      if (!active?.path) return;
      try {
        markSaveStarted(active.id);
        const r = await fsWrite(active.path, value);
        markSaved(active.id, { content: value, mtimeMs: r.mtime_ms });
      } catch (e) {
        markSaveFailed(active.id, String(e));
      }
    },
  });
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  async function openFile(path: string) {
    const existing = documents.find((d) => d.path === path);
    if (existing) {
      setActive(existing.id);
      return;
    }
    const r = await fsRead(path);
    const id = openDocument({
      path,
      content: r.content,
      savedMtime: r.mtime_ms,
      encoding: r.encoding,
    });
    await watcherSubscribe(path);
    setActive(id);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100vh" }}>
      <aside style={{ borderRight: "1px solid #ccc", padding: 8, overflow: "auto" }}>
        {folder ? (
          <>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{folder}</div>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {entries.map((e) => (
                <li key={e.path}>
                  {e.is_dir ? (
                    <span>📁 {e.name}</span>
                  ) : (
                    <button
                      style={{ all: "unset", cursor: "pointer" }}
                      onClick={() => openFile(e.path)}
                    >
                      📄 {e.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <FolderPicker onPick={setFolder} />
        )}
      </aside>
      <main style={{ height: "100vh" }}>
        {active ? (
          <Editor
            docId={active.id}
            value={active.content}
            onChange={(next) => setContent(active.id, next)}
            readOnly={active.readOnly}
            onReady={(view) => {
              viewRef.current = view;
            }}
          />
        ) : (
          <div style={{ padding: 24 }}>No file open.</div>
        )}
      </main>
    </div>
  );
}
