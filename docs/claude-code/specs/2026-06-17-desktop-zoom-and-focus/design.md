# Desktop: Raise-on-Open + Preview Zoom — Design

**Status:** ✅ implemented (2026-06-17) via subagent-driven TDD. Full suite 254 green, tsc + cargo build clean. Code-review fixes applied (WKWebView wheel-zoom, focus-on-open, pointercancel, aria-label). Interactive confirmation (window-raise on Finder open; scroll-zoom in the real WebView) pending user verification on a bundled run.
**Platform:** macOS desktop (the shipped Mac app on `main`). No mobile/Android involvement.

Two small, independent desktop features, built together on one branch
(`feat/desktop-zoom-and-focus` off `main`).

---

## Feature 1 — Raise the window when a file is opened externally

### Problem
Opening a `.md` via Finder ("Open With") or `open file.md` loads the file, but
the app window does not come forward — the user can't tell the open succeeded.

### Current behavior
`src-tauri/src/lib.rs` handles `tauri::RunEvent::Opened` in the `.run(...)`
closure: it maps the dropped URLs to paths and emits `files-opened` to the
webview (the frontend's listener opens each). It never focuses the window.

### Change
Backend-only. In that same `RunEvent::Opened` arm, after emitting, bring the
main window forward:
- `app.get_webview_window("main")` (the window is unlabeled in
  `tauri.conf.json`, so its label is the default `"main"`),
- then `unminimize()` → `show()` → `set_focus()` (each best-effort / ignored on
  error). `set_focus()` activates the app on macOS, covering: app in
  background, window minimized, and cold-launch-by-Finder.
- Requires adding `use tauri::Manager;` to `lib.rs` (for `get_webview_window`).

Only the external-open path is affected; the in-app Open dialog already runs
focused. No frontend change.

### Testing
Window activation isn't unit-testable. Verified manually: with the app in the
background, run `open <file>.md` (and Finder → Open With) and confirm the window
raises to the front with the file open. The existing `files-opened` flow and the
desktop test suite stay green (no frontend change).

---

## Feature 2 — Click-to-zoom lightbox for diagrams & images in the Preview window

### Scope
The dedicated **Preview window** only (`src/preview/Preview.tsx`). The WYSIWYG
editor is unchanged (images keep their drag-resize handles; Mermaid stays a
static node view). Edit/source mode is irrelevant (raw markdown).

### Interaction
Click a rendered **image** (`<img>`) or **Mermaid diagram** (`.mermaid svg`) to
open a fullscreen lightbox within the preview window:
- **Backdrop:** dimmed, fills the window. A `cursor: zoom-in` hint on the
  targets signals they're clickable.
- **Zoom:** mouse-wheel / trackpad scroll zooms toward the cursor; on-screen
  `−` / percentage / `+` controls; double-click toggles fit ↔ 100%. Clamped to
  a sane range (e.g. 0.25×–8×).
- **Pan:** drag to pan when zoomed beyond fit.
- **Dismiss:** Esc, click on the backdrop (outside the content), or a close (✕)
  button. Focus returns to the preview body.

### Components (isolation)
- **`src/components/Lightbox/Lightbox.tsx`** (new, reusable, self-contained):
  owns the overlay, zoom/pan state, and dismissal. Props:
  `{ image?: { src: string; alt?: string }; svg?: string; onClose(): void }`
  — exactly one of `image` / `svg` is provided. For `svg`, the markup is
  inserted with the existing `safeReplaceChildrenWithSvg` sanitizer (same XSS
  posture as the rest of the preview). Owns zoom math only; no app/store
  coupling → unit-testable in isolation.
- **`src/components/Lightbox/attachZoomTargets.ts`** (new): a small helper
  `attachZoomTargets(host, onOpen)` that finds `img` and `.mermaid svg` inside a
  rendered host, sets the zoom-in cursor, and wires a click → `onOpen({image})`
  or `onOpen({svg})`. Returns a cleanup function that removes the listeners.
  Keeps DOM wiring out of the React render path.
- **`src/preview/Preview.tsx`** (modified): holds lightbox open-state; after
  `safeReplaceChildren` renders the HTML, calls `attachZoomTargets(host, open)`;
  renders `<Lightbox …/>` when open. Cleanup on content change / unmount.
- **CSS** (`src/components/PreviewPane/preview-content.css` or a new
  `Lightbox.css`): `cursor: zoom-in` on `.preview-content img` and
  `.preview-content .mermaid svg`; overlay/backdrop/controls styling using the
  existing theme CSS variables.

### Data flow
`Preview.tsx` renders markdown → HTML (unchanged) → `attachZoomTargets` tags the
images/diagrams → user click sets lightbox state `{image}|{svg}` → `<Lightbox>`
renders the overlay → zoom/pan is local component state → `onClose` clears it.

### Testing
- **`Lightbox.test.tsx`** (Vitest + RTL): renders an image and an svg; `+`/`−`
  buttons change the displayed zoom %; double-click toggles fit↔100%; Esc,
  backdrop click, and the ✕ button each fire `onClose`.
- **`attachZoomTargets.test.ts`**: given a host containing an `<img>` and a
  `.mermaid svg`, clicking each calls `onOpen` with the right payload; the
  cleanup function removes the handlers.
- Full suite (`pnpm vitest run`) + `pnpm tsc --noEmit` stay green.

---

## What is NOT touched
The WYSIWYG editor and its Mermaid/Image node views; the Rust fs/menu/watcher
surface (Feature 1 only adds window-raise in the existing Opened handler); any
mobile/Android code (none on `main`).

## Risks
- **`set_focus()` not activating the app over another frontmost app** on some
  macOS versions. Mitigation: `unminimize` + `show` + `set_focus` is the
  Tauri-documented sequence; verify manually, and if insufficient, fall back to
  re-emphasizing the window. Low risk.
- **Lightbox SVG insertion**: Mermaid SVGs are app-generated, but we still route
  through `safeReplaceChildrenWithSvg` rather than raw `innerHTML` to keep one
  consistent sanitization path.
- **Scroll-zoom hijacking page scroll**: the wheel handler is active only while
  the lightbox is open and calls `preventDefault` on the overlay, so the
  underlying preview doesn't scroll.

## Non-goals (this iteration)
- Zoom in the WYSIWYG editor view.
- Pinch-to-zoom gestures (desktop trackpad scroll covers zoom).
- Persisting zoom level between opens.
- A gallery/next-prev across multiple images.
