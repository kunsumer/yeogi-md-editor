import { useDocuments } from "./documents";
import { useLayout } from "./layout";

const KEY = "yeogi-md-editor:session";

export interface PersistedSession {
  paths: string[];
  activePath: string | null;
  folder: string | null;
}

function snapshot(state: ReturnType<typeof useDocuments.getState>): PersistedSession {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const d of state.documents) {
    if (d.path && !seen.has(d.path)) {
      seen.add(d.path);
      paths.push(d.path);
    }
  }
  const activeId = useLayout.getState().primary.activeTabId;
  const active = state.documents.find((d) => d.id === activeId);
  return { paths, activePath: active?.path ?? null, folder: state.folder };
}

export function startSessionPersistence(): () => void {
  let last = "";
  function persist() {
    const data = JSON.stringify(snapshot(useDocuments.getState()));
    if (data === last) return;
    last = data;
    try {
      localStorage.setItem(KEY, data);
    } catch {
      // localStorage unavailable / quota exceeded — non-fatal
    }
  }
  const stopDocs = useDocuments.subscribe(persist);
  const stopLayout = useLayout.subscribe(persist);
  return () => {
    stopDocs();
    stopLayout();
  };
}

export function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (!Array.isArray(parsed.paths)) return null;
    return {
      paths: parsed.paths.filter((p): p is string => typeof p === "string"),
      activePath: typeof parsed.activePath === "string" ? parsed.activePath : null,
      folder: typeof parsed.folder === "string" ? parsed.folder : null,
    };
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
