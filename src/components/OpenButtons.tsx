import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onPickFiles: (paths: string[]) => void;
  onPickFolder: (path: string) => void;
}

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  paddingBottom: 4,
};

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
    <div style={wrap}>
      <button className="btn-primary" onClick={handleFiles} style={{ justifyContent: "center" }}>
        Open file(s)…
      </button>
      <button className="btn-ghost" onClick={handleFolder} style={{ justifyContent: "center" }}>
        Open folder…
      </button>
    </div>
  );
}
