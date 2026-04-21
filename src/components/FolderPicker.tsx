import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onPick: (path: string) => void;
}

export function FolderPicker({ onPick }: Props) {
  async function handleClick() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") onPick(picked);
  }
  return <button onClick={handleClick}>Open folder…</button>;
}
