# Desktop: Raise-on-Open + Preview Zoom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Bring the macOS app window to the front when a file is opened externally (Finder/`open`), and (2) add a click-to-zoom fullscreen lightbox (zoom + pan) for images and Mermaid diagrams in the Preview window.

**Architecture:** Feature 1 is a backend-only addition to the existing `RunEvent::Opened` handler in `src-tauri/src/lib.rs` (raise the `"main"` window). Feature 2 is a new, isolated React `Lightbox` component plus an `attachZoomTargets` DOM helper, wired only into `src/preview/Preview.tsx`; the WYSIWYG editor and `main` desktop chrome are untouched.

**Tech Stack:** Rust + Tauri 2 (window API); TypeScript + React 18; Vitest + @testing-library/react.

---

## File Structure

**New:**
- `src/components/Lightbox/attachZoomTargets.ts` — tags `<img>` + `.mermaid svg` in a host as click-to-zoom; returns cleanup.
- `src/components/Lightbox/attachZoomTargets.test.ts`
- `src/components/Lightbox/Lightbox.tsx` — fullscreen zoom/pan overlay (image or sanitized SVG).
- `src/components/Lightbox/Lightbox.test.tsx`
- `src/components/Lightbox/Lightbox.css` — overlay/controls styling.

**Modified:**
- `src-tauri/src/lib.rs` — raise `"main"` window in the `RunEvent::Opened` arm (+ `Manager` import).
- `src/preview/Preview.tsx` — open the lightbox when a tagged target is clicked.

**Untouched:** `src/App.tsx`, the WYSIWYG editor + its node views, the Rust fs/menu/watcher surface.

---

## Task 1: Raise the window on external file open (backend)

**Files:**
- Modify: `src-tauri/src/lib.rs` (the `use tauri::Emitter;` line and the `.run(...)` closure)

- [ ] **Step 1: Add the `Manager` trait import**

In `src-tauri/src/lib.rs`, replace:
```rust
use tauri::Emitter;
```
with:
```rust
use tauri::{Emitter, Manager};
```

- [ ] **Step 2: Raise the main window in the `Opened` handler**

In the `.run(|app, event| { ... })` closure, replace the existing `Opened` arm:
```rust
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    let _ = app.emit("files-opened", paths);
                }
            }
```
with:
```rust
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    let _ = app.emit("files-opened", paths);
                    // Bring the app forward so the user can see the file
                    // they just opened from Finder / `open`. Best-effort:
                    // unminimize + show + focus covers background, minimized,
                    // and cold-launch-by-Finder. set_focus activates the app
                    // on macOS.
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.unminimize();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: `Finished` with no errors. (Window focus is not unit-testable; verified manually in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(desktop): raise the window when a file is opened externally"
```

---

## Task 2: `attachZoomTargets` helper

**Files:**
- Create: `src/components/Lightbox/attachZoomTargets.ts`
- Test: `src/components/Lightbox/attachZoomTargets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/Lightbox/attachZoomTargets.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { attachZoomTargets } from "./attachZoomTargets";

function makeHost(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
afterEach(() => { document.body.innerHTML = ""; });

describe("attachZoomTargets", () => {
  it("opens an image target on click", () => {
    const el = makeHost(`<img src="/a.png" alt="A">`);
    const onOpen = vi.fn();
    attachZoomTargets(el, onOpen);
    el.querySelector("img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith({
      image: { src: expect.stringContaining("a.png"), alt: "A" },
    });
  });

  it("opens an svg (mermaid) target on click", () => {
    const el = makeHost(`<div class="mermaid"><svg id="m"><rect/></svg></div>`);
    const onOpen = vi.fn();
    attachZoomTargets(el, onOpen);
    el.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith({ svg: expect.stringContaining("<svg") });
  });

  it("cleanup removes the click handlers", () => {
    const el = makeHost(`<img src="/a.png" alt="A">`);
    const onOpen = vi.fn();
    const cleanup = attachZoomTargets(el, onOpen);
    cleanup();
    el.querySelector("img")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/Lightbox/attachZoomTargets.test.ts`
Expected: FAIL — cannot resolve `./attachZoomTargets`.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/Lightbox/attachZoomTargets.ts

/** What the Lightbox needs to display a clicked target. */
export type ZoomTarget =
  | { image: { src: string; alt: string } }
  | { svg: string };

/**
 * Tag every <img> and Mermaid <svg> inside a rendered preview `host` as
 * click-to-zoom: sets a zoom-in cursor and, on click, calls `onOpen` with the
 * payload the Lightbox needs. Returns a cleanup function that removes every
 * listener it added (call before re-rendering the host or on unmount).
 */
export function attachZoomTargets(
  host: HTMLElement,
  onOpen: (target: ZoomTarget) => void,
): () => void {
  const cleanups: Array<() => void> = [];

  host.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.style.cursor = "zoom-in";
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen({ image: { src: img.currentSrc || img.src, alt: img.alt } });
    };
    img.addEventListener("click", handler);
    cleanups.push(() => img.removeEventListener("click", handler));
  });

  host.querySelectorAll<SVGSVGElement>(".mermaid svg").forEach((svg) => {
    const container = svg.parentElement;
    if (container) container.style.cursor = "zoom-in";
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onOpen({ svg: svg.outerHTML });
    };
    svg.addEventListener("click", handler);
    cleanups.push(() => svg.removeEventListener("click", handler));
  });

  return () => cleanups.forEach((fn) => fn());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/Lightbox/attachZoomTargets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Lightbox/attachZoomTargets.ts src/components/Lightbox/attachZoomTargets.test.ts
git commit -m "feat(preview): add attachZoomTargets helper for click-to-zoom"
```

---

## Task 3: `Lightbox` component

**Files:**
- Create: `src/components/Lightbox/Lightbox.tsx`
- Create: `src/components/Lightbox/Lightbox.css`
- Test: `src/components/Lightbox/Lightbox.test.tsx`

- [ ] **Step 1: Create the stylesheet** (no test; imported by the component)

```css
/* src/components/Lightbox/Lightbox.css */
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lightbox-stage {
  transform-origin: center center;
  will-change: transform;
  user-select: none;
  touch-action: none;
}
.lightbox-stage img,
.lightbox-svg svg {
  max-width: 90vw;
  max-height: 90vh;
  display: block;
}
.lightbox-svg svg { width: auto; height: auto; }
.lightbox-controls {
  position: fixed;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 6px 10px;
  z-index: 1001;
}
.lightbox-controls button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.lightbox-controls button:hover { background: rgba(255, 255, 255, 0.22); }
.lightbox-pct { color: #fff; font-size: 13px; min-width: 46px; text-align: center; }
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/Lightbox/Lightbox.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Lightbox } from "./Lightbox";

describe("Lightbox", () => {
  it("renders an image and zooms in/out via the controls", () => {
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={() => {}} />);
    expect(screen.getByAltText("A")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("double-click toggles between 100% and 200%", () => {
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={() => {}} />);
    const stage = screen.getByAltText("A").parentElement as HTMLElement;
    fireEvent.doubleClick(stage);
    expect(screen.getByText("200%")).toBeInTheDocument();
    fireEvent.doubleClick(stage);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("closes via Escape, the close button, and backdrop click", () => {
    const onClose = vi.fn();
    render(<Lightbox image={{ src: "/a.png", alt: "A" }} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/components/Lightbox/Lightbox.test.tsx`
Expected: FAIL — cannot resolve `./Lightbox`.

- [ ] **Step 4: Write the implementation**

```tsx
// src/components/Lightbox/Lightbox.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { safeReplaceChildrenWithSvg } from "../../lib/safeInsertHtml";
import "./Lightbox.css";

interface Props {
  image?: { src: string; alt: string };
  svg?: string;
  onClose(): void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Fullscreen image/diagram viewer: scroll or +/- to zoom, drag to pan,
 * double-click to toggle fit↔200%, Esc / backdrop / ✕ to close. Renders
 * either an <img> (by src) or a Mermaid SVG (inserted via the app's SVG
 * sanitizer). Owns only zoom/pan state — no app/store coupling.
 */
export function Lightbox({ image, svg, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (svg && svgHostRef.current) safeReplaceChildrenWithSvg(svgHostRef.current, svg);
  }, [svg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoomBy = useCallback((factor: number) => {
    setScale((s) => clamp(s * factor, MIN_SCALE, MAX_SCALE));
  }, []);
  const reset = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }
  function onDoubleClick() {
    if (scale === 1) setScale(2);
    else reset();
  }
  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: e.clientX - d.x, y: e.clientY - d.y });
  }
  function onPointerUp() { dragRef.current = null; }

  return (
    <div
      className="lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onWheel={onWheel}
    >
      <div className="lightbox-controls" role="toolbar" aria-label="Zoom controls">
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span className="lightbox-pct" aria-live="polite">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" aria-label="Close viewer" onClick={onClose}>✕</button>
      </div>
      <div
        className="lightbox-stage"
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? "grab" : "default",
        }}
      >
        {image && <img src={image.src} alt={image.alt} draggable={false} />}
        {svg && <div ref={svgHostRef} className="lightbox-svg" />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/Lightbox/Lightbox.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/Lightbox/Lightbox.tsx src/components/Lightbox/Lightbox.css src/components/Lightbox/Lightbox.test.tsx
git commit -m "feat(preview): add zoom/pan Lightbox component"
```

---

## Task 4: Wire the lightbox into the Preview window

**Files:**
- Modify: `src/preview/Preview.tsx`

- [ ] **Step 1: Replace `src/preview/Preview.tsx` with the wired version**

Replace the ENTIRE file with:
```tsx
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { renderMarkdown } from "../lib/markdown/pipeline";
import { safeReplaceChildren } from "../lib/safeInsertHtml";
import { Lightbox } from "../components/Lightbox/Lightbox";
import { attachZoomTargets, type ZoomTarget } from "../components/Lightbox/attachZoomTargets";
import "../components/PreviewPane/preview-content.css";

interface Props {
  docId: string;
}

export function Preview({ docId }: Props) {
  const [orphan, setOrphan] = useState(false);
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const zoomCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unlisten = listen<{ id: string; content: string }>(
      "preview:content-update",
      async (e) => {
        if (e.payload.id !== docId) return;
        const html = await renderMarkdown(e.payload.content);
        if (!hostRef.current) return;
        safeReplaceChildren(hostRef.current, html);
        attachCopyButtons(hostRef.current);
        // Re-tag zoom targets after each render; drop the previous wiring.
        zoomCleanupRef.current?.();
        zoomCleanupRef.current = attachZoomTargets(hostRef.current, setZoom);
      },
    );
    const unorphan = listen("editor:closed", () => setOrphan(true));
    return () => {
      unlisten.then((fn) => fn());
      unorphan.then((fn) => fn());
      zoomCleanupRef.current?.();
      zoomCleanupRef.current = null;
    };
  }, [docId]);

  function onHostClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    if (/^(https?:|mailto:)/.test(href)) {
      openUrl(href).catch((err) => console.warn("openUrl failed:", href, err));
    }
    if (href.startsWith("#") && hostRef.current) {
      const target = hostRef.current.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {orphan && (
        <div role="alert" style={{ background: "#f4f4f4", padding: 8, marginBottom: 12 }}>
          Editor closed — this preview is read-only.
        </div>
      )}
      <div ref={hostRef} className="preview-content" onClick={onHostClick} />
      {zoom && (
        <Lightbox
          image={"image" in zoom ? zoom.image : undefined}
          svg={"svg" in zoom ? zoom.svg : undefined}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}

function attachCopyButtons(host: HTMLElement) {
  host.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy-btn")) return;
    const code = pre.querySelector("code");
    if (!code) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(code.textContent || "");
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    });
    pre.appendChild(btn);
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/preview/Preview.tsx
git commit -m "feat(preview): open the zoom lightbox on image/diagram click"
```

---

## Task 5: Full regression + typecheck

- [ ] **Step 1: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `pnpm vitest run`
Expected: all green — the prior 247 desktop tests plus the 6 new Lightbox/attachZoomTargets tests; zero failures.

- [ ] **Step 3: Commit (only if incidental updates)**

```bash
git add -A && git commit -m "test(preview): green suite for zoom lightbox" || echo "nothing to commit"
```

---

## Task 6: Build + manual verification

- [ ] **Step 1: Build the desktop app**

Run: `pnpm build && cd src-tauri && cargo build`
Expected: both succeed. (Or `pnpm tauri dev` to run interactively.)

- [ ] **Step 2: Verify Feature 1 (raise on open)**

With the app running but in the background, in a terminal run:
`open "/path/to/some.md"`
Expected: the app window comes to the front with the file opened as a tab. Repeat from Finder → right-click a `.md` → Open With → Yeogi .MD Editor.

- [ ] **Step 3: Verify Feature 2 (preview zoom)**

Open a document containing an image and a Mermaid diagram, open a Preview window for it (the per-document preview), then:
- Hover an image/diagram → cursor shows zoom-in.
- Click it → fullscreen lightbox opens.
- Scroll to zoom; use `−`/`+`; double-click toggles 100%↔200%; drag to pan when zoomed.
- Esc, the ✕ button, and clicking the backdrop each close it.

- [ ] **Step 4: Update spec status + commit**

Edit `docs/claude-code/specs/2026-06-17-desktop-zoom-and-focus/design.md`: set status to "✅ implemented + verified (2026-06-17)".
```bash
git add docs/claude-code/specs/2026-06-17-desktop-zoom-and-focus/design.md
git commit -m "docs(desktop): mark raise-on-open + preview zoom implemented"
```

---

## Self-Review

**Spec coverage:** Feature 1 raise-on-open (Task 1) ✓; lightbox interaction — click trigger + cursor (Task 2), zoom/pan/double-click/dismiss (Task 3), Preview-window wiring (Task 4) ✓; Mermaid SVG via `safeReplaceChildrenWithSvg` (Task 3 Step 4) ✓; scope = Preview window only, WYSIWYG untouched (Task 4 is the only frontend wiring) ✓; tests for lightbox + helper (Tasks 2–3) ✓; regression guard (Task 5) ✓; manual verification of both (Task 6) ✓.

**Placeholder scan:** none — every step has complete code/commands. Window-focus has no unit test by nature (documented as manual in Tasks 1 & 6), not a placeholder.

**Type consistency:** `ZoomTarget = { image: {src,alt} } | { svg: string }` defined in Task 2, consumed identically in Task 3 (`Lightbox` props `image?`/`svg?`) and Task 4 (`"image" in zoom` / `"svg" in zoom` narrowing). `attachZoomTargets(host, onOpen) => () => void` signature matches its call in Task 4. `safeReplaceChildrenWithSvg(host, svg)` matches the real export. `get_webview_window("main")` matches the unlabeled-window default.

**Ambiguity check:** zoom clamp is explicit (0.25×–8×); double-click target is 200%; the union narrowing in Preview is by `in` operator, unambiguous.
