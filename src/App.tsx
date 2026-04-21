import { useEffect, useMemo, useRef, useState } from "react";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { ConflictBanner } from "./components/ConflictBanner";
import { Editor } from "./components/Editor";
import { FileTree } from "./components/FileTree";
import { Logo } from "./components/Logo";
import { OpenButtons } from "./components/OpenButtons";
import { PreviewPane } from "./components/PreviewPane";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { TOC } from "./components/TOC";
import { TopBar } from "./components/TopBar";
import { fsRead, fsWrite, watcherSubscribe } from "./lib/ipc/commands";
import { extractHeadings } from "./lib/toc";
import { useDocuments, type ViewMode } from "./state/documents";
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { useWatcherEvents } from "./hooks/useWatcherEvents";
import { flushRef } from "./state/flushRef";
import { loadPersistedSession, startSessionPersistence } from "./state/sessionPersistence";

const shellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100vw",
  overflow: "hidden",
  background: "var(--bg)",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "260px 1fr",
};

const asideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-sidebar)",
  borderRight: "1px solid var(--border)",
  minWidth: 0,
  overflow: "hidden",
};

const asideHeaderStyle: React.CSSProperties = {
  padding: "14px 14px 10px",
  borderBottom: "1px solid var(--border)",
  flexShrink: 0,
};

const asideBodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "auto",
  padding: "10px 10px 16px",
};

const asideSectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "var(--text-faint)",
  padding: "12px 6px 4px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mainStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
};

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-faint)",
  fontSize: 13,
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  fontSize: 13,
  color: "var(--text)",
  letterSpacing: 0.1,
};

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

  // Best-effort flush on page hide: if the webview is going away (window
  // close, navigation, reload) and autosave was armed, try one last
  // synchronous-ish fsWrite. The window may close before it resolves, but
  // that's fine — autosave runs every 2 s during editing, so the on-disk
  // version is never more than a couple of seconds stale anyway.
  useEffect(() => {
    const handler = () => {
      if (!flushRef.current) return;
      flushRef.current().catch((e) => console.warn("flush on pagehide failed:", e));
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
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

  const wordCount = (active?.content ?? "").trim().split(/\s+/).filter(Boolean).length;
  const headings = useMemo(
    () => (active ? extractHeadings(active.content) : []),
    [active?.content, active?.id],
  );

  function setViewMode(mode: ViewMode) {
    if (!active) return;
    useDocuments.getState().setViewMode(active.id, mode);
  }

  function jumpToHeading(line: number) {
    if (!active) return;
    // Flip to edit mode so the cursor move is visible and the user can keep typing there.
    if (active.viewMode !== "edit") {
      useDocuments.getState().setViewMode(active.id, "edit");
    }
    const view = viewRef.current;
    if (!view) return;
    const docLine = Math.min(Math.max(line, 1), view.state.doc.lines);
    const pos = view.state.doc.line(docLine).from;
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 16 }),
    });
    view.focus();
  }

  return (
    <div style={shellStyle}>
      <TabBar
        docs={documents.map((d) => ({
          id: d.id,
          title: d.path ? d.path.split("/").pop()! : "Untitled",
          isDirty: d.isDirty,
        }))}
        activeId={activeId}
        onActivate={setActive}
        onClose={async (id) => {
          useDocuments.getState().closeDocument(id);
        }}
      />
      <div style={bodyStyle}>
        <aside style={asideStyle}>
          <div style={asideHeaderStyle}>
            <div style={brandStyle}>
              <Logo size={22} />
              <span>Evhan .MD</span>
            </div>
          </div>
          <div style={asideBodyStyle}>
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
            {active && (
              <>
                <div style={asideSectionLabelStyle}>Contents</div>
                <TOC headings={headings} onJump={(h) => jumpToHeading(h.line)} />
              </>
            )}
            {folder && (
              <>
                <div style={asideSectionLabelStyle} title={folder}>
                  {folder.split("/").pop() ?? folder}
                </div>
                <FileTree root={folder} onOpenFile={openFile} />
              </>
            )}
          </div>
        </aside>
        <main style={mainStyle}>
          <TopBar
            path={active?.path ?? null}
            wordCount={wordCount}
            saveState={active?.saveState ?? "idle"}
            isDirty={active?.isDirty ?? false}
            viewMode={active?.viewMode}
            onSetViewMode={active ? setViewMode : undefined}
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
            <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
              {active.viewMode === "preview" ? (
                <PreviewPane content={active.content} />
              ) : (
                <Editor
                  docId={active.id}
                  value={active.content}
                  onChange={(next) => setContent(active.id, next)}
                  readOnly={active.readOnly}
                  onReady={(view) => {
                    viewRef.current = view;
                  }}
                />
              )}
            </div>
          ) : (
            <div style={emptyStateStyle}>No file open. Use the sidebar to open one.</div>
          )}
          <StatusBar
            saveState={active?.saveState ?? "idle"}
            watcherOffline={watcherOffline}
          />
        </main>
      </div>
    </div>
  );
}
