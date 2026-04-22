import { create } from "zustand";

interface Prefs {
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  setAutosaveEnabled(v: boolean): void;
}

export const usePreferences = create<Prefs>((set) => ({
  autosaveEnabled: true,
  // Short idle debounce so saves feel immediate. useAutosave layers a
  // 2-second max-wait ceiling on top of this for continuous typing bursts.
  autosaveDebounceMs: 500,
  setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
}));
