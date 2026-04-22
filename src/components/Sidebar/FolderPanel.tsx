import { FileTree } from "../FileTree";
import { AsidePanel } from "./AsidePanel";

interface Props {
  /** Absolute filesystem path; null means no folder has been picked yet. */
  folder: string | null;
  /** Called when the user clicks "Choose folder…" — App.tsx owns the dialog. */
  onPickFolder(): void;
  /** Forwarded to FileTree — opens the clicked file as a tab. */
  onOpenFile(path: string): void;
}

export function FolderPanel({ folder, onPickFolder, onOpenFile }: Props) {
  const title = folder ? (folder.split("/").pop() ?? "Folder") : "Folder";
  return (
    <AsidePanel title={title} ariaLabel="Folder Explorer">
      {folder == null ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "24px 8px",
            color: "var(--text-muted)",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          <span>No folder open.</span>
          <button type="button" className="btn-primary" onClick={onPickFolder}>
            Choose folder…
          </button>
        </div>
      ) : (
        <FileTree root={folder} onOpenFile={onOpenFile} />
      )}
    </AsidePanel>
  );
}
