import { create } from "zustand";
import { usePreferences } from "./preferences";
import { useLayout } from "./layout";

export interface Conflict {
  diskMtime: number;
}

export interface Document {
  id: string;
  path: string | null;
  content: string;
  lastSavedContent: string;
  savedMtime: number;
  isDirty: boolean;
  encoding: string;
  cursor: number;
  scrollTop: number;
  readOnly: boolean;
  previewWindowLabel: string | null;
  conflict: Conflict | null;
  saveState: "idle" | "saving" | "saved" | "failed";
  lastSaveError: string | null;
  /**
   * Per-document autosave. Seeded from the global preference at open time
   * so new docs pick up the user's default, but can be toggled independently
   * — useful for a scratch buffer you don't want flushed to disk mid-edit.
   */
  autosaveEnabled: boolean;
}

/**
 * Maximum folders visible in the explorer at once (primary + extras).
 * Extra folders each mount their own FileTree and watcher — letting this
 * grow unbounded would impose real cost on startup + file-event handling.
 * 5 is plenty for typical "notes + project + scratch + reference" layouts.
 */
export const MAX_OPEN_FOLDERS = 5;

interface DocumentsState {
  documents: Document[];
  folder: string | null;
  /**
   * Additional folder roots shown below the primary folder in the explorer.
   * Purely presentational — wiki-link resolution, backlinks, and session
   * persistence still scope to the primary `folder`. Bounded by
   * MAX_OPEN_FOLDERS - 1 (the primary counts for one slot).
   */
  extraFolders: string[];
  openDocument(input: {
    path: string | null;
    content: string;
    savedMtime: number;
    encoding: string;
    readOnly?: boolean;
  }): string;
  closeDocument(id: string): void;
  setFolder(path: string | null): void;
  addExtraFolder(path: string): void;
  removeExtraFolder(path: string): void;
  setExtraFolders(paths: string[]): void;
  setContent(id: string, content: string): void;
  markSaveStarted(id: string): void;
  markSaved(id: string, input: { content: string; mtimeMs: number }): void;
  markSaveFailed(id: string, error: string): void;
  setPath(id: string, path: string): void;
  setPreviewWindowLabel(id: string, label: string | null): void;
  setConflict(id: string, conflict: Conflict | null): void;
  setAutosaveEnabled(id: string, enabled: boolean): void;
  replaceContentFromDisk(id: string, input: { content: string; mtimeMs: number }): void;
}

let seq = 0;
const newId = () => `doc-${++seq}-${Date.now()}`;

export const useDocuments = create<DocumentsState>((set, get) => ({
  documents: [],
  folder: null,
  extraFolders: [],

  openDocument({ path, content, savedMtime, encoding, readOnly = false }) {
    const autosaveDefault = usePreferences.getState().autosaveEnabled;
    if (path) {
      const existing = get().documents.find((d) => d.path === path);
      if (existing) {
        useLayout.getState().openInFocusedPane(existing.id);
        return existing.id;
      }
    }
    const id = newId();
    const doc: Document = {
      id,
      path,
      content,
      lastSavedContent: content,
      savedMtime,
      isDirty: false,
      encoding,
      cursor: 0,
      scrollTop: 0,
      readOnly,
      previewWindowLabel: null,
      conflict: null,
      saveState: "idle",
      lastSaveError: null,
      autosaveEnabled: autosaveDefault,
    };
    set((s) => ({ documents: [...s.documents, doc] }));
    useLayout.getState().openInFocusedPane(id);
    return id;
  },

  /**
   * Document-level close: remove the buffer entirely. Pane tabs are NOT
   * touched here — callers that close from a specific pane should use the
   * pane-aware flow in App.tsx (`requestClosePaneTab`) which removes the tab
   * from one pane only and calls `closeDocument` once the buffer is orphaned
   * (not referenced by any pane). This keeps "close in one pane, keep in the
   * other" working correctly for case (d).
   */
  closeDocument(id) {
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },

  setFolder(path) {
    set({ folder: path });
  },

  addExtraFolder(path) {
    set((s) => {
      if (s.folder === path || s.extraFolders.includes(path)) return s;
      // -1 because the primary `folder` counts for a slot.
      if (s.extraFolders.length >= MAX_OPEN_FOLDERS - 1) return s;
      return { extraFolders: [...s.extraFolders, path] };
    });
  },

  removeExtraFolder(path) {
    set((s) => ({
      extraFolders: s.extraFolders.filter((p) => p !== path),
    }));
  },

  setExtraFolders(paths) {
    // Clamp to MAX_OPEN_FOLDERS - 1 (primary takes one slot) and dedupe
    // against the primary folder so persisted state that's drifted into
    // an invalid shape self-heals on load.
    set((s) => ({
      extraFolders: Array.from(new Set(paths))
        .filter((p) => p !== s.folder)
        .slice(0, MAX_OPEN_FOLDERS - 1),
    }));
  },

  setContent(id, content) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, content, isDirty: content !== d.lastSavedContent } : d,
      ),
    }));
  },

  markSaveStarted(id) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, saveState: "saving" } : d)),
    }));
  },

  markSaved(id, { content, mtimeMs }) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              lastSavedContent: content,
              savedMtime: mtimeMs,
              isDirty: false,
              saveState: "saved",
              lastSaveError: null,
            }
          : d,
      ),
    }));
  },

  markSaveFailed(id, error) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, saveState: "failed", lastSaveError: error } : d,
      ),
    }));
  },

  setPath(id, path) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, path } : d)),
    }));
  },

  setPreviewWindowLabel(id, label) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, previewWindowLabel: label } : d)),
    }));
  },

  setConflict(id, conflict) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, conflict } : d)),
    }));
  },

  setAutosaveEnabled(id, enabled) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, autosaveEnabled: enabled } : d,
      ),
    }));
  },

  replaceContentFromDisk(id, { content, mtimeMs }) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              content,
              lastSavedContent: content,
              savedMtime: mtimeMs,
              isDirty: false,
              conflict: null,
            }
          : d,
      ),
    }));
  },
}));
