import { useEffect, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { renderMarkdown } from "../../lib/markdown/pipeline";
import { safeReplaceChildren } from "../../lib/safeInsertHtml";
import { slugify } from "../../lib/slug";
import { resolveWikiLink } from "../../lib/resolveWikiLink";
import { createWikiLinkFile } from "../../lib/wikiLinkCreate";
import { fsRead, watcherSubscribe } from "../../lib/ipc/commands";
import { useDocuments } from "../../state/documents";
import { useLayout } from "../../state/layout";
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
  // isn't navigated away from the app. Wiki-links get resolved against the
  // active folder and opened as a tab.
  function onHostClick(e: React.MouseEvent<HTMLDivElement>) {
    const wiki = (e.target as HTMLElement).closest<HTMLElement>(".wikilink");
    if (wiki) {
      e.preventDefault();
      e.stopPropagation();
      const t =
        wiki.getAttribute("data-wiki-target") ?? (wiki.textContent ?? "").trim();
      if (t) openWikiTarget(t);
      return;
    }
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

  async function openWikiTarget(target: string) {
    const { folder } = useDocuments.getState();
    if (!folder) {
      console.info("wiki-link ignored: no folder open", target);
      return;
    }
    try {
      let found = await resolveWikiLink(folder, target);
      if (!found) {
        // Auto-create — matches Obsidian's create-on-click behavior.
        found = await createWikiLinkFile(folder, target);
        if (!found) {
          console.info("wiki-link: target has no valid filename", target);
          return;
        }
      }
      const existing = useDocuments
        .getState()
        .documents.find((d) => d.path === found);
      if (existing) {
        useLayout.getState().openInFocusedPane(existing.id);
        return;
      }
      const r = await fsRead(found);
      useDocuments.getState().openDocument({
        path: found,
        content: r.content,
        savedMtime: r.mtime_ms,
        encoding: r.encoding,
      });
      await watcherSubscribe(found);
    } catch (err) {
      console.warn("wiki-link resolve failed:", target, err);
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
