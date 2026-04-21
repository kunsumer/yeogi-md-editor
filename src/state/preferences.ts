import { create } from "zustand";

interface Prefs {
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  setAutosaveEnabled(v: boolean): void;
}

export const usePreferences = create<Prefs>((set) => ({
  autosaveEnabled: true,
  autosaveDebounceMs: 2000,
  setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
}));
