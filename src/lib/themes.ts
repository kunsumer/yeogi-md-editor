/**
 * App-wide themes. Starter set of four named palettes (2 light + 2 dark),
 * plus a "system" sentinel that resolves to Light or Dark based on
 * prefers-color-scheme. Picked from View → Appearance in the menu bar.
 *
 * Scoped deliberately small for v1; the shape supports arbitrary additions
 * (just extend ResolvedThemeId + add to THEMES + add to THEME_GROUPS) so
 * growing to the full Meva-style 12-theme set later is a mechanical change.
 *
 * Each theme supplies:
 *  - `vars`: the full CSS custom-property set applied to document.documentElement
 *  - `kind`: "light" | "dark" — drives color-scheme and the menu grouping
 *  - `shikiTheme`: which Shiki built-in theme the markdown preview pipeline
 *    should use for code-block syntax highlighting
 *  - `mermaidTheme`: which Mermaid built-in theme to use for diagrams
 *
 * Palettes are adapted from each theme's canonical source (GitHub Primer,
 * Dracula theme) and mapped onto Yeogi's variable set. The brand red
 * (--brand-red) is constant across all themes — the app's identity color.
 */

export type ResolvedThemeId =
  | "light"
  | "atom-one-light"
  | "solarized-light"
  | "ayu-light"
  | "alabaster"
  | "dark"
  | "dracula"
  | "one-dark-pro"
  | "nord"
  | "github-dark"
  | "tokyo-night";

export type ThemeId = "system" | ResolvedThemeId;

export type ThemeKind = "light" | "dark";

export interface Theme {
  id: ResolvedThemeId;
  name: string;
  kind: ThemeKind;
  vars: Record<string, string>;
  /** Shiki theme name for preview code blocks. */
  shikiTheme: string;
  /** Mermaid built-in theme for diagrams. */
  mermaidTheme: "default" | "dark";
}

const BRAND_RED = "#f7323f";
const BRAND_RED_HOVER = "#d9252f";

const FONT_UI =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** Common vars that every theme shares (fonts, brand). */
function common() {
  return {
    "--brand-red": BRAND_RED,
    "--brand-red-hover": BRAND_RED_HOVER,
    "--font-ui": FONT_UI,
    "--font-mono": FONT_MONO,
  };
}

export const THEMES: Record<ResolvedThemeId, Theme> = {
  // ----------------------------- LIGHT -----------------------------
  light: {
    id: "light",
    name: "Light",
    kind: "light",
    shikiTheme: "github-light",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#ffffff",
      "--bg-sidebar": "#fafafa",
      "--bg-tabbar": "#fafafa",
      "--bg-tabbar-hover": "#eeeeee",
      "--bg-tab-active": "#ffffff",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#fafafa",
      "--bg-hover": "#f5f5f5",
      "--text": "#1a1a1a",
      "--text-muted": "#6b7280",
      "--text-faint": "#9ca3af",
      "--text-on-dark": "#e6edf3",
      "--text-on-dark-muted": "#9ca3af",
      "--border": "#e5e7eb",
      "--border-strong": "#d1d5db",
      "--accent": "#0969da",
      "--accent-hover": "#0a5fb8",
      "--danger": "#d1242f",
    },
  },
  "atom-one-light": {
    id: "atom-one-light",
    name: "Atom One Light",
    kind: "light",
    shikiTheme: "one-light",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#fafafa",
      "--bg-sidebar": "#f5f5f5",
      "--bg-tabbar": "#f5f5f5",
      "--bg-tabbar-hover": "#ebebeb",
      "--bg-tab-active": "#fafafa",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#f5f5f5",
      "--bg-hover": "#eeeeee",
      "--text": "#383a42",
      "--text-muted": "#696c77",
      "--text-faint": "#a0a1a7",
      "--text-on-dark": "#383a42",
      "--text-on-dark-muted": "#696c77",
      "--border": "#e5e5e6",
      "--border-strong": "#c8c8c9",
      "--accent": "#4078f2",
      "--accent-hover": "#2f66d9",
      "--danger": "#e45649",
    },
  },
  "solarized-light": {
    id: "solarized-light",
    name: "Solarized Light",
    kind: "light",
    shikiTheme: "solarized-light",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#fdf6e3",
      "--bg-sidebar": "#eee8d5",
      "--bg-tabbar": "#eee8d5",
      "--bg-tabbar-hover": "#e4dbbd",
      "--bg-tab-active": "#fdf6e3",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#eee8d5",
      "--bg-hover": "#e4dbbd",
      "--text": "#586e75",
      "--text-muted": "#657b83",
      "--text-faint": "#93a1a1",
      "--text-on-dark": "#586e75",
      "--text-on-dark-muted": "#657b83",
      "--border": "#ddd6c1",
      "--border-strong": "#c7c0a8",
      "--accent": "#268bd2",
      "--accent-hover": "#1c6aa8",
      "--danger": "#dc322f",
    },
  },
  "ayu-light": {
    id: "ayu-light",
    name: "Ayu Light",
    kind: "light",
    // Shiki ships `vitesse-light` as a close visual match for Ayu Light's
    // soft-white + warm-accent palette; shiki has no official ayu-light.
    shikiTheme: "vitesse-light",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#fafafa",
      "--bg-sidebar": "#f3f4f5",
      "--bg-tabbar": "#f3f4f5",
      "--bg-tabbar-hover": "#e7eaed",
      "--bg-tab-active": "#fafafa",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#f3f4f5",
      "--bg-hover": "#edf0f2",
      "--text": "#5c6773",
      "--text-muted": "#828c99",
      "--text-faint": "#abb1b8",
      "--text-on-dark": "#5c6773",
      "--text-on-dark-muted": "#828c99",
      "--border": "#e6e6e6",
      "--border-strong": "#cbccd1",
      "--accent": "#ff6a00",
      "--accent-hover": "#e05a00",
      "--danger": "#f07171",
    },
  },
  alabaster: {
    id: "alabaster",
    name: "Alabaster",
    kind: "light",
    shikiTheme: "light-plus",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#f7f7f7",
      "--bg-sidebar": "#f0f0f0",
      "--bg-tabbar": "#f0f0f0",
      "--bg-tabbar-hover": "#e6e6e6",
      "--bg-tab-active": "#f7f7f7",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#f0f0f0",
      "--bg-hover": "#eaeaea",
      "--text": "#000000",
      "--text-muted": "#555555",
      "--text-faint": "#888888",
      "--text-on-dark": "#000000",
      "--text-on-dark-muted": "#555555",
      "--border": "#dddddd",
      "--border-strong": "#bbbbbb",
      "--accent": "#007acc",
      "--accent-hover": "#005fa3",
      "--danger": "#aa3731",
    },
  },

  // ----------------------------- DARK ------------------------------
  dark: {
    id: "dark",
    name: "Dark",
    kind: "dark",
    shikiTheme: "github-dark",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#1e1e1e",
      "--bg-sidebar": "#252526",
      "--bg-tabbar": "#2b2b2c",
      "--bg-tabbar-hover": "#353536",
      "--bg-tab-active": "#1e1e1e",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#2b2b2c",
      "--bg-hover": "#353536",
      "--text": "#e6edf3",
      "--text-muted": "#9ba3ae",
      "--text-faint": "#6b7280",
      "--text-on-dark": "#e6edf3",
      "--text-on-dark-muted": "#9ba3ae",
      "--border": "#3a3a3c",
      "--border-strong": "#4a4a4d",
      "--accent": "#58a6ff",
      "--accent-hover": "#79b8ff",
      "--danger": "#ff7b72",
    },
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    kind: "dark",
    shikiTheme: "dracula",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#282a36",
      "--bg-sidebar": "#21222c",
      "--bg-tabbar": "#21222c",
      "--bg-tabbar-hover": "#343746",
      "--bg-tab-active": "#282a36",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#21222c",
      "--bg-hover": "#343746",
      "--text": "#f8f8f2",
      "--text-muted": "#b6b6c5",
      "--text-faint": "#6272a4",
      "--text-on-dark": "#f8f8f2",
      "--text-on-dark-muted": "#b6b6c5",
      "--border": "#44475a",
      "--border-strong": "#565a72",
      "--accent": "#bd93f9",
      "--accent-hover": "#d4b0ff",
      "--danger": "#ff5555",
    },
  },
  "one-dark-pro": {
    id: "one-dark-pro",
    name: "One Dark Pro",
    kind: "dark",
    shikiTheme: "one-dark-pro",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#282c34",
      "--bg-sidebar": "#21252b",
      "--bg-tabbar": "#21252b",
      "--bg-tabbar-hover": "#2c313a",
      "--bg-tab-active": "#282c34",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#21252b",
      "--bg-hover": "#2c313a",
      "--text": "#abb2bf",
      "--text-muted": "#8b92a2",
      "--text-faint": "#5c6370",
      "--text-on-dark": "#abb2bf",
      "--text-on-dark-muted": "#8b92a2",
      "--border": "#3e4451",
      "--border-strong": "#4f5665",
      "--accent": "#61afef",
      "--accent-hover": "#7cc3ff",
      "--danger": "#e06c75",
    },
  },
  nord: {
    id: "nord",
    name: "Nord",
    kind: "dark",
    shikiTheme: "nord",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#2e3440",
      "--bg-sidebar": "#272c36",
      "--bg-tabbar": "#272c36",
      "--bg-tabbar-hover": "#3b4252",
      "--bg-tab-active": "#2e3440",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#272c36",
      "--bg-hover": "#3b4252",
      "--text": "#d8dee9",
      "--text-muted": "#a8b1c2",
      "--text-faint": "#7a8495",
      "--text-on-dark": "#d8dee9",
      "--text-on-dark-muted": "#a8b1c2",
      "--border": "#434c5e",
      "--border-strong": "#4c566a",
      "--accent": "#88c0d0",
      "--accent-hover": "#a3d1df",
      "--danger": "#bf616a",
    },
  },
  "github-dark": {
    id: "github-dark",
    name: "GitHub Dark",
    kind: "dark",
    // Shiki's "github-dark-default" matches github.com's exact dark palette;
    // our default "Dark" theme uses plain "github-dark" (slightly different
    // background), so use the suffixed variant to keep them visually distinct.
    shikiTheme: "github-dark-default",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#0d1117",
      "--bg-sidebar": "#010409",
      "--bg-tabbar": "#010409",
      "--bg-tabbar-hover": "#161b22",
      "--bg-tab-active": "#0d1117",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#010409",
      "--bg-hover": "#161b22",
      "--text": "#c9d1d9",
      "--text-muted": "#8b949e",
      "--text-faint": "#6e7681",
      "--text-on-dark": "#c9d1d9",
      "--text-on-dark-muted": "#8b949e",
      "--border": "#30363d",
      "--border-strong": "#484f58",
      "--accent": "#58a6ff",
      "--accent-hover": "#79b8ff",
      "--danger": "#f85149",
    },
  },
  "tokyo-night": {
    id: "tokyo-night",
    name: "Tokyo Night",
    kind: "dark",
    shikiTheme: "tokyo-night",
    mermaidTheme: "dark",
    vars: {
      ...common(),
      "--bg": "#1a1b26",
      "--bg-sidebar": "#16161e",
      "--bg-tabbar": "#16161e",
      "--bg-tabbar-hover": "#24253a",
      "--bg-tab-active": "#1a1b26",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#16161e",
      "--bg-hover": "#24253a",
      "--text": "#c0caf5",
      "--text-muted": "#9aa5ce",
      "--text-faint": "#565f89",
      "--text-on-dark": "#c0caf5",
      "--text-on-dark-muted": "#9aa5ce",
      "--border": "#2a2b3d",
      "--border-strong": "#3b3d57",
      "--accent": "#7aa2f7",
      "--accent-hover": "#9abdf9",
      "--danger": "#f7768e",
    },
  },
};

/** Theme IDs grouped by light/dark for the menu. Order = menu order. */
export const THEME_GROUPS: Record<ThemeKind, ResolvedThemeId[]> = {
  light: ["light", "atom-one-light", "solarized-light", "ayu-light", "alabaster"],
  dark: ["dark", "dracula", "one-dark-pro", "nord", "github-dark", "tokyo-night"],
};

/**
 * Given a user preference (possibly `"system"`), return the actual theme
 * to render. When preference is `"system"`, consult prefers-color-scheme
 * and fall back to "light" / "dark" — the two defaults.
 */
export function resolveTheme(id: ThemeId): Theme {
  if (id === "system") {
    const prefersDark =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return THEMES[prefersDark ? "dark" : "light"];
  }
  return THEMES[id] ?? THEMES.light;
}

/**
 * Apply the theme's CSS variables to the document root and record its
 * kind (light/dark) + resolved id as data-* attributes. Other parts of
 * the app (mermaid, CodeMirror, preview) read these to pick palette-
 * matching output.
 */
export function applyThemeToDOM(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(key, val);
  }
  root.dataset.theme = theme.kind; // "light" | "dark" (legacy readers)
  root.dataset.themeId = theme.id; // specific theme (e.g. "dracula")
  root.style.colorScheme = theme.kind;
}

/** Display name lookup — used by the menu bar building code. */
export function themeName(id: ResolvedThemeId): string {
  return THEMES[id]?.name ?? id;
}
