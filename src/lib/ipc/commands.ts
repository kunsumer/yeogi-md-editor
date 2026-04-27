import { invoke } from "@tauri-apps/api/core";
import type { DirEntry, FsError } from "./types";

// The generated ./types has mtime_ms: bigint because ts-rs 8 maps Rust i64
// that way. At runtime the wire value is always a plain JSON number, so the
// boundary re-types it as number. See PLAN.md Phase 3 preamble.
export interface FileRead {
  content: string;
  mtime_ms: number;
  encoding: string;
}

export interface FileWritten {
  mtime_ms: number;
}

export async function fsRead(path: string): Promise<FileRead> {
  return (await invoke("fs_read", { path })) as unknown as FileRead;
}

export async function fsWrite(path: string, content: string): Promise<FileWritten> {
  return (await invoke("fs_write", { path, content })) as unknown as FileWritten;
}

export async function fsCreate(path: string): Promise<void> {
  return invoke("fs_create", { path });
}

export async function fsRename(from: string, to: string): Promise<void> {
  return invoke("fs_rename", { from, to });
}

/**
 * File-only copy. Refuses to overwrite an existing target — callers must
 * compute a unique destination path. Used by the file-tree Duplicate
 * action.
 */
export async function fsCopy(from: string, to: string): Promise<void> {
  return invoke("fs_copy", { from, to });
}

export async function fsList(path: string): Promise<DirEntry[]> {
  return invoke("fs_list", { path });
}

/**
 * Permanently remove a file or folder. For folders, recursively removes
 * every descendant. The caller MUST gate this behind a destructive-
 * confirmation modal — the Rust command does no extra prompting.
 */
export async function fsDelete(path: string): Promise<void> {
  return invoke("fs_delete", { path });
}

/**
 * Count every descendant of `path` (files + directories combined),
 * excluding `path` itself. Returns 0 for a file. Used by the delete
 * confirmation dialog to surface item-count.
 */
export async function fsCountRecursive(path: string): Promise<number> {
  return invoke("fs_count_recursive", { path });
}

/** Reveal a file/folder in Finder (highlights inside its parent dir). */
export async function shellRevealInFinder(path: string): Promise<void> {
  return invoke("shell_reveal_in_finder", { path });
}

/**
 * Open Terminal.app at `path`. If `path` is a file, opens at the file's
 * parent directory.
 */
export async function shellOpenInTerminal(path: string): Promise<void> {
  return invoke("shell_open_in_terminal", { path });
}

export async function watcherSubscribe(path: string): Promise<void> {
  return invoke("watcher_subscribe", { path });
}

/**
 * First-run welcome file seeding. On the Rust side, copies the bundled
 * welcome.md into ~/Documents/Yeogi .MD Editor/Welcome.md (idempotent —
 * never overwrites) and returns its absolute path.
 */
export async function ensureWelcomeFile(): Promise<string> {
  return invoke("ensure_welcome_file");
}

/**
 * Overwrite ~/Documents/Yeogi .MD Editor/Welcome.md with the bundled seed,
 * replacing whatever's there. Returns the file's path. Callers must
 * prompt the user for destructive confirmation before invoking — the Rust
 * command itself trusts its caller.
 */
export async function reseedWelcomeFile(): Promise<string> {
  return invoke("reseed_welcome_file");
}

/**
 * Rebuild the native menu to reflect the current `recentFiles` list and
 * `theme` preference. Called at mount and on every change to either. One
 * command (rather than two) means either change triggers the same server-
 * side rebuild path, keeping the menu in a known-consistent state.
 */
export async function syncMenuState(
  recentFiles: string[],
  theme: string,
): Promise<void> {
  return invoke("sync_menu_state", { recentFiles, theme });
}

export type { DirEntry, FsError };
