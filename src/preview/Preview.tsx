import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { renderMarkdown } from "../lib/markdown/pipeline";
import { safeReplaceChildren } from "../lib/safeInsertHtml";
import "../components/PreviewPane/preview-content.css";

interface Props {
  docId: string;
}

export function Preview({ docId }: Props) {
  const [orphan, setOrphan] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unlisten = listen<{ id: string; content: string }>(
      "preview.contentUpdate",
      async (e) => {
        if (e.payload.id !== docId) return;
        const html = await renderMarkdown(e.payload.content);
        if (!hostRef.current) return;
        safeReplaceChildren(hostRef.current, html);
        attachCopyButtons(hostRef.current);
      },
    );
    const unorphan = listen("editor.closed", () => setOrphan(true));
    return () => {
      unlisten.then((fn) => fn());
      unorphan.then((fn) => fn());
    };
  }, [docId]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {orphan && (
        <div role="alert" style={{ background: "#f4f4f4", padding: 8, marginBottom: 12 }}>
          Editor closed — this preview is read-only.
        </div>
      )}
      <div ref={hostRef} className="preview-content" />
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
