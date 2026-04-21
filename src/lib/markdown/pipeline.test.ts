import { describe, it, expect } from "vitest";
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

  it("strips script tags from raw HTML in source", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>\n\n# ok\n");
    expect(html).not.toContain("<script");
    expect(html).toContain("<h1>ok</h1>");
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
