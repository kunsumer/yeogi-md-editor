import { describe, it, expect } from "vitest";
import {
  THEMES,
  THEME_GROUPS,
  resolveTheme,
  themeName,
  type ResolvedThemeId,
} from "./themes";

// Shiki themes we rely on. The preview pipeline hands these straight to
// @shikijs/rehype, which either loads the theme's JSON grammar or throws.
// Cross-check here against the allowlist of bundled Shiki themes we know
// ship in the pinned `shiki` package — so adding a theme with a typo in
// its shikiTheme slug trips this test instead of silently breaking preview.
const KNOWN_SHIKI_THEMES = new Set([
  // light
  "github-light",
  "one-light",
  "solarized-light",
  "vitesse-light",
  "light-plus",
  // dark
  "github-dark",
  "github-dark-default",
  "dracula",
  "one-dark-pro",
  "nord",
  "tokyo-night",
]);

describe("themes registry", () => {
  it("every id in THEME_GROUPS appears in THEMES and kind matches", () => {
    for (const kind of ["light", "dark"] as const) {
      for (const id of THEME_GROUPS[kind]) {
        const theme = THEMES[id];
        expect(theme, `THEMES has no entry for ${id}`).toBeDefined();
        expect(theme.kind, `theme ${id} kind mismatch in group`).toBe(kind);
      }
    }
  });

  it("every THEMES entry is listed in exactly one group", () => {
    const grouped = new Set<ResolvedThemeId>([
      ...THEME_GROUPS.light,
      ...THEME_GROUPS.dark,
    ]);
    for (const id of Object.keys(THEMES) as ResolvedThemeId[]) {
      expect(grouped.has(id), `${id} missing from THEME_GROUPS`).toBe(true);
    }
    // No duplicates: set size matches sum of group sizes.
    expect(grouped.size).toBe(
      THEME_GROUPS.light.length + THEME_GROUPS.dark.length,
    );
  });

  it("every theme declares a Shiki theme we know about", () => {
    for (const theme of Object.values(THEMES)) {
      expect(
        KNOWN_SHIKI_THEMES.has(theme.shikiTheme),
        `theme ${theme.id} uses shikiTheme "${theme.shikiTheme}" which isn't in KNOWN_SHIKI_THEMES`,
      ).toBe(true);
    }
  });

  it("every theme supplies the full core variable set", () => {
    const required = [
      "--bg",
      "--bg-sidebar",
      "--bg-hover",
      "--bg-topbar",
      "--text",
      "--text-muted",
      "--text-faint",
      "--border",
      "--border-strong",
      "--accent",
      "--accent-hover",
      "--danger",
    ];
    for (const theme of Object.values(THEMES)) {
      for (const key of required) {
        expect(
          theme.vars[key],
          `theme ${theme.id} missing ${key}`,
        ).toBeDefined();
      }
    }
  });

  it("dark themes all use mermaid 'dark', light themes 'default'", () => {
    for (const id of THEME_GROUPS.dark) {
      expect(THEMES[id].mermaidTheme).toBe("dark");
    }
    for (const id of THEME_GROUPS.light) {
      expect(THEMES[id].mermaidTheme).toBe("default");
    }
  });

  it("themeName returns the display name for known ids", () => {
    expect(themeName("one-dark-pro")).toBe("One Dark Pro");
    expect(themeName("tokyo-night")).toBe("Tokyo Night");
    expect(themeName("github-dark")).toBe("GitHub Dark");
    expect(themeName("nord")).toBe("Nord");
  });

  it("resolveTheme falls back to Light for an unknown id", () => {
    // @ts-expect-error — testing the runtime fallback
    expect(resolveTheme("not-a-theme").id).toBe("light");
  });
});
