import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onPickFiles: (paths: string[]) => void;
  onPickFolder: (path: string) => void;
}

export function OpenButtons({ onPickFiles, onPickFolder }: Props) {
  async function handleFiles() {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (Array.isArray(picked)) onPickFiles(picked);
    else if (typeof picked === "string") onPickFiles([picked]);
  }

  async function handleFolder() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") onPickFolder(picked);
  }

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
      <button onClick={handleFiles}>Open file(s)…</button>
      <button onClick={handleFolder}>Open folder…</button>
    </div>
  );
}
