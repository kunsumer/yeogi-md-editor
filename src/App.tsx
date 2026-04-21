import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
import { ConflictBanner } from "./components/ConflictBanner";
import { Editor } from "./components/Editor";
import { FileTree } from "./components/FileTree";
import { OpenButtons } from "./components/OpenButtons";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { fsRead, fsWrite, watcherSubscribe } from "./lib/ipc/commands";
import { useDocuments } from "./state/documents";
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { useWatcherEvents } from "./hooks/useWatcherEvents";
import { flushRef } from "./state/flushRef";
import { loadPersistedSession, startSessionPersistence } from "./state/sessionPersistence";

export default function App() {
  const [folder, setFolder] = useState<string | null>(null);
  const [watcherOffline, setWatcherOffline] = useState<string | null>(null);
  useWatcherEvents(setWatcherOffline);
  const { documents, activeId, openDocument, setActive, setContent } = useDocuments();
  const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();
  const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
  const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
  const active = documents.find((d) => d.id === activeId) ?? null;
  const viewRef = useRef<EditorView | null>(null);

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
        await emit("editor.closed");
        await getCurrentWindow().destroy();
        return;
      }
      if (dirty.length === 0) {
        await emit("editor.closed");
        await getCurrentWindow().destroy();
        return;
      }
      const ok = await confirm(
        `You have ${dirty.length} unsaved document(s). Close without saving?`,
        { title: "Unsaved changes", kind: "warning" },
      );
      if (ok) {
        await emit("editor.closed");
        await getCurrentWindow().destroy();
      }
    });
    return () => {
      p.then((fn) => fn());
    };
  }, []);

  async function openFile(path: string) {
    const existing = useDocuments.getState().documents.find((d) => d.path === path);
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

  async function togglePreview() {
    if (!active) return;
    const label = active.previewWindowLabel ?? `preview-${active.id}`;
    if (active.previewWindowLabel) {
      await invoke("window_close", { label });
      useDocuments.getState().setPreviewWindowLabel(active.id, null);
    } else {
      await invoke("window_open_preview", {
        label,
        title: `Preview · ${active.path ?? "Untitled"}`,
        docId: active.id,
      });
      useDocuments.getState().setPreviewWindowLabel(active.id, label);
      await emit("preview.contentUpdate", { id: active.id, content: active.content });
    }
  }

  // Debounced preview sync: when an active doc has an open preview window,
  // re-emit its content 200 ms after the last change.
  useEffect(() => {
    if (!active?.previewWindowLabel) return;
    const t = setTimeout(() => {
      emit("preview.contentUpdate", { id: active.id, content: active.content });
    }, 200);
    return () => clearTimeout(t);
  }, [active?.content, active?.previewWindowLabel, active?.id]);

  useEffect(() => {
    let cancelled = false;
    const persisted = loadPersistedSession();
    const stop = startSessionPersistence();
    if (persisted && persisted.paths.length > 0) {
      (async () => {
        for (const path of persisted.paths) {
          if (cancelled) return;
          try {
            await openFile(path);
          } catch (e) {
            console.warn("session restore: skipping", path, e);
          }
        }
        if (!cancelled && persisted.activePath) {
          const doc = useDocuments
            .getState()
            .documents.find((d) => d.path === persisted.activePath);
          if (doc) setActive(doc.id);
        }
      })();
    }
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100vh" }}>
      <aside style={{ borderRight: "1px solid #ccc", padding: 8, overflow: "auto" }}>
        <OpenButtons
          onPickFiles={async (paths) => {
            for (const p of paths) {
              try {
                await openFile(p);
              } catch (e) {
                console.error("openFile failed:", p, e);
              }
            }
          }}
          onPickFolder={setFolder}
        />
        {folder && (
          <>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{folder}</div>
            <FileTree root={folder} onOpenFile={openFile} />
          </>
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
          <div style={{ padding: 24, flex: 1 }}>No file open.</div>
        )}
        <StatusBar
          isDirty={active?.isDirty ?? false}
          saveState={active?.saveState ?? "idle"}
          wordCount={(active?.content ?? "").trim().split(/\s+/).filter(Boolean).length}
          watcherOffline={watcherOffline}
          onTogglePreview={active ? togglePreview : undefined}
          previewOpen={!!active?.previewWindowLabel}
        />
      </main>
    </div>
  );
}
