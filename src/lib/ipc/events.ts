import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface FileChanged {
  path: string;
  mtime_ms: number;
}

export async function onFileChanged(cb: (e: FileChanged) => void): Promise<UnlistenFn> {
  return listen<FileChanged>("file.changed", (e) => cb(e.payload));
}

export async function onWatcherLost(cb: (reason: string) => void): Promise<UnlistenFn> {
  return listen<{ reason: string }>("watcher.lost", (e) => cb(e.payload.reason));
}
