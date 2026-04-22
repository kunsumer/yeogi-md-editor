import { useEffect, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { renderMarkdown } from "../../lib/markdown/pipeline";
import { safeReplaceChildren } from "../../lib/safeInsertHtml";
import { slugify } from "../../lib/slug";
import "./preview-content.css";

interface Props {
  content: string;
}

const wrap: React.CSSProperties = {
  height: "100%",
  width: "100%",
  minWidth: 0,
  overflow: "auto",
  background: "var(--bg)",
};

const inner: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "32px 40px 64px",
};

export function PreviewPane({ content }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const html = await renderMarkdown(content);
      if (cancelled || !hostRef.current) return;
      safeReplaceChildren(hostRef.current, html);
      attachCopyButtons(hostRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [content]);

  // Intercept link clicks and open in the OS default browser so the webview
  // isn't navigated away from the app.
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
    // In-document fragment links (#heading) slug-match against the
    // rendered headings. We don't inject id= attributes into the HTML —
    // matching on slugified textContent works for the standard
    // `[Heading](#heading)` markdown convention users write.
    if (href.startsWith("#") && hostRef.current) {
      const target = href.slice(1);
      if (!target) return;
      const headings = hostRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const h of Array.from(headings)) {
        if (slugify((h as HTMLElement).textContent ?? "") === target) {
          (h as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    }
  }

  return (
    <div style={wrap}>
      <div ref={hostRef} className="preview-content" style={inner} onClick={onHostClick} />
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
