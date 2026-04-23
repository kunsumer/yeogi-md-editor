import { useDocuments } from "./documents";
import { useLayout } from "./layout";
import type { ViewMode, PaneId } from "./layout";

const KEY = "yeogi-md-editor:session";

interface PersistedPane {
  tabPaths: string[];
  activeTabPath: string | null;
  viewMode: ViewMode;
}

export interface PersistedLayout {
  primary: PersistedPane;
  secondary: PersistedPane | null;
  focusedPaneId: PaneId;
  paneSplit: number;
}

export interface PersistedSession {
  paths: string[];
  activePath: string | null;
  folder: string | null;
  layout: PersistedLayout;
}

function toPersistedPane(
  pane: { tabs: string[]; activeTabId: string | null; viewMode: ViewMode },
  docs: ReturnType<typeof useDocuments.getState>["documents"],
): PersistedPane {
  const tabPaths = pane.tabs
    .map((id) => docs.find((d) => d.id === id)?.path)
    .filter((p): p is string => typeof p === "string");
  const activeDoc = docs.find((d) => d.id === pane.activeTabId);
  return {
    tabPaths,
    activeTabPath: activeDoc?.path ?? null,
    viewMode: pane.viewMode,
  };
}

function snapshot(): PersistedSession {
  const docs = useDocuments.getState();
  const layout = useLayout.getState();
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const d of docs.documents) {
    if (d.path && !seen.has(d.path)) {
      seen.add(d.path);
      paths.push(d.path);
    }
  }
  const primary = toPersistedPane(layout.primary, docs.documents);
  const secondary = layout.secondary
    ? toPersistedPane(layout.secondary, docs.documents)
    : null;
  return {
    paths,
    activePath: primary.activeTabPath,
    folder: docs.folder,
    layout: {
      primary,
      secondary,
      focusedPaneId: layout.focusedPaneId,
      paneSplit: layout.paneSplit,
    },
  };
}

export function startSessionPersistence(): () => void {
  let last = "";
  const write = () => {
    const data = JSON.stringify(snapshot());
    if (data === last) return;
    last = data;
    try {
      localStorage.setItem(KEY, data);
    } catch {
      /* quota / privacy-mode — non-fatal */
    }
  };
  const unsubDocs = useDocuments.subscribe(write);
  const unsubLayout = useLayout.subscribe(write);
  return () => {
    unsubDocs();
    unsubLayout();
  };
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.paths)) return null;
    const paths = parsed.paths.filter((p: unknown): p is string => typeof p === "string");
    const activePath = typeof parsed.activePath === "string" ? parsed.activePath : null;
    const folder = typeof parsed.folder === "string" ? parsed.folder : null;
    // Migrate older payloads that have no `layout` field.
    if (!parsed.layout) {
      return {
        paths,
        activePath,
        folder,
        layout: {
          primary: { tabPaths: paths, activeTabPath: activePath, viewMode: "wysiwyg" },
          secondary: null,
          focusedPaneId: "primary",
          paneSplit: 0.5,
        },
      };
    }
    return { paths, activePath, folder, layout: parsed.layout as PersistedLayout };
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
