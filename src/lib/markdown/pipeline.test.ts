import { describe, it, expect, vi } from "vitest";
import { safeReplaceChildren } from "../safeInsertHtml";

// Mermaid uses DOM APIs (getBBox, getComputedTextLength, etc.) that jsdom
// does not implement. The plugin's branching logic is what we want to verify
// here; the actual SVG rasterization is mermaid's responsibility and gets
// exercised manually in the real WebKit window.
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => {
      if (!code.startsWith("flowchart") && !code.startsWith("sequenceDiagram")) {
        throw new Error("Parse error: not a recognized diagram");
      }
      return { svg: "<svg viewBox='0 0 100 100'><g/></svg>" };
    }),
  },
}));

import { renderMarkdown } from "./pipeline";

describe("renderMarkdown", () => {
  it("renders GFM headings and tables", async () => {
    const html = await renderMarkdown("# Hi\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain("<table>");
  });

  it("renders math via katex", async () => {
    const html = await renderMarkdown("$E=mc^2$");
    expect(html).toContain("katex");
  });

  it("script tags in the source are stripped at the DOM insertion boundary", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>\n\n# ok\n");
    // The pipeline itself intentionally does NOT sanitize (it preserves the
    // full cast of SVG attributes mermaid needs). Sanitation happens in
    // safeReplaceChildren via DOMPurify. The heading renders either way.
    expect(html).toContain("<h1>ok</h1>");
    const host = document.createElement("div");
    safeReplaceChildren(host, html);
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("h1")?.textContent).toBe("ok");
  });

  it("converts mermaid fences to svg (or error block on bad syntax)", async () => {
    const good = await renderMarkdown("```mermaid\nflowchart TD; A-->B;\n```\n");
    expect(good).toMatch(/<svg/);
    const bad = await renderMarkdown("```mermaid\nthis is not mermaid\n```\n");
    expect(bad).toContain("mermaid-error");
  });

  it("continues rendering when math is malformed", async () => {
    const html = await renderMarkdown("# Ok\n\n$\\frac{}{}$ $E=mc^2$\n");
    expect(html).toContain("<h1>Ok</h1>");
    expect(html).toContain("katex");
  });

  it("renders shiki-highlighted code blocks", async () => {
    const html = await renderMarkdown("```ts\nconst a: number = 1;\n```\n");
    expect(html).toContain("<pre");
    // @shikijs/rehype emits inline background + per-token color spans;
    // no class="shiki" in the modern API, so we assert the styling instead.
    expect(html).toMatch(/background-color:#[0-9a-fA-F]{3,8}/);
    expect(html).toMatch(/<span style="color:#[0-9a-fA-F]{3,8}/);
  });
});
