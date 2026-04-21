import { create } from "zustand";

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
}

interface DocumentsState {
  documents: Document[];
  activeId: string | null;
  openDocument(input: {
    path: string | null;
    content: string;
    savedMtime: number;
    encoding: string;
    readOnly?: boolean;
  }): string;
  closeDocument(id: string): void;
  setActive(id: string): void;
  setContent(id: string, content: string): void;
  markSaveStarted(id: string): void;
  markSaved(id: string, input: { content: string; mtimeMs: number }): void;
  markSaveFailed(id: string, error: string): void;
  setPath(id: string, path: string): void;
  setPreviewWindowLabel(id: string, label: string | null): void;
  setConflict(id: string, conflict: Conflict | null): void;
  replaceContentFromDisk(id: string, input: { content: string; mtimeMs: number }): void;
}

let seq = 0;
const newId = () => `doc-${++seq}-${Date.now()}`;

export const useDocuments = create<DocumentsState>((set) => ({
  documents: [],
  activeId: null,

  openDocument({ path, content, savedMtime, encoding, readOnly = false }) {
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
