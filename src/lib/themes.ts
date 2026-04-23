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
  | "github-light"
  | "dark"
  | "dracula";

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
  "github-light": {
    id: "github-light",
    name: "GitHub Light",
    kind: "light",
    shikiTheme: "github-light",
    mermaidTheme: "default",
    vars: {
      ...common(),
      "--bg": "#ffffff",
      "--bg-sidebar": "#f6f8fa",
      "--bg-tabbar": "#f6f8fa",
      "--bg-tabbar-hover": "#eaeef2",
      "--bg-tab-active": "#ffffff",
      "--bg-tab-inactive": "transparent",
      "--bg-topbar": "#f6f8fa",
      "--bg-hover": "#eaeef2",
      "--text": "#1f2328",
      "--text-muted": "#656d76",
      "--text-faint": "#8c959f",
      "--text-on-dark": "#1f2328",
      "--text-on-dark-muted": "#656d76",
      "--border": "#d0d7de",
      "--border-strong": "#afb8c1",
      "--accent": "#0969da",
      "--accent-hover": "#0550ae",
      "--danger": "#d1242f",
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
};

/** Theme IDs grouped by light/dark for the menu. Order = menu order. */
export const THEME_GROUPS: Record<ThemeKind, ResolvedThemeId[]> = {
  light: ["light", "github-light"],
  dark: ["dark", "dracula"],
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
