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

interface DocumentsState {
  documents: Document[];
  folder: string | null;
  openDocument(input: {
    path: string | null;
    content: string;
    savedMtime: number;
    encoding: string;
    readOnly?: boolean;
  }): string;
  closeDocument(id: string): void;
  setFolder(path: string | null): void;
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
