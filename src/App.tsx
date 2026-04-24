import { useEffect, useMemo, useRef, useState } from "react";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { listen } from "@tauri-apps/api/event";
import { tempDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { open, save } from "@tauri-apps/plugin-dialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EditorPane } from "./components/EditorPane";
import { FolderPanel, ResizeHandle, TocPanel } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Tutorial } from "./components/Tutorial";
import { ensureWelcomeFile, fsList, fsRead, fsWrite, syncMenuState, watcherSubscribe } from "./lib/ipc/commands";
import { renderMarkdown } from "./lib/markdown/pipeline";
import { buildStandaloneHtml } from "./lib/exportHtml";
import { extractBlocks, extractHeadings, type Block, type Heading } from "./lib/toc";
import { slugify } from "./lib/slug";
import { useDocuments } from "./state/documents";
import { useLayout, type ViewMode } from "./state/layout";
import { usePreferences } from "./state/preferences";
import { applyThemeToDOM, resolveTheme } from "./lib/themes";
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


export default function App() {
  const [watcherOffline, setWatcherOffline] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchReplace, setSearchReplace] = useState(false);
  // Pending close request blocked by unsaved changes. null = no prompt up.
  const [closeConfirm, setCloseConfirm] = useState<
    { id: string; paneId: "primary" | "secondary" } | null
  >(null);
  const updater = useUpdater({ checkOnStartup: true });
  useWatcherEvents(setWatcherOffline);
  const { documents, openDocument, setContent } = useDocuments();
  const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();
  const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
  const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
  const { focusedPaneId, primary, secondary } = useLayout();
  const paneSplit = useLayout((s) => s.paneSplit);
  const setPaneSplit = useLayout.getState().setPaneSplit;
  const focusedPane = focusedPaneId === "primary" ? primary : secondary;
  const activeDocId = focusedPane?.activeTabId ?? null;
  const active = documents.find((d) => d.id === activeDocId) ?? null;
  const viewRef = useRef<EditorView | null>(null);
  // Remembers the last (folderVisible, tocVisible) pair before Hide Both
  // collapsed them, so the second ⌘\ restores the user's setup.
  const preHideStateRef = useRef<{ folder: boolean; toc: boolean } | null>(null);

  // Apply zoom as a root CSS variable so editor / preview / chrome scale together.
  useEffect(() => {
    document.documentElement.style.setProperty("--app-zoom", String(zoom));
  }, [zoom]);

  // Sync the persisted MRU + theme preference to the native menu. Runs
  // once at mount (after zustand-persist has hydrated) and any time either
  // dependency changes. The subscriber approach keeps the menu and the
  // preference store in lockstep without coupling the store to Tauri IPC.
  const recentFiles = usePreferences((s) => s.recentFiles);
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    syncMenuState(recentFiles, theme).catch((err) => {
      console.warn("sync_menu_state failed:", err);
    });
  }, [recentFiles, theme]);

  // Apply the user's theme preference to <html> via CSS variables. When
  // `theme === "system"`, resolve to Light or Dark based on prefers-color-
  // scheme and flip live if the OS appearance changes. Any named theme
  // (e.g. "github-light", "dracula") is applied verbatim.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyThemeToDOM(resolveTheme(theme));
    };
    apply();
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

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

  async function openFile(path: string, opts?: { toSide: boolean }) {
    const existing = useDocuments.getState().documents.find((d) => d.path === path);
    if (existing) {
      if (opts?.toSide) useLayout.getState().openToTheSide(existing.id);
      else useLayout.getState().openInFocusedPane(existing.id);
      usePreferences.getState().pushRecent(path);
      return;
    }
    const r = await fsRead(path);
    openDocument({
      path,
      content: r.content,
      savedMtime: r.mtime_ms,
      encoding: r.encoding,
    });
    await watcherSubscribe(path);
    if (opts?.toSide) {
      // openDocument's bridge already pushed into the focused pane. Promote
      // to secondary now that the doc exists.
      const doc = useDocuments.getState().documents.find((d) => d.path === path);
      if (doc) useLayout.getState().openToTheSide(doc.id);
    }
    usePreferences.getState().pushRecent(path);
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

  function createBlankDocument() {
    // New untitled in-memory buffer — path is null until Save As promotes it.
    // Bridge from openDocument pushes into focused pane + activates.
    openDocument({
      path: null,
      content: "",
      savedMtime: 0,
      encoding: "utf-8",
    });
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

  /**
   * Pane-aware close. Removing a tab from one pane must not close the doc in
   * the other pane if it's still there (case d: same doc open in both sides).
   * Only drop the underlying buffer once the doc is orphaned from both panes.
   */
  function requestClosePaneTab(
    paneId: "primary" | "secondary",
    docId: string,
  ) {
    const doc = useDocuments.getState().documents.find((d) => d.id === docId);
    if (!doc) return;
    const layout = useLayout.getState();
    const otherPane = paneId === "primary" ? layout.secondary : layout.primary;
    const existsInOtherPane = !!otherPane?.tabs.includes(docId);

    if (existsInOtherPane) {
      // Buffer stays alive on the other side. Safe to just drop the tab here
      // without a dirty-check prompt — no data loss possible.
      useLayout.getState().closeTab(paneId, docId);
      return;
    }

    if (doc.isDirty) {
      // Unsaved and this is the last pane holding it — prompt before losing
      // the buffer.
      setCloseConfirm({ id: docId, paneId });
      return;
    }
    useLayout.getState().closeTab(paneId, docId);
    useDocuments.getState().closeDocument(docId);
  }

  function closeActiveTab() {
    const id = focusedPane?.activeTabId ?? null;
    if (id) requestClosePaneTab(focusedPaneId, id);
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

  /**
   * Save As: always prompt for a destination, even if the doc already has a
   * path. Writes the current buffer to the chosen location and re-points
   * the open document at that new path (so subsequent saves go there).
   */
  async function saveDocumentAs(id: string): Promise<boolean> {
    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    if (!doc) return false;
    const target = await save({
      defaultPath: doc.path ?? undefined,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] }],
    });
    if (!target) return false;
    try {
      markSaveStarted(id);
      const r = await fsWrite(target, doc.content);
      useDocuments.getState().setPath(id, target);
      markSaved(id, { content: doc.content, mtimeMs: r.mtime_ms });
      // Subscribe the watcher to the new path so external-change detection
      // works on the copy too. Best-effort; failures just skip watching.
      watcherSubscribe(target).catch(() => {});
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
    const currentViewMode = focusedPane?.viewMode ?? "wysiwyg";
    if (currentViewMode === "edit") {
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
        if (cancelled) return;

        // Rebuild layout from persisted layout. Migration in loadPersistedSession
        // guarantees the layout field is always present.
        if (persisted.layout) {
          const docs = useDocuments.getState().documents;
          const pathToId = new Map<string, string>();
          for (const d of docs) if (d.path) pathToId.set(d.path, d.id);

          function buildPane(
            p: { tabPaths: string[]; activeTabPath: string | null; viewMode: "edit" | "wysiwyg" },
            id: "primary" | "secondary",
          ) {
            const tabs = p.tabPaths
              .map((path) => pathToId.get(path))
              .filter((x): x is string => !!x);
            const activeTabId = p.activeTabPath ? pathToId.get(p.activeTabPath) ?? null : null;
            return { id, tabs, activeTabId, viewMode: p.viewMode };
          }

          const primaryPane = buildPane(persisted.layout.primary, "primary");
          let secondaryPane = persisted.layout.secondary
            ? buildPane(persisted.layout.secondary, "secondary")
            : null;
          if (secondaryPane && secondaryPane.tabs.length === 0) secondaryPane = null;

          let focusedPaneId = persisted.layout.focusedPaneId;
          if (focusedPaneId === "secondary" && !secondaryPane) focusedPaneId = "primary";

          useLayout.setState({
            primary: primaryPane,
            secondary: secondaryPane,
            focusedPaneId,
            paneSplit: persisted.layout.paneSplit,
          });
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
      // File → Open Recent → <path> and File → Open Recent → Clear Menu are
      // dynamic, so they come through with computed ids rather than a fixed
      // constant. Handle them before the static switch.
      if (id === "file:recent-clear") {
        usePreferences.getState().clearRecent();
        return;
      }
      if (id.startsWith("file:recent:")) {
        const path = id.slice("file:recent:".length);
        if (path && path !== "placeholder") {
          openFile(path).catch(console.error);
        }
        return;
      }
      if (id.startsWith("view:theme:")) {
        // e.g. view:theme:system, view:theme:dracula. Trust the frontend
        // list of valid ids — any unknown value falls back in resolveTheme.
        const themeId = id.slice("view:theme:".length) as Parameters<
          ReturnType<typeof usePreferences.getState>["setTheme"]
        >[0];
        usePreferences.getState().setTheme(themeId);
        return;
      }
      switch (id) {
        case "file:open":
          pickAndOpenFiles().catch(console.error);
          break;
        case "file:open-folder":
          pickAndOpenFolder().catch(console.error);
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
        case "view:toggle-edit-mode": {
          if (!active) break;
          const currentMode = focusedPane?.viewMode ?? "wysiwyg";
          setViewMode(currentMode === "wysiwyg" ? "edit" : "wysiwyg");
          break;
        }
        // view:theme:<id> — handled before the switch via the startsWith
        // branch below. Keeping the switch clean of a dozen cases.
        case "file:save":
          if (active) saveDocument(active.id).catch(console.error);
          break;
        case "file:save-as":
          if (active) saveDocumentAs(active.id).catch(console.error);
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
  }, [active?.id, focusedPane?.viewMode]);

  const headings = useMemo(
    () => (active ? extractHeadings(active.content) : []),
    [active?.content, active?.id],
  );

  // Top-level block anchors used for view-mode scroll sync. Wider than
  // `headings` (includes paragraphs, lists, code, tables, etc.) so the
  // WYSIWYG ↔ Edit swap lands closer to the actual viewport position
  // rather than jumping up to the last heading above it.
  const blocks = useMemo<Block[]>(
    () => (active ? extractBlocks(active.content) : []),
    [active?.content, active?.id],
  );

  // When the user toggles between WYSIWYG and Edit we remember which
  // top-level block was at the top of the previous viewport so the target
  // view can scroll to the same spot. Kept in a ref (not state) so storing
  // it doesn't trigger a re-render between the snapshot and the view swap.
  //
  // Scoped to `docId` because the ref outlives a tab switch — without the
  // scope, rapidly flipping tabs during the polling window could apply an
  // index captured against doc A to doc B's viewport. The effect below
  // bails out if the pending ref isn't for the currently active doc.
  const pendingScrollBlockRef = useRef<{ docId: string; index: number } | null>(null);

  // Direct top-level DOM children of the WYSIWYG content root that correspond
  // to renderable markdown blocks. We filter out hidden nodes (Frontmatter
  // renders as `display: none`) and Tiptap's trailing empty paragraph so the
  // returned array stays aligned with `blocks` (the mdast-derived anchor list).
  function wysiwygVisibleBlockEls(): HTMLElement[] {
    const root = document.querySelector(".wysiwyg-content .ProseMirror");
    if (!root) return [];
    const out: HTMLElement[] = [];
    const children = Array.from(root.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      // Hidden (display:none / detached)
      if (el.offsetParent === null && el.tagName !== "BODY") continue;
      // Tiptap appends a bare empty <p></p> at the end as a caret-ready slot.
      // Skip it when it's the last child and contains no rendered content.
      const isLast = i === children.length - 1;
      if (
        isLast &&
        el.tagName === "P" &&
        el.children.length === 0 &&
        (el.textContent ?? "").trim() === ""
      ) {
        continue;
      }
      out.push(el);
    }
    return out;
  }

  // Returns the index into `blocks` (mdast top-level blocks) that's
  // currently at the top of the viewport for the given mode, or null if the
  // viewport is above the first anchor.
  function captureTopBlockIndex(mode: ViewMode): number | null {
    if (!active || blocks.length === 0) return null;
    if (mode === "wysiwyg") {
      const scroller = document.querySelector(".wysiwyg-scroll");
      if (!scroller) return null;
      const viewportTop = scroller.getBoundingClientRect().top + 12;
      const els = wysiwygVisibleBlockEls();
      let topIdx = -1;
      for (let i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().top <= viewportTop) topIdx = i;
        else break;
      }
      if (topIdx < 0) return null;
      // If DOM and mdast counts drift, clamp so we don't index past the end.
      return Math.min(topIdx, blocks.length - 1);
    }
    const view = viewRef.current;
    if (!view) return null;
    const topLineBlock = view.lineBlockAtHeight(view.scrollDOM.scrollTop);
    const lineNum = view.state.doc.lineAt(topLineBlock.from).number;
    let last = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].line <= lineNum) last = i;
      else break;
    }
    return last >= 0 ? last : null;
  }

  function setViewMode(mode: ViewMode) {
    if (!active || !focusedPane) return;
    if (focusedPane.viewMode !== mode) {
      const captured = captureTopBlockIndex(focusedPane.viewMode);
      pendingScrollBlockRef.current =
        captured != null ? { docId: active.id, index: captured } : null;
    }
    useLayout.getState().setViewMode(focusedPaneId, mode);
  }

  // After a view-mode flip, scroll the newly mounted editor to the block
  // we snapshotted in setViewMode. The new editor mounts async (CodeMirror
  // sets viewRef via onReady; the WYSIWYG DOM needs a paint), so poll
  // briefly for readiness before giving up.
  useEffect(() => {
    if (!active) return;
    const pending = pendingScrollBlockRef.current;
    if (!pending) return;
    if (pending.docId !== active.id) {
      pendingScrollBlockRef.current = null;
      return;
    }
    const idx = pending.index;
    if (idx < 0 || idx >= blocks.length) {
      pendingScrollBlockRef.current = null;
      return;
    }
    let cancelled = false;
    let tries = 0;
    const currentViewMode = focusedPane?.viewMode ?? "wysiwyg";
    function attempt() {
      if (cancelled || !active) return;
      const ready =
        currentViewMode === "edit"
          ? viewRef.current != null
          : document.querySelector(".wysiwyg-content .ProseMirror") != null;
      if (!ready) {
        if (tries++ < 15) {
          setTimeout(attempt, 30);
          return;
        }
        pendingScrollBlockRef.current = null;
        return;
      }
      pendingScrollBlockRef.current = null;
      jumpToBlock(idx);
    }
    const handle = window.setTimeout(attempt, 16);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedPane?.viewMode, active?.id]);

  // Scroll the current view to block[index]. WYSIWYG: target the i-th
  // visible top-level DOM child. Edit: jump to the block's source line.
  function jumpToBlock(index: number) {
    if (!active) return;
    const b = blocks[index];
    if (!b) return;
    if ((focusedPane?.viewMode ?? "wysiwyg") === "wysiwyg") {
      const scroller = document.querySelector<HTMLElement>(".wysiwyg-scroll");
      if (!scroller) return;
      const els = wysiwygVisibleBlockEls();
      const target = els[Math.min(index, els.length - 1)];
      if (!target) return;
      const tRect = target.getBoundingClientRect();
      const sRect = scroller.getBoundingClientRect();
      const SAFETY_TOP = 12;
      const targetTop = scroller.scrollTop + (tRect.top - sRect.top) - SAFETY_TOP;
      scroller.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      return;
    }
    const view = viewRef.current;
    if (!view) return;
    const docLine = Math.min(Math.max(b.line, 1), view.state.doc.lines);
    const pos = view.state.doc.line(docLine).from;
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 16 }),
    });
    view.focus();
  }

  function jumpToHeading(h: Heading, tocIndex: number) {
    if (!active) return;
    // Respect the current view mode — don't auto-switch.
    if ((focusedPane?.viewMode ?? "wysiwyg") === "wysiwyg") {
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
  if (secondary) {
    templateParts.push(
      `minmax(320px, ${paneSplit}fr)`,
      "4px",
      `minmax(320px, ${1 - paneSplit}fr)`,
    );
  } else {
    templateParts.push("minmax(320px, 1fr)");
  }

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: templateParts.join(" "),
  };

  const paneProps = {
    documents,
    onOpenFiles: () => pickAndOpenFiles().catch(console.error),
    onOpenFolder: () => pickAndOpenFolder().catch(console.error),
    onCreateBlank: createBlankDocument,
    onCloseTab: (paneId: "primary" | "secondary", id: string) =>
      requestClosePaneTab(paneId, id),
    onActivateTab: (paneId: "primary" | "secondary", id: string) =>
      useLayout.getState().setActiveTab(paneId, id),
    onOpenToSide: (id: string, sourcePaneId: "primary" | "secondary") =>
      useLayout.getState().openInOtherPane(sourcePaneId, id),
    onSetViewMode: (paneId: "primary" | "secondary", mode: ViewMode) => {
      if (paneId === focusedPaneId) setViewMode(mode);
      else useLayout.getState().setViewMode(paneId, mode);
    },
    onFocusPane: (paneId: "primary" | "secondary") =>
      useLayout.getState().setFocusedPane(paneId),
    onSetContent: (id: string, next: string) => setContent(id, next),
    onSetAutosaveEnabled: (id: string, enabled: boolean) =>
      useDocuments.getState().setAutosaveEnabled(id, enabled),
  };

  return (
    <div style={shellStyle}>
      <div style={bodyStyle}>
        {showFolder && (
          <>
            <FolderPanel
              folder={folder}
              onPickFolder={() => pickAndOpenFolder().catch(console.error)}
              onOpenFile={(p, opts) => openFile(p, opts).catch(console.error)}
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
              activeDocPath={active?.path ?? null}
              folder={folder}
              onJump={(h, i) => jumpToHeading(h, i)}
              onOpenBacklink={(p) => openFile(p).catch(console.error)}
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
        <EditorPane
          pane={primary}
          isFocused={focusedPaneId === "primary"}
          otherPaneActiveTabId={secondary?.activeTabId ?? null}
          {...paneProps}
          searchOpen={searchOpen}
          searchReplace={searchReplace}
          onSearchClose={() => setSearchOpen(false)}
          onEditorReady={(view) => {
            viewRef.current = view;
          }}
          updateStatus={updater.status}
          onUpdateInstall={(u) => updater.applyUpdate(u)}
          onUpdateDismiss={updater.dismiss}
          onConflictKeep={async () => {
            if (!active) return;
            useDocuments.getState().setConflict(active.id, null);
            if (flushRef.current) await flushRef.current();
          }}
          onConflictReload={async () => {
            if (!active?.path) return;
            const r = await fsRead(active.path);
            useDocuments
              .getState()
              .replaceContentFromDisk(active.id, { content: r.content, mtimeMs: r.mtime_ms });
          }}
        />
        {secondary && (
          <>
            <ResizeHandle
              width={Math.round(paneSplit * 1000)}
              min={200}
              max={800}
              onChange={(w) => setPaneSplit(w / 1000)}
            />
            <EditorPane
              pane={secondary}
              isFocused={focusedPaneId === "secondary"}
              otherPaneActiveTabId={primary.activeTabId}
              {...paneProps}
            />
          </>
        )}
      </div>
      <StatusBar
        saveState={active?.saveState ?? "idle"}
        watcherOffline={watcherOffline}
      />
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
                const { id: idToClose, paneId } = closeConfirm;
                setCloseConfirm(null);
                useLayout.getState().closeTab(paneId, idToClose);
                // Buffer is now orphaned from this pane; drop it globally if
                // no other pane holds it.
                const layout = useLayout.getState();
                const stillOpen =
                  layout.primary.tabs.includes(idToClose) ||
                  !!layout.secondary?.tabs.includes(idToClose);
                if (!stillOpen) useDocuments.getState().closeDocument(idToClose);
              }}
              onDiscard={() => {
                const { id: idToClose, paneId } = closeConfirm;
                setCloseConfirm(null);
                useLayout.getState().closeTab(paneId, idToClose);
                const layout = useLayout.getState();
                const stillOpen =
                  layout.primary.tabs.includes(idToClose) ||
                  !!layout.secondary?.tabs.includes(idToClose);
                if (!stillOpen) useDocuments.getState().closeDocument(idToClose);
              }}
              onCancel={() => setCloseConfirm(null)}
            />
          );
        })()}
    </div>
  );
}
