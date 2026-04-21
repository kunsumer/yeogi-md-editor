import { useEffect, useMemo, useRef, useState } from "react";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { ConflictBanner } from "./components/ConflictBanner";
import { Editor } from "./components/Editor";
import { FileTree } from "./components/FileTree";
import { Logo } from "./components/Logo";
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
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  color: "var(--text-faint)",
  fontSize: 13,
};

const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 600,
  fontSize: 14,
  color: "var(--text)",
  letterSpacing: 0.1,
};

export default function App() {
  const [folder, setFolder] = useState<string | null>(null);
  const [watcherOffline, setWatcherOffline] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [zoom, setZoom] = useState(1);
  useWatcherEvents(setWatcherOffline);
  const { documents, activeId, openDocument, setActive, setContent } = useDocuments();
  const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();
  const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
  const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
  const active = documents.find((d) => d.id === activeId) ?? null;
  const viewRef = useRef<EditorView | null>(null);

  // Apply zoom as a root CSS variable so editor / preview / chrome scale together.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-zoom", String(zoom));
  }, [zoom]);

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

  async function pickAndOpenFiles() {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    const list = Array.isArray(picked) ? picked : typeof picked === "string" ? [picked] : [];
    for (const p of list) {
      try {
        await openFile(p);
      } catch (e) {
        console.error("openFile failed:", p, e);
      }
    }
  }

  async function pickAndOpenFolder() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") setFolder(picked);
  }

  function closeActiveTab() {
    const id = useDocuments.getState().activeId;
    if (id) useDocuments.getState().closeDocument(id);
  }

  function triggerFind() {
    if (!active) return;
    const s = useDocuments.getState();
    if (active.viewMode !== "edit") s.setViewMode(active.id, "edit");
    // Wait one tick so the editor remounts before we open the panel.
    requestAnimationFrame(() => {
      if (viewRef.current) openSearchPanel(viewRef.current);
    });
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

  // Native menu bridge: Rust emits "menu" with the item id as the payload.
  useEffect(() => {
    const p = listen<string>("menu", (e) => {
      const id = e.payload;
      switch (id) {
        case "file:open":
          pickAndOpenFiles().catch(console.error);
          break;
        case "file:open-folder":
          pickAndOpenFolder().catch(console.error);
          break;
        case "file:open-recent":
          // Stub: session restore already handles "last open". A real recent-
          // files menu lives behind a preference store (Phase 13 material).
          console.info("Open Recent: not yet implemented.");
          break;
        case "file:export-html":
        case "file:print":
          console.info(`${id}: Phase 12 — export pipeline.`);
          break;
        case "file:close-tab":
          closeActiveTab();
          break;
        case "edit:find":
        case "edit:find-replace":
          triggerFind();
          break;
        case "view:toggle-sidebar":
          setSidebarVisible((v) => !v);
          break;
        case "view:cycle-theme":
          // Stub — themes land in Phase 13.
          console.info("Cycle Theme: not yet implemented.");
          break;
        case "view:zoom-in":
          setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
          break;
        case "view:zoom-out":
          setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)));
          break;
        case "view:zoom-reset":
          setZoom(1);
          break;
        default:
          console.info("menu:", id);
      }
    });
    return () => {
      p.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.viewMode]);

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

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: sidebarVisible ? "260px 1fr" : "1fr",
  };

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
        {sidebarVisible && (
          <aside style={asideStyle}>
            <div style={asideHeaderStyle}>
              <div style={brandStyle}>
                <Logo size={28} />
                <span>Evhan .MD</span>
              </div>
            </div>
            <div style={asideBodyStyle}>
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
              {!active && !folder && (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "8px 6px" }}>
                  Use File → Open… (⌘O) to get started.
                </div>
              )}
            </div>
          </aside>
        )}
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
            <div style={emptyStateStyle}>
              <div>No file open.</div>
              <button
                className="btn-primary"
                onClick={() => pickAndOpenFiles().catch(console.error)}
              >
                Open file(s)…
              </button>
            </div>
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
