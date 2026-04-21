import { useEffect, useRef } from "react";
import { renderMarkdown } from "../../lib/markdown/pipeline";
import { safeReplaceChildren } from "../../lib/safeInsertHtml";

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
  fontSize: 15,
  lineHeight: 1.7,
  color: "var(--text)",
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

  return (
    <div style={wrap}>
      <div ref={hostRef} style={inner} />
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
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(code.textContent || "");
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    });
    pre.prepend(btn);
  });
}
