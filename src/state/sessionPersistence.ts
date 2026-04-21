import { useDocuments } from "./documents";

const KEY = "evhan-md-editor:session";

export interface PersistedSession {
  paths: string[];
  activePath: string | null;
}

function snapshot(state: ReturnType<typeof useDocuments.getState>): PersistedSession {
  const paths = state.documents.map((d) => d.path).filter((p): p is string => !!p);
  const active = state.documents.find((d) => d.id === state.activeId);
  return { paths, activePath: active?.path ?? null };
}

export function startSessionPersistence(): () => void {
  let last = "";
  return useDocuments.subscribe((state) => {
    const data = JSON.stringify(snapshot(state));
    if (data === last) return;
    last = data;
    try {
      localStorage.setItem(KEY, data);
    } catch {
      // localStorage unavailable / quota exceeded — non-fatal
    }
  });
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
