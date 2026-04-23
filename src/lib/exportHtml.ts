// Inline the preview stylesheet + KaTeX at build time via Vite's ?raw
// suffix so exported HTML renders identically offline, with no external deps.
import previewCss from "../components/PreviewPane/preview-content.css?raw";
import katexCss from "katex/dist/katex.min.css?raw";

const BASE_CSS = `
:root {
  --bg: #ffffff;
  --bg-sidebar: #fafafa;
  --text: #1a1a1a;
  --text-muted: #6b7280;
  --text-faint: #9ca3af;
  --border: #e5e7eb;
  --border-strong: #d1d5db;
  --accent: #0969da;
  --danger: #d1242f;
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 40px 56px 72px;
  max-width: 820px;
  margin-inline: auto;
  font-family: var(--font-ui);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
`;

export function buildStandaloneHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${BASE_CSS}</style>
<style>${previewCss}</style>
<style>${katexCss}</style>
</head>
<body>
<main class="preview-content">
${bodyHtml}
</main>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
