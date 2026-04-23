import { beforeEach, describe, expect, it } from "vitest";
import { usePreferences } from "./preferences";

describe("usePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset zustand store to fresh defaults between tests.
    usePreferences.setState({
      autosaveEnabled: true,
      autosaveDebounceMs: 500,
      folderVisible: true,
      tocVisible: true,
      folderWidth: 260,
      tocWidth: 220,
    });
  });

  it("defaults: folder + toc visible, folder 260px, toc 220px", () => {
    const s = usePreferences.getState();
    expect(s.folderVisible).toBe(true);
    expect(s.tocVisible).toBe(true);
    expect(s.folderWidth).toBe(260);
    expect(s.tocWidth).toBe(220);
  });

  it("clamps folderWidth into [180, 480]", () => {
    const { setFolderWidth } = usePreferences.getState();
    setFolderWidth(50);
    expect(usePreferences.getState().folderWidth).toBe(180);
    setFolderWidth(600);
    expect(usePreferences.getState().folderWidth).toBe(480);
    setFolderWidth(300);
    expect(usePreferences.getState().folderWidth).toBe(300);
  });

  it("clamps tocWidth into [180, 480]", () => {
    const { setTocWidth } = usePreferences.getState();
    setTocWidth(50);
    expect(usePreferences.getState().tocWidth).toBe(180);
    setTocWidth(600);
    expect(usePreferences.getState().tocWidth).toBe(480);
  });

  it("setFolderVisible + setTocVisible toggle the flags", () => {
    const { setFolderVisible, setTocVisible } = usePreferences.getState();
    setFolderVisible(false);
    setTocVisible(false);
    const s = usePreferences.getState();
    expect(s.folderVisible).toBe(false);
    expect(s.tocVisible).toBe(false);
  });

  it("persists changes to localStorage under yeogi-md-editor:prefs", () => {
    usePreferences.getState().setFolderWidth(300);
    const raw = localStorage.getItem("yeogi-md-editor:prefs");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state.folderWidth).toBe(300);
  });
});
