import { useEffect, useMemo, useRef, useState } from "react";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { listen } from "@tauri-apps/api/event";
import { tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ConflictBanner } from "./components/ConflictBanner";
import { UpdateBanner } from "./components/UpdateBanner";
import { Editor } from "./components/Editor";
import { FolderPanel, ResizeHandle, TocPanel } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import { Tutorial } from "./components/Tutorial";
import { WysiwygEditor } from "./components/WysiwygEditor";
import { ensureWelcomeFile, fsList, fsRead, fsWrite, watcherSubscribe } from "./lib/ipc/commands";
import { renderMarkdown } from "./lib/markdown/pipeline";
import { buildStandaloneHtml } from "./lib/exportHtml";
import { extractHeadings, type Heading } from "./lib/toc";
import { slugify } from "./lib/slug";
import { useDocuments, type ViewMode } from "./state/documents";
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { useUpdater } from "./hooks/useUpdater";
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

export default function App() {
  const [watcherOffline, setWatcherOffline] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReplace, setSearchReplace] = useState(false);
  // Pending close request blocked by unsaved changes. null = no prompt up.
  const [closeConfirm, setCloseConfirm] = useState<{ id: string } | null>(null);
  const updater = useUpdater({ checkOnStartup: true });
  useWatcherEvents(setWatcherOffline);
  const { documents, activeId, openDocument, setActive, setContent } = useDocuments();
  const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();
  const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
  const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
  const active = documents.find((d) => d.id === activeId) ?? null;
  const viewRef = useRef<EditorView | null>(null);
  // Remembers the last (folderVisible, tocVisible) pair before Hide Both
  // collapsed them, so the second ⌘\ restores the user's setup.
  const preHideStateRef = useRef<{ folder: boolean; toc: boolean } | null>(null);

  // Apply zoom as a root CSS variable so editor / preview / chrome scale together.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-zoom", String(zoom));
  }, [zoom]);

  // Autosave is now per-document: the global preference seeds the default
  // at open time, but each doc has its own toggle (TopBar pill switch).
  const docAutosaveEnabled = active?.autosaveEnabled ?? autosaveEnabled;
  const { flush } = useAutosave({
    enabled: docAutosaveEnabled && !!active?.path && !active?.readOnly,
    debounceMs: autosaveDebounceMs,
    content: active?.content ?? "",
    isDirty: !!active?.isDirty,
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
    if (typeof picked === "string") {
      useDocuments.getState().setFolder(picked);
      // Auto-reveal the Folder Explorer panel. If the user had hidden it
      // (⌥⌘1 or the X close button), picking a new folder should show the
      // tree they just chose rather than silently stashing the selection.
      if (!usePreferences.getState().folderVisible) {
        usePreferences.getState().setFolderVisible(true);
        preHideStateRef.current = null;
      }
    }
  }

  function requestCloseDocument(id: string) {
    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    if (!doc) return;
    if (doc.isDirty) {
      // Unsaved work — stop and ask. The ConfirmDialog handles Save /
      // Don't Save / Cancel. We never auto-close a dirty buffer.
      setCloseConfirm({ id });
      return;
    }
    useDocuments.getState().closeDocument(id);
  }

  function closeActiveTab() {
    const id = useDocuments.getState().activeId;
    if (id) requestCloseDocument(id);
  }

  async function saveDocument(id: string): Promise<boolean> {
    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    if (!doc) return false;
    if (!doc.path) {
      // Untitled — fall back to Save As. Keeping this simple: cancel the
      // pending close if the user bails on the dialog.
      const target = await save({
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] }],
      });
      if (!target) return false;
      useDocuments.getState().setPath(id, target);
    }
    const path =
      useDocuments.getState().documents.find((d) => d.id === id)?.path ?? null;
    if (!path) return false;
    try {
      markSaveStarted(id);
      const r = await fsWrite(path, doc.content);
      markSaved(id, { content: doc.content, mtimeMs: r.mtime_ms });
      return true;
    } catch (e) {
      markSaveFailed(id, String(e));
      return false;
    }
  }

  function triggerFind(replace: boolean) {
    if (!active) return;
    // Respect the current view mode — don't auto-switch. Edit mode uses
    // CodeMirror's built-in search panel (Find and Replace are the same
    // panel in CM6). WYSIWYG opens our ProseMirror-decoration-based bar
    // with an optional replace row.
    if (active.viewMode === "edit") {
      requestAnimationFrame(() => {
        if (viewRef.current) openSearchPanel(viewRef.current);
      });
    } else {
      setSearchReplace(replace);
      setSearchOpen(true);
    }
  }

  async function exportHtml() {
    if (!active) return;
    try {
      const html = await renderMarkdown(active.content);
      const title = (active.path?.split("/").pop() ?? "document").replace(/\.md$/i, "");
      const standalone = buildStandaloneHtml(title, html);
      const suggested = active.path
        ? active.path.replace(/\.md$/i, ".html")
        : `${title}.html`;
      const chosen = await save({
        defaultPath: suggested,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!chosen) return;
      await fsWrite(chosen, standalone);
    } catch (e) {
      console.error("Export HTML failed:", e);
    }
  }

  async function printDocument() {
    if (!active) return;
    // WKWebView swallows window.print() calls routed through the menu IPC
    // — the user gesture is lost. Write a standalone HTML file to the OS
    // temp directory and open it in the default browser, where Cmd+P works
    // reliably and macOS's "Save as PDF" option in the print dialog handles
    // PDF export.
    try {
      const html = await renderMarkdown(active.content);
      const title = (active.path?.split("/").pop() ?? "document").replace(/\.md$/i, "");
      const standalone = buildStandaloneHtml(title, html);
      const dir = await tempDir();
      const sep = dir.endsWith("/") || dir.endsWith("\\") ? "" : "/";
      const safeName = title.replace(/[^\w.\- ]+/g, "_") || "document";
      const tmpPath = `${dir}${sep}yeogi-print-${Date.now()}-${safeName}.html`;
      await fsWrite(tmpPath, standalone);
      // openPath routes .html through the OS default handler — Safari on
      // macOS — where Cmd+P's print dialog has "Save as PDF" built in.
      await openPath(tmpPath);
    } catch (e) {
      console.error("Print failed:", e);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const persisted = loadPersistedSession();
    const stop = startSessionPersistence();
    // Restore the folder sidebar selection before the existence-check
    // effect (declared below) runs, so it can verify the folder is still
    // on disk and clear it if not.
    if (persisted?.folder) {
      useDocuments.getState().setFolder(persisted.folder);
    }
    (async () => {
      if (persisted && persisted.paths.length > 0) {
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
        return;
      }
      // Fresh start (nothing persisted). Seed a welcome file + show the
      // first-run tutorial once per machine.
      const welcomeKey = "yeogi-md-editor:welcome-shown";
      if (localStorage.getItem(welcomeKey)) return;
      try {
        const welcomePath = await ensureWelcomeFile();
        if (cancelled) return;
        await openFile(welcomePath);
        localStorage.setItem(welcomeKey, "true");
        if (!localStorage.getItem("yeogi-md-editor:tutorial-shown")) {
          setTutorialOpen(true);
        }
      } catch (e) {
        console.warn("welcome file setup failed:", e);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the persisted folder no longer exists on disk, silently clear it.
  // Runs once on mount; session-load precedes this so `folder` is already
  // in place by the time we check.
  useEffect(() => {
    const f = useDocuments.getState().folder;
    if (!f) return;
    fsList(f).catch(() => {
      useDocuments.getState().setFolder(null);
    });
  }, []);

  // Finder "Open With" routes through RunEvent::Opened on the Rust side,
  // which emits "files-opened" with the selected paths. Wire each through
  // the normal openFile flow; openDocument dedupes by path.
  useEffect(() => {
    const p = listen<string[]>("files-opened", async (e) => {
      for (const path of e.payload) {
        try {
          await openFile(path);
        } catch (err) {
          console.warn("files-opened: skipping", path, err);
        }
      }
    });
    return () => {
      p.then((fn) => fn());
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
          exportHtml().catch(console.error);
          break;
        case "file:print":
          printDocument().catch(console.error);
          break;
        case "file:close-tab":
          closeActiveTab();
          break;
        case "file:close-folder": {
          useDocuments.getState().setFolder(null);
          break;
        }
        case "edit:find":
          triggerFind(false);
          break;
        case "edit:find-replace":
          triggerFind(true);
          break;
        case "view:toggle-folder-panel": {
          const { folderVisible, setFolderVisible } = usePreferences.getState();
          setFolderVisible(!folderVisible);
          preHideStateRef.current = null;
          break;
        }
        case "view:toggle-toc-panel": {
          const { tocVisible, setTocVisible } = usePreferences.getState();
          setTocVisible(!tocVisible);
          preHideStateRef.current = null;
          break;
        }
        case "view:hide-all-sidebars": {
          const { folderVisible, tocVisible, setFolderVisible, setTocVisible } =
            usePreferences.getState();
          if (folderVisible || tocVisible) {
            preHideStateRef.current = { folder: folderVisible, toc: tocVisible };
            setFolderVisible(false);
            setTocVisible(false);
          } else {
            const restore = preHideStateRef.current ?? { folder: true, toc: true };
            setFolderVisible(restore.folder);
            setTocVisible(restore.toc);
            preHideStateRef.current = null;
          }
          break;
        }
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
        case "help:show-tutorial":
          setTutorialOpen(true);
          break;
        case "help:check-for-updates":
          updater.runCheck();
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

  // When the user toggles between WYSIWYG and Edit we remember which
  // heading was at the top of the previous viewport so the target view
  // can scroll to the same spot. Kept in a ref (not state) so storing it
  // doesn't trigger a re-render between the snapshot and the view swap.
  //
  // Scoped to `docId` because the ref outlives a tab switch — without the
  // scope, rapidly flipping tabs during the polling window could apply a
  // heading index captured against doc A to doc B's viewport. The effect
  // below bails out if the pending ref isn't for the currently active doc.
  const pendingScrollHeadingRef = useRef<{ docId: string; index: number } | null>(null);

  // Returns the index INTO `headings` (the extract-headings result, not the
  // DOM). The WYSIWYG DOM can hold extra `<h1..h6>` elements that aren't in
  // our TOC list (Tiptap-rendered frontmatter, headings-inside-nodes, etc.),
  // so we match the topmost visible DOM heading back to `headings` by slug +
  // level before returning — otherwise the captured index would drift when
  // the destination mode doesn't have the same extras.
  function captureTopHeadingIndex(mode: ViewMode): number | null {
    if (!active || headings.length === 0) return null;
    if (mode === "wysiwyg") {
      const scroller = document.querySelector(".wysiwyg-scroll");
      if (!scroller) return null;
      const viewportTop = scroller.getBoundingClientRect().top + 12;
      const els = document.querySelectorAll<HTMLElement>(
        ".wysiwyg-content .ProseMirror h1, .wysiwyg-content .ProseMirror h2, " +
          ".wysiwyg-content .ProseMirror h3, .wysiwyg-content .ProseMirror h4, " +
          ".wysiwyg-content .ProseMirror h5, .wysiwyg-content .ProseMirror h6",
      );
      let topEl: HTMLElement | null = null;
      for (const el of Array.from(els)) {
        if (el.getBoundingClientRect().top <= viewportTop) topEl = el;
        else break;
      }
      if (!topEl) return null;
      const wantSlug = slugify(topEl.textContent ?? "");
      const wantLevel = parseInt(topEl.tagName.slice(1), 10);
      // Count prior DOM headings with the same slug+level so we pick the
      // matching occurrence out of `headings` (not the first one, which
      // could be a different paragraph entirely).
      let occurrence = 0;
      for (const el of Array.from(els)) {
        if (el === topEl) break;
        const lv = parseInt(el.tagName.slice(1), 10);
        if (lv === wantLevel && slugify(el.textContent ?? "") === wantSlug) {
          occurrence++;
        }
      }
      let seen = 0;
      for (let i = 0; i < headings.length; i++) {
        if (
          headings[i].level === wantLevel &&
          slugify(headings[i].text) === wantSlug
        ) {
          if (seen === occurrence) return i;
          seen++;
        }
      }
      return null;
    }
    const view = viewRef.current;
    if (!view) return null;
    const topBlock = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
    const lineNum = view.state.doc.lineAt(topBlock.from).number;
    let last = -1;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].line <= lineNum) last = i;
      else break;
    }
    return last >= 0 ? last : null;
  }

  function setViewMode(mode: ViewMode) {
    if (!active) return;
    if (active.viewMode !== mode) {
      const captured = captureTopHeadingIndex(active.viewMode);
      pendingScrollHeadingRef.current =
        captured != null ? { docId: active.id, index: captured } : null;
    }
    useDocuments.getState().setViewMode(active.id, mode);
  }

  // After a view-mode flip, scroll the newly mounted editor to the
  // heading we snapshotted in setViewMode. The new editor mounts async
  // (CodeMirror sets viewRef via onReady; the WYSIWYG DOM needs a paint),
  // so we poll briefly for readiness before giving up.
  useEffect(() => {
    if (!active) return;
    const pending = pendingScrollHeadingRef.current;
    if (!pending) return;
    if (pending.docId !== active.id) {
      // Captured against a different doc (user switched tabs during the
      // poll window). Drop it so a heading index from doc A can't scroll
      // doc B to a meaningless position.
      pendingScrollHeadingRef.current = null;
      return;
    }
    const idx = pending.index;
    const h = headings[idx];
    if (!h) {
      pendingScrollHeadingRef.current = null;
      return;
    }
    let cancelled = false;
    let tries = 0;
    function attempt() {
      if (cancelled || !active) return;
      const ready =
        active.viewMode === "edit"
          ? viewRef.current != null
          : document.querySelector(".wysiwyg-content .ProseMirror") != null;
      if (!ready) {
        if (tries++ < 15) {
          setTimeout(attempt, 30);
          return;
        }
        pendingScrollHeadingRef.current = null;
        return;
      }
      pendingScrollHeadingRef.current = null;
      jumpToHeading(h, idx);
    }
    const handle = window.setTimeout(attempt, 16);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.viewMode, active?.id]);

  function jumpToHeading(h: Heading, tocIndex: number) {
    if (!active) return;
    // Respect the current view mode — don't auto-switch.
    if (active.viewMode === "wysiwyg") {
      const scroller = document.querySelector<HTMLElement>(".wysiwyg-scroll");
      const root = document.querySelector(".wysiwyg-content .ProseMirror");
      if (!scroller || !root) return;
      // Match by slug(text) + level instead of DOM index. The DOM order
      // drifts from the TOC order when the WYSIWYG hides a heading (the
      // Frontmatter node is `display: none` but its inner HTML may include
      // heading-like elements; headings INSIDE table cells/footnotes also
      // get matched by the blanket `h1..h6` query). Slug+level pins us to
      // the user-meaningful heading regardless of where it lands in DOM.
      const wantSlug = slugify(h.text);
      // Disambiguate duplicates by counting identical headings that appear
      // earlier in the TOC: that many DOM matches should be skipped.
      let occurrence = 0;
      for (let k = 0; k < tocIndex; k++) {
        const prev = headings[k];
        if (prev.level === h.level && slugify(prev.text) === wantSlug) {
          occurrence++;
        }
      }
      const headingEls = Array.from(
        root.querySelectorAll<HTMLElement>(`h${h.level}`),
      ).filter((el) => slugify(el.textContent ?? "") === wantSlug);
      const target =
        headingEls[Math.min(occurrence, headingEls.length - 1)] ??
        headingEls[0];
      if (!target) return;
      // scrollIntoView({ block: "start" }) anchors the heading at the scroll
      // container's top — but the sticky ribbon toolbar covers the first
      // ~48 px, so headings near the bottom of a long doc land *behind* it.
      // Compute the offset manually and subtract a safety margin.
      const tRect = target.getBoundingClientRect();
      const sRect = scroller.getBoundingClientRect();
      const SAFETY_TOP = 12;
      const targetTop = scroller.scrollTop + (tRect.top - sRect.top) - SAFETY_TOP;
      scroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    const docLine = Math.min(Math.max(h.line, 1), view.state.doc.lines);
    const pos = view.state.doc.line(docLine).from;
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 16 }),
    });
    view.focus();
  }

  // Three-column layout: [Folder] [Outline] [Editor]. Columns collapse when
  // their panel is hidden. Widths come from usePreferences so they persist.
  const folder = useDocuments((s) => s.folder);
  const folderVisible = usePreferences((s) => s.folderVisible);
  const tocVisible = usePreferences((s) => s.tocVisible);
  const folderWidth = usePreferences((s) => s.folderWidth);
  const tocWidth = usePreferences((s) => s.tocWidth);
  const { setFolderWidth, setTocWidth } = usePreferences.getState();

  const showFolder = folderVisible && folder != null;
  const showToc = tocVisible && active != null;

  const templateParts: string[] = [];
  if (showFolder) templateParts.push(`${folderWidth}px`, "4px");
  if (showToc) templateParts.push(`${tocWidth}px`, "4px");
  templateParts.push("minmax(320px, 1fr)");

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: templateParts.join(" "),
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
        onClose={(id) => requestCloseDocument(id)}
        onNew={() => pickAndOpenFiles().catch(console.error)}
      />
      <div style={bodyStyle}>
        {showFolder && (
          <>
            <FolderPanel
              folder={folder}
              onPickFolder={() => pickAndOpenFolder().catch(console.error)}
              onOpenFile={(p) => openFile(p).catch(console.error)}
              onClose={() => {
                usePreferences.getState().setFolderVisible(false);
                preHideStateRef.current = null;
              }}
            />
            <ResizeHandle
              width={folderWidth}
              min={180}
              max={480}
              onChange={setFolderWidth}
            />
          </>
        )}
        {showToc && (
          <>
            <TocPanel
              hasDocument={active != null}
              headings={headings}
              onJump={(h, i) => jumpToHeading(h, i)}
              onClose={() => {
                usePreferences.getState().setTocVisible(false);
                preHideStateRef.current = null;
              }}
            />
            <ResizeHandle
              width={tocWidth}
              min={180}
              max={480}
              onChange={setTocWidth}
            />
          </>
        )}
        <main style={mainStyle}>
          <TopBar
            path={active?.path ?? null}
            wordCount={wordCount}
            saveState={active?.saveState ?? "idle"}
            isDirty={active?.isDirty ?? false}
            viewMode={active?.viewMode}
            onSetViewMode={active ? setViewMode : undefined}
            autosaveEnabled={active ? docAutosaveEnabled : undefined}
            onSetAutosaveEnabled={
              active
                ? (v) => useDocuments.getState().setAutosaveEnabled(active.id, v)
                : undefined
            }
          />
          <UpdateBanner
            status={updater.status}
            onInstall={(u) => updater.applyUpdate(u)}
            onDismiss={updater.dismiss}
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
              {active.viewMode === "wysiwyg" ? (
                <WysiwygEditor
                  key={active.id}
                  content={active.content}
                  onChange={(next) => setContent(active.id, next)}
                  readOnly={active.readOnly}
                  searchOpen={searchOpen}
                  searchReplace={searchReplace}
                  onSearchClose={() => setSearchOpen(false)}
                />
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
                style={{ minWidth: 130, justifyContent: "center" }}
                onClick={() => pickAndOpenFiles().catch(console.error)}
              >
                Open file(s)…
              </button>
              <div style={{ fontSize: 12, color: "var(--text-faint)" }}>or</div>
              <button
                className="btn-primary"
                style={{ minWidth: 130, justifyContent: "center" }}
                onClick={() => pickAndOpenFolder().catch(console.error)}
              >
                Open folder…
              </button>
            </div>
          )}
          <StatusBar
            saveState={active?.saveState ?? "idle"}
            watcherOffline={watcherOffline}
          />
        </main>
      </div>
      {tutorialOpen && (
        <Tutorial
          onClose={() => {
            setTutorialOpen(false);
            localStorage.setItem("yeogi-md-editor:tutorial-shown", "true");
          }}
        />
      )}
      {closeConfirm &&
        (() => {
          const doc = documents.find((d) => d.id === closeConfirm.id);
          const name = doc?.path
            ? doc.path.split("/").pop()
            : "this document";
          return (
            <ConfirmDialog
              title={`Save changes to ${name}?`}
              message={
                <>
                  You have unsaved changes in <strong>{name}</strong>. Closing without
                  saving will discard them.
                </>
              }
              confirmLabel="Save"
              discardLabel="Don't Save"
              cancelLabel="Cancel"
              onConfirm={async () => {
                const ok = await saveDocument(closeConfirm.id);
                if (!ok) return; // Save failed — keep the dialog + the doc open.
                const idToClose = closeConfirm.id;
                setCloseConfirm(null);
                useDocuments.getState().closeDocument(idToClose);
              }}
              onDiscard={() => {
                const idToClose = closeConfirm.id;
                setCloseConfirm(null);
                useDocuments.getState().closeDocument(idToClose);
              }}
              onCancel={() => setCloseConfirm(null)}
            />
          );
        })()}
    </div>
  );
}
