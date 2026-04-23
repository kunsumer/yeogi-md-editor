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

export async function fsList(path: string): Promise<DirEntry[]> {
  return invoke("fs_list", { path });
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

export type { DirEntry, FsError };
