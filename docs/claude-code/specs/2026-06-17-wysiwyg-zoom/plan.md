# WYSIWYG Click-to-Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users open the existing fullscreen zoom `Lightbox` from the WYSIWYG editor by hovering a Mermaid diagram or image and clicking a small ⤢ button — without disturbing selection or image resize.

**Architecture:** One editor-scoped layer (`EditorZoomLayer`) mounted inside `.wysiwyg-scroll`. It delegates `mouseover`/`mouseout` on `editor.view.dom`, surfaces a floating ⤢ button at the hovered `img`/`.mermaid` block's top-right, and opens the already-built `Lightbox` with the image `src` or the diagram's `svg.outerHTML`. A pure `zoomTargetFromElement` helper does the element→payload mapping (unit-tested in isolation). The Mermaid node view and image extension are not touched.

**Tech Stack:** TypeScript, React 18, Tiptap (`@tiptap/react`), Vitest + @testing-library/react.

---

## File Structure

**New:**
- `src/components/WysiwygEditor/zoomTargetFromElement.ts` — pure element→`ZoomTarget` mapping.
- `src/components/WysiwygEditor/zoomTargetFromElement.test.ts`
- `src/components/WysiwygEditor/EditorZoomLayer.tsx` — hover-affordance + Lightbox wiring.
- `src/components/WysiwygEditor/EditorZoomLayer.test.tsx`

**Modified:**
- `src/components/WysiwygEditor/WysiwygEditor.tsx` — mount `<EditorZoomLayer>` inside `.wysiwyg-scroll`.
- `src/components/WysiwygEditor/wysiwyg.css` — `.wysiwyg-scroll { position: relative }` + `.wysiwyg-zoom-btn` styles.

**Reused, unchanged:** `src/components/Lightbox/Lightbox.tsx` (+ `.css`), and the `ZoomTarget` type from `src/components/Lightbox/attachZoomTargets.ts`.

**Untouched:** `nodes/Mermaid.tsx`, `nodes/ResizableImage.ts`, image resize/selection, the Preview window.

---

## Task 1: `zoomTargetFromElement` helper

**Files:**
- Create: `src/components/WysiwygEditor/zoomTargetFromElement.ts`
- Test: `src/components/WysiwygEditor/zoomTargetFromElement.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/WysiwygEditor/zoomTargetFromElement.test.ts
import { describe, it, expect } from "vitest";
import { zoomTargetFromElement } from "./zoomTargetFromElement";

function el(html: string): Element {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild as Element;
}

describe("zoomTargetFromElement", () => {
  it("maps an <img> to an image target", () => {
    const t = zoomTargetFromElement(el(`<img src="/a.png" alt="A">`));
    expect(t).toEqual({ image: { src: expect.stringContaining("a.png"), alt: "A" } });
  });

  it("maps a .mermaid block (with svg) to an svg target", () => {
    const t = zoomTargetFromElement(el(`<div class="mermaid"><svg id="m"><rect/></svg></div>`));
    expect(t && "svg" in t && t.svg).toContain("<svg");
  });

  it("returns null for a .mermaid block that has no svg yet", () => {
    expect(zoomTargetFromElement(el(`<div class="mermaid"></div>`))).toBeNull();
  });

  it("returns null for an unrelated element", () => {
    expect(zoomTargetFromElement(el(`<p>hi</p>`))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WysiwygEditor/zoomTargetFromElement.test.ts`
Expected: FAIL — cannot resolve `./zoomTargetFromElement`.

- [ ] **Step 3: Write the implementation**

```ts
// src/components/WysiwygEditor/zoomTargetFromElement.ts
import type { ZoomTarget } from "../Lightbox/attachZoomTargets";

/**
 * Map a hovered editor element (an <img> or a `.mermaid` block) to the
 * payload the Lightbox needs, or null if it isn't zoomable (e.g. a Mermaid
 * block still rendering / in an error state, with no <svg> child).
 */
export function zoomTargetFromElement(el: Element): ZoomTarget | null {
  if (el.tagName === "IMG") {
    const img = el as HTMLImageElement;
    return { image: { src: img.currentSrc || img.src, alt: img.alt } };
  }
  if (el.classList.contains("mermaid")) {
    const svg = el.querySelector("svg");
    if (svg) return { svg: svg.outerHTML };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/WysiwygEditor/zoomTargetFromElement.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/WysiwygEditor/zoomTargetFromElement.ts src/components/WysiwygEditor/zoomTargetFromElement.test.ts
git commit -m "feat(wysiwyg): add zoomTargetFromElement helper"
```

---

## Task 2: `EditorZoomLayer` component + styles

**Files:**
- Create: `src/components/WysiwygEditor/EditorZoomLayer.tsx`
- Test: `src/components/WysiwygEditor/EditorZoomLayer.test.tsx`
- Modify: `src/components/WysiwygEditor/wysiwyg.css`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/WysiwygEditor/EditorZoomLayer.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { EditorZoomLayer } from "./EditorZoomLayer";

afterEach(() => { document.body.innerHTML = ""; });

// Build a `.wysiwyg-scroll > .ProseMirror` host with the given inner HTML and
// a minimal editor stub exposing only `view.dom` (all EditorZoomLayer uses).
function makeEditor(innerHTML: string): { editor: Editor; dom: HTMLElement } {
  const scroll = document.createElement("div");
  scroll.className = "wysiwyg-scroll";
  const dom = document.createElement("div");
  dom.className = "ProseMirror";
  dom.innerHTML = innerHTML;
  scroll.appendChild(dom);
  document.body.appendChild(scroll);
  return { editor: { view: { dom } } as unknown as Editor, dom };
}

describe("EditorZoomLayer", () => {
  it("shows the ⤢ button on image hover and opens the image lightbox", () => {
    const { editor, dom } = makeEditor(`<p>x</p><img src="/a.png" alt="A">`);
    render(<EditorZoomLayer editor={editor} />);
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    fireEvent.mouseOver(dom.querySelector("img")!);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("dialog", { name: "Image viewer" })).toBeInTheDocument();
  });

  it("shows the ⤢ button on mermaid hover and opens the diagram lightbox", () => {
    const { editor, dom } = makeEditor(`<div class="mermaid"><svg id="m"><rect/></svg></div>`);
    render(<EditorZoomLayer editor={editor} />);
    fireEvent.mouseOver(dom.querySelector("svg")!);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("dialog", { name: "Diagram viewer" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/WysiwygEditor/EditorZoomLayer.test.tsx`
Expected: FAIL — cannot resolve `./EditorZoomLayer`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/WysiwygEditor/EditorZoomLayer.tsx
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Lightbox } from "../Lightbox/Lightbox";
import type { ZoomTarget } from "../Lightbox/attachZoomTargets";
import { zoomTargetFromElement } from "./zoomTargetFromElement";

interface Props {
  editor: Editor;
}

interface BtnPos {
  top: number;
  left: number;
  el: Element;
}

/**
 * Editor-scoped hover affordance: when the pointer is over a zoomable element
 * (an <img> or a rendered `.mermaid` diagram) in the editor, show a small ⤢
 * button at its top-right; clicking it opens the shared fullscreen Lightbox.
 * Listens on `editor.view.dom` and positions the button within the enclosing
 * `.wysiwyg-scroll`. Does not touch selection or image-resize — those still
 * respond to plain clicks as before.
 */
export function EditorZoomLayer({ editor }: Props) {
  const [pos, setPos] = useState<BtnPos | null>(null);
  const [zoom, setZoom] = useState<ZoomTarget | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    const root = editor.view.dom as HTMLElement;
    const scroll = (root.closest(".wysiwyg-scroll") as HTMLElement | null) ?? root;

    const cancelHide = () => {
      if (hideTimer.current != null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimer.current = window.setTimeout(() => setPos(null), 150);
    };

    const onOver = (e: Event) => {
      const t = e.target as HTMLElement;
      const el = (t.closest?.("img, .mermaid") as Element | null) ?? null;
      if (!el || !zoomTargetFromElement(el)) return;
      cancelHide();
      const sRect = scroll.getBoundingClientRect();
      const tRect = el.getBoundingClientRect();
      setPos({
        top: tRect.top - sRect.top + scroll.scrollTop + 6,
        left: tRect.right - sRect.left + scroll.scrollLeft - 34,
        el,
      });
    };
    const onOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related?.closest?.(".wysiwyg-zoom-btn, img, .mermaid")) return;
      scheduleHide();
    };

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      cancelHide();
    };
  }, [editor]);

  return (
    <>
      {pos && (
        <button
          type="button"
          className="wysiwyg-zoom-btn"
          aria-label="Zoom in"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => {
            if (hideTimer.current != null) {
              window.clearTimeout(hideTimer.current);
              hideTimer.current = null;
            }
          }}
          onClick={() => {
            const t = zoomTargetFromElement(pos.el);
            if (t) setZoom(t);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      )}
      {zoom && (
        <Lightbox
          image={"image" in zoom ? zoom.image : undefined}
          svg={"svg" in zoom ? zoom.svg : undefined}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/WysiwygEditor/EditorZoomLayer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the styles**

Append to `src/components/WysiwygEditor/wysiwyg.css`:
```css
/* Anchor the editor zoom affordance button. */
.wysiwyg-scroll {
  position: relative;
}
.wysiwyg-zoom-btn {
  position: absolute;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  cursor: zoom-in;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  opacity: 0.92;
}
.wysiwyg-zoom-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
}
```

- [ ] **Step 6: Verify styles didn't break the build**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/WysiwygEditor/EditorZoomLayer.tsx src/components/WysiwygEditor/EditorZoomLayer.test.tsx src/components/WysiwygEditor/wysiwyg.css
git commit -m "feat(wysiwyg): add hover ⤢ zoom affordance layer"
```

---

## Task 3: Mount the layer in WysiwygEditor

**Files:**
- Modify: `src/components/WysiwygEditor/WysiwygEditor.tsx`

- [ ] **Step 1: Import the layer**

Add this import alongside the other component imports near the top of `src/components/WysiwygEditor/WysiwygEditor.tsx` (the file already imports `Toolbar`, `WysiwygSearchBar`, etc. from `./`):
```tsx
import { EditorZoomLayer } from "./EditorZoomLayer";
```

- [ ] **Step 2: Render the layer inside `.wysiwyg-scroll`**

Replace this block:
```tsx
      <div className="wysiwyg-scroll">
        <EditorContent editor={editor} className="wysiwyg-content preview-content" />
      </div>
```
with:
```tsx
      <div className="wysiwyg-scroll">
        <EditorContent editor={editor} className="wysiwyg-content preview-content" />
        {editor && <EditorZoomLayer editor={editor} />}
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/WysiwygEditor/WysiwygEditor.tsx
git commit -m "feat(wysiwyg): mount the zoom affordance in the editor"
```

---

## Task 4: Full regression + typecheck

- [ ] **Step 1: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full suite**

Run: `pnpm vitest run`
Expected: all green — the prior tests plus the 6 new ones (4 `zoomTargetFromElement` + 2 `EditorZoomLayer`); zero failures.

- [ ] **Step 3: Commit (only if incidental updates)**

```bash
git add -A && git commit -m "test(wysiwyg): green suite for editor zoom" || echo "nothing to commit"
```

---

## Task 5: Build + manual verification

- [ ] **Step 1: Build**

Run: `pnpm build && (cd src-tauri && cargo build)`
Expected: both succeed.

- [ ] **Step 2: Verify in the running app** (`pnpm tauri dev`)

- Open a document with an image and a Mermaid diagram in the WYSIWYG editor.
- Hover the diagram → a ⤢ button appears at its top-right → click it → fullscreen Lightbox with the diagram; scroll/buttons zoom, drag pans, Esc/backdrop/✕ closes.
- Hover an image → ⤢ appears → click → image zoom.
- Confirm plain click on an image still selects it with resize handles, and plain click on a diagram still selects the node — i.e. editing behavior is unchanged.

- [ ] **Step 3: Update spec status + commit**

Edit `docs/claude-code/specs/2026-06-17-wysiwyg-zoom/design.md`: set status to "✅ implemented + verified (2026-06-17)".
```bash
git add docs/claude-code/specs/2026-06-17-wysiwyg-zoom/design.md
git commit -m "docs(wysiwyg): mark editor zoom implemented"
```

---

## Self-Review

**Spec coverage:** reuse `Lightbox` (Task 2 imports it) ✓; editor-level hover layer surfacing ⤢ at top-right (Task 2) ✓; image→`src`, mermaid→`svg.outerHTML` mapping (Task 1, used in Task 2) ✓; mounted in `.wysiwyg-scroll`, node views untouched (Task 3) ✓; `.wysiwyg-scroll` positioning + button CSS (Task 2 Step 5) ✓; affordance unit tests (Tasks 1–2) ✓; regression (Task 4) + manual (Task 5) ✓.

**Placeholder scan:** none — every step has complete code/commands.

**Type consistency:** `ZoomTarget` (`{ image: {src,alt} } | { svg: string }`) from `attachZoomTargets.ts` is the return of `zoomTargetFromElement` (Task 1) and consumed in `EditorZoomLayer` via the same `"image" in zoom` / `"svg" in zoom` narrowing used in `Preview.tsx`. `Lightbox` props (`image?`, `svg?`, `onClose`) match. `EditorZoomLayer({ editor })` is rendered with the live `editor` and tested with a `{ view: { dom } }` stub — it only reads `editor.view.dom`, so the stub is sufficient.

**Ambiguity check:** the button hides on a 150 ms timeout after the pointer leaves both the target and the button (kept alive via the button's `onMouseEnter` + the `mouseout` relatedTarget guard); position is the target's top-right within `.wysiwyg-scroll`.
