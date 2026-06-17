# DESIGN_SYSTEM

This is a Tauri app rendered in **WKWebView**, so the UI is hand-built React components styled with CSS custom properties — not native AppKit and not a third-party UI kit. The "design system" is therefore: the macOS conventions we honor (native menu bar, traffic-light window, ⌘ shortcuts, focus rings) + the token set and component idioms below.

## Baseline
- **macOS HIG-aligned, web-implemented.** Native chrome where the platform owns it (menu bar, window controls, open/save dialogs); everything inside the webview is custom React + CSS.
- **No UI framework** (no MUI/Chakra/Tailwind). Components are local, styled via the CSS variables in `src/index.css` so theming is a single source of truth.

## Typography
Two font tokens in `src/index.css`, both scaled by `--app-zoom`:
- **`--font-ui`** — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. UI chrome at **13px**.
- **`--font-mono`** — `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`. Used by the **Edit-mode CodeMirror** editor (**14px**) and code blocks.
- **Preview / WYSIWYG rendered content** uses `preview-content.css` at **15px** (the reading size).

## Spacing
- **Edit mode (CodeMirror):** scroller padding `16px 24px`, line-height 1.6.
- **Preview / WYSIWYG content:** centered column, `max-width: 760px`, padding `32px 40px 64px`.
- **Panel headers** (Files / Outline): ~28px tall, 10px lead padding.
- **Chrome icon buttons** (`.aside-header-btn`): 20×20 hit area, 4px radius.
- **Lightbox / overlays:** controls pinned 12px from the corner; ≥28px control hit areas.

## Icon policy
- **Custom inline SVG only** — no SF Symbols (it's a webview, not AppKit) and no icon font.
- **Chrome/header icons:** 14-unit `viewBox`, **1.5 stroke**, `currentColor`, rendered ~13–14px, so the reload (⟳), folder, chevrons, expand/collapse, and the single shared **CloseIcon** all line up optically.
- **Editor toolbar icons:** 16px, hairline weight, `currentColor`.
- Every icon button carries an `aria-label` (see anti-patterns).

## Color / theme
- Colors are **CSS custom properties on `document.documentElement`**, swapped wholesale by `applyThemeToDOM` (`src/lib/themes.ts`).
- **Appearance preference** is `"system"` (resolves via `prefers-color-scheme`, flips live) or one of **11 named themes** — light: `light`, `atom-one-light`, `solarized-light`, `ayu-light`, `alabaster`; dark: `dark`, `dracula`, `one-dark-pro`, `nord`, `github-dark`, `tokyo-night`. Each theme supplies its full `vars` set, a `kind` (`light`/`dark`, drives `color-scheme` + menu grouping), a `shikiTheme`, and a `mermaidTheme`.
- **Accent**: `--accent` `#0969da` (light) / `#58a6ff` (dark), with `--accent-hover`.
- **Brand red** `--brand-red` `#f7323f` (Pantone Red 032 C) is **constant across every theme** — it's the app's identity color (primary buttons, update banner, active-tab indicator). Don't theme it.
- **Danger** `--danger` (`#d1242f` / `#ff7b72`) for destructive actions.
- **Syntax highlighting**: **Shiki** in the rendered preview pipeline (per-theme `shikiTheme`); **lowlight** for in-WYSIWYG code blocks. **Mermaid** diagrams follow the theme's `mermaidTheme`.

## Split-pane & window-chrome conventions
- Native single window with macOS traffic-light controls.
- **Resizable panels**: `ResizeHandle` between the explorer / outline / editor columns; widths persist in preferences (clamped 180–480px).
- **Editor splits**: side-by-side (vertical divider) or stacked (horizontal divider), toggled from the tab strip or ⌥⌘\ / ⇧⌥⌘\.

## Allowed extension patterns
Custom widgets are fine when a native/semantic HTML control is insufficient, **with justification and accessibility parity**:
- Modals use `role="dialog"` (`ConfirmDialog`, the zoom `Lightbox`), alerts `role="alert"`, menus `role="menu"`/`menuitem`, tab strips `role="tablist"`/`tab`.
- All interactive controls expose a keyboard-visible focus ring: `:focus-visible { outline: 2px solid var(--accent); outline-offset: … }`.
- Reuse before re-implementing (e.g. the shared `CloseIcon`, the single `Lightbox` reused by the Preview window and the WYSIWYG editor).

## Anti-patterns (avoid)
- **Custom scrollbars** — use native overflow scrolling.
- **Non-standard keybindings** — match the menu accelerators / macOS conventions.
- **Unlabeled icon buttons** — every icon-only control needs an `aria-label` (and a `title` where a tooltip helps).
- **Theming the brand red**, hard-coded hex in components (use the tokens), or color-only state signaling without a shape/text cue.

## Where consistency matters most
Menus and shortcuts, save / dirty indicators (the `StatusBar` save state), find/replace, file-open/save dialogs, and focus rings — keep these uniform across panes and windows.
