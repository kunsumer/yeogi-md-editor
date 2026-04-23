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
  /**
   * Most-recently-opened files (absolute paths). MRU at index 0; capped at
   * 10 entries; dedupe by path. Drives the File → Open Recent menu.
   */
  recentFiles: string[];
  /**
   * Appearance mode. "system" follows the OS via prefers-color-scheme;
   * "light" and "dark" override it explicitly. Default: "system".
   */
  theme: ThemeMode;
  setAutosaveEnabled(v: boolean): void;
  setFolderVisible(v: boolean): void;
  setTocVisible(v: boolean): void;
  setFolderWidth(w: number): void;
  setTocWidth(w: number): void;
  pushRecent(path: string): void;
  clearRecent(): void;
  setTheme(t: ThemeMode): void;
}

export type ThemeMode = "system" | "light" | "dark";

const RECENT_MAX = 10;

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
      recentFiles: [],
      theme: "system",
      setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
      setFolderVisible: (v) => set({ folderVisible: v }),
      setTocVisible: (v) => set({ tocVisible: v }),
      setFolderWidth: (w) => set({ folderWidth: clampWidth(w) }),
      setTocWidth: (w) => set({ tocWidth: clampWidth(w) }),
      pushRecent: (path) =>
        set((s) => {
          const next = [path, ...s.recentFiles.filter((p) => p !== path)];
          return { recentFiles: next.slice(0, RECENT_MAX) };
        }),
      clearRecent: () => set({ recentFiles: [] }),
      setTheme: (t) => set({ theme: t }),
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
        recentFiles: s.recentFiles,
        theme: s.theme,
      }),
    },
  ),
);
