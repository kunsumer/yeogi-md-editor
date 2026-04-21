import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ConflictBanner } from "./components/ConflictBanner";
import { Editor } from "./components/Editor";
import { FolderPicker } from "./components/FolderPicker";
import { TabBar } from "./components/TabBar";
import { fsList, fsRead, fsWrite, watcherSubscribe, type DirEntry } from "./lib/ipc/commands";
import { useDocuments } from "./state/documents";
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { useWatcherEvents } from "./hooks/useWatcherEvents";
import { flushRef } from "./state/flushRef";

export default function App() {
  const [folder, setFolder] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [, setWatcherOffline] = useState<string | null>(null);
  useWatcherEvents(setWatcherOffline);
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

  useEffect(() => {
    const p = listen("app.close-requested", async () => {
      const dirty = useDocuments.getState().documents.filter((d) => d.isDirty);
      if (usePreferences.getState().autosaveEnabled) {
        if (flushRef.current) await flushRef.current();
        await getCurrentWindow().destroy();
        return;
      }
      if (dirty.length === 0) {
        await getCurrentWindow().destroy();
        return;
      }
      const ok = await confirm(
        `You have ${dirty.length} unsaved document(s). Close without saving?`,
        { title: "Unsaved changes", kind: "warning" },
      );
      if (ok) await getCurrentWindow().destroy();
    });
    return () => {
      p.then((fn) => fn());
    };
  }, []);

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
      <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <TabBar
          docs={documents.map((d) => ({
            id: d.id,
            title: d.path ? d.path.split("/").pop()! : "Untitled",
            isDirty: d.isDirty,
          }))}
          activeId={activeId}
          onActivate={setActive}
          onClose={async (id) => {
            const doc = useDocuments.getState().documents.find((d) => d.id === id);
            if (doc?.previewWindowLabel) {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("window_close", { label: doc.previewWindowLabel });
            }
            useDocuments.getState().closeDocument(id);
          }}
        />
        {active?.conflict && (
          <ConflictBanner
            onKeep={async () => {
              useDocuments.getState().setConflict(active.id, null);
              if (flushRef.current) await flushRef.current();
            }}
            onReload={async () => {
              if (!active.path) return;
              const r = await fsRead(active.path);
              useDocuments
                .getState()
                .replaceContentFromDisk(active.id, { content: r.content, mtimeMs: r.mtime_ms });
            }}
            onDiff={() => console.log("diff viewer is post-v1")}
          />
        )}
        {active ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              docId={active.id}
              value={active.content}
              onChange={(next) => setContent(active.id, next)}
              readOnly={active.readOnly}
              onReady={(view) => {
                viewRef.current = view;
              }}
            />
          </div>
        ) : (
          <div style={{ padding: 24 }}>No file open.</div>
        )}
      </main>
    </div>
  );
}
