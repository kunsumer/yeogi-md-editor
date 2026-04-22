import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Prefs {
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  folderVisible: boolean;
  tocVisible: boolean;
  /** Pixel width of the Folder Explorer panel, clamped [180, 480]. */
  folderWidth: number;
  /** Pixel width of the Outline panel, clamped [180, 480]. */
  tocWidth: number;
  setAutosaveEnabled(v: boolean): void;
  setFolderVisible(v: boolean): void;
  setTocVisible(v: boolean): void;
  setFolderWidth(w: number): void;
  setTocWidth(w: number): void;
}

// Panels narrower than 180 px truncate tree item names aggressively; wider
// than 480 px eats too much of the editor column on a typical laptop screen.
const MIN_PANEL_WIDTH = 180;
const MAX_PANEL_WIDTH = 480;
const clampWidth = (n: number) =>
  Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, Math.round(n)));

export const usePreferences = create<Prefs>()(
  persist(
    (set) => ({
      autosaveEnabled: true,
      // Short idle debounce so saves feel immediate. useAutosave layers a
      // 2-second max-wait ceiling on top of this for continuous typing.
      autosaveDebounceMs: 500,
      folderVisible: true,
      tocVisible: true,
      folderWidth: 260,
      tocWidth: 220,
      setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
      setFolderVisible: (v) => set({ folderVisible: v }),
      setTocVisible: (v) => set({ tocVisible: v }),
      setFolderWidth: (w) => set({ folderWidth: clampWidth(w) }),
      setTocWidth: (w) => set({ tocWidth: clampWidth(w) }),
    }),
    {
      name: "yeogi-md-editor:prefs",
      storage: createJSONStorage(() => localStorage),
      // Only persist the value fields — setters are rebuilt on load.
      partialize: (s) => ({
        autosaveEnabled: s.autosaveEnabled,
        autosaveDebounceMs: s.autosaveDebounceMs,
        folderVisible: s.folderVisible,
        tocVisible: s.tocVisible,
        folderWidth: s.folderWidth,
        tocWidth: s.tocWidth,
      }),
    },
  ),
);
