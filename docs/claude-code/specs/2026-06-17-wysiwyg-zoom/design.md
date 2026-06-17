# WYSIWYG Click-to-Zoom for Diagrams & Images — Design

**Status:** design (approved 2026-06-17), pending written-spec review
**Platform:** macOS desktop. Builds on `2026-06-17-desktop-zoom-and-focus` (the
`Lightbox` shipped in v0.5.3 for the Preview window).

## Problem
The zoom `Lightbox` exists only in the dedicated Preview window. Users view and
edit mostly in the **WYSIWYG editor**, where clicking a Mermaid diagram or image
does nothing — there's no way to enlarge a dense diagram where you actually work.

## Goal
Let the user open the same fullscreen zoom `Lightbox` from the WYSIWYG editor by
hovering a Mermaid diagram or image and clicking a small **⤢ expand button** —
without disturbing the existing selection / image-resize behavior.

## Constraints discovered
- **Mermaid** is a custom React node view (`MermaidView`, `contentEditable=false`),
  with the rendered `<svg>` inside a `.mermaid` div.
- **Images** render via Tiptap's image extension (`ResizableImage extends
  @tiptap/extension-image`) — a plain `<img>` whose plain click selects it for
  resizing (resize handles at the bottom corners). There is no React node view
  to hang a button on, and the resize feature must not be disturbed.
- Therefore: **do not modify the node views.** Add one editor-scoped affordance
  layer instead.

## Approach: one editor-level hover-affordance layer, reusing `Lightbox`

### Components
- **Reused as-is:** `src/components/Lightbox/Lightbox.tsx` (+ `Lightbox.css`) —
  the fullscreen zoom/pan viewer already built for the Preview window. Props:
  `{ image?: { src; alt }; svg?: string; onClose() }`.
- **New — `src/components/WysiwygEditor/useZoomAffordance.tsx`** (hook +
  colocated floating-button render): given the editor root element
  (`editor.view.dom`) and the positioning container (`.wysiwyg-scroll`), it:
  1. Delegates `mouseover`/`mouseout` on the editor root; when the pointer is
     over an `img` or a `.mermaid` block (via `closest()`), records that element
     as the hover target and computes a position for the button at the
     element's **top-right** corner (clear of the bottom-corner resize handles),
     relative to the scroll container (accounting for its scrollTop/Left).
  2. Renders a small **⤢** button (`aria-label="Zoom in"`) at that position;
     the button stays visible while hovering it (so it's clickable) and hides
     shortly after the pointer leaves both the target and the button.
  3. On click: if the target is an `img`, open with `{ image: { src, alt } }`;
     if `.mermaid`, read its child `svg.outerHTML` and open with `{ svg }`.
  4. Owns the `Lightbox` open-state and renders `<Lightbox …/>` when set.
- **Modified — `src/components/WysiwygEditor/WysiwygEditor.tsx`:** mount the hook
  once the editor exists, passing `editor.view.dom`; render the affordance's
  button + `Lightbox` output inside the `.wysiwyg-scroll` container (which gets
  `position: relative` so the absolutely-positioned button anchors correctly).
- **CSS — `src/components/WysiwygEditor/wysiwyg.css`** (or `Lightbox.css`): the
  floating `.wysiwyg-zoom-btn` (absolute, small, themed, subtle shadow,
  fade-in). The `Lightbox` overlay styles already exist.

### Data flow
hover `img`/`.mermaid` → affordance positions the ⤢ button → click → read
`src` (image) or `svg.outerHTML` (mermaid) → open `Lightbox` → Esc / backdrop /
✕ closes and clears state.

### Why an editor-level layer (not per-node buttons)
A single delegated hover layer covers both element types, needs no change to
`MermaidView` or `ResizableImage`, and cannot regress Mermaid rendering or image
resize/selection. It's self-contained and testable against a plain DOM host.

## What is NOT touched
`MermaidView`, `ResizableImage`, image resize/selection, the Preview window
(already has zoom), the Rust backend, any mobile code.

## Testing
- **`useZoomAffordance.test.tsx`** (Vitest + RTL): in a host containing an
  `<img>` and a `<div class="mermaid"><svg/></div>`, dispatching `mouseover` on
  each shows the ⤢ button; clicking it invokes the open handler with the right
  payload (`{image:{src,…}}` vs `{svg:"…<svg…"}`); `mouseout` to outside hides
  the button. (The `Lightbox` itself is already unit-tested.)
- Full suite (`pnpm vitest run`) + `pnpm tsc --noEmit` stay green; the existing
  WysiwygEditor tests are unaffected.
- Manual (real WebView): hover a diagram/image in the editor → ⤢ appears →
  click → zoom; verify image resize + node selection still behave as before.

## Risks
- **Button position drift on scroll/resize:** recompute on the relevant
  `mouseover` (cheap) and hide on scroll; acceptable since it's a transient
  hover affordance, not a pinned overlay.
- **Hover flicker between target and button:** keep the button visible while the
  pointer is over either; hide on a short timeout after leaving both.
- **Mermaid still rendering (no `svg` yet):** if the `.mermaid` has no `svg`
  child (error block or mid-render), the button does nothing / isn't shown.

## Non-goals (this iteration)
- Touch/pinch zoom (desktop).
- Zoom for other block types (code, tables).
- Replacing the image resize handles with the zoom affordance.
