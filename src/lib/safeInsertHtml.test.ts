import { describe, it, expect } from "vitest";
import { sanitizeHtml, safeReplaceChildren } from "./safeInsertHtml";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    expect(sanitizeHtml("<p>ok</p><script>bad()</script>")).not.toContain("script");
  });

  it("keeps common markup", () => {
    expect(sanitizeHtml("<h1>Hi</h1>")).toContain("<h1>Hi</h1>");
  });
});

describe("safeReplaceChildren", () => {
  it("parses cleaned html and replaces children", () => {
    const host = document.createElement("div");
    safeReplaceChildren(host, "<p>hello</p>");
    expect(host.querySelector("p")?.textContent).toBe("hello");
  });

  it("strips scripts before inserting", () => {
    const host = document.createElement("div");
    safeReplaceChildren(host, "<p>ok</p><script>1</script>");
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("p")?.textContent).toBe("ok");
  });
});
