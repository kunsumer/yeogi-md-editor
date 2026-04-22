import { create } from "zustand";
import { usePreferences } from "./preferences";

export interface Conflict {
  diskMtime: number;
}

export type ViewMode = "edit" | "wysiwyg";

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
  viewMode: ViewMode;
  /**
   * Per-document autosave. Seeded from the global preference at open time
   * so new docs pick up the user's default, but can be toggled independently
   * — useful for a scratch buffer you don't want flushed to disk mid-edit.
   */
  autosaveEnabled: boolean;
}

interface DocumentsState {
  documents: Document[];
  activeId: string | null;
  folder: string | null;
  openDocument(input: {
    path: string | null;
    content: string;
    savedMtime: number;
    encoding: string;
    readOnly?: boolean;
  }): string;
  closeDocument(id: string): void;
  setActive(id: string): void;
  setFolder(path: string | null): void;
  setContent(id: string, content: string): void;
  markSaveStarted(id: string): void;
  markSaved(id: string, input: { content: string; mtimeMs: number }): void;
  markSaveFailed(id: string, error: string): void;
  setPath(id: string, path: string): void;
  setPreviewWindowLabel(id: string, label: string | null): void;
  setConflict(id: string, conflict: Conflict | null): void;
  setViewMode(id: string, mode: ViewMode): void;
  setAutosaveEnabled(id: string, enabled: boolean): void;
  replaceContentFromDisk(id: string, input: { content: string; mtimeMs: number }): void;
}

let seq = 0;
const newId = () => `doc-${++seq}-${Date.now()}`;

export const useDocuments = create<DocumentsState>((set, get) => ({
  documents: [],
  activeId: null,
  folder: null,

  openDocument({ path, content, savedMtime, encoding, readOnly = false }) {
    const autosaveDefault = usePreferences.getState().autosaveEnabled;
    if (path) {
      const existing = get().documents.find((d) => d.path === path);
      if (existing) {
        set({ activeId: existing.id });
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
      viewMode: "wysiwyg",
      autosaveEnabled: autosaveDefault,
    };
    set((s) => ({ documents: [...s.documents, doc], activeId: id }));
    return id;
  },

  closeDocument(id) {
    set((s) => {
      const documents = s.documents.filter((d) => d.id !== id);
      const activeId = s.activeId === id ? (documents[0]?.id ?? null) : s.activeId;
      return { documents, activeId };
    });
  },

  setActive(id) {
    set({ activeId: id });
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

  setViewMode(id, mode) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, viewMode: mode } : d)),
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
