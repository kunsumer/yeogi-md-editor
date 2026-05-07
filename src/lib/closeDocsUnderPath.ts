import { useDocuments } from "../state/documents";
import { useLayout } from "../state/layout";

/**
 * After a file or folder is deleted on disk, close every open tab whose
 * document path is at or under `deletedPath`, and drop the underlying
 * buffers. Called from the delete-confirmation flow in FileTree and
 * FolderPanel so the editor doesn't sit on stale tabs pointing at files
 * that no longer exist.
 *
 * No dirty-check prompt — the user already explicitly confirmed a
 * destructive delete, so a follow-up "save your unsaved changes?" prompt
 * would be misleading.
 */
export function closeDocsUnderPath(deletedPath: string): void {
  const docs = useDocuments.getState().documents;
  const isUnder = (p: string | null) =>
    p != null && (p === deletedPath || p.startsWith(deletedPath + "/"));
  const ids = docs.filter((d) => isUnder(d.path)).map((d) => d.id);
  if (ids.length === 0) return;

  // Drop the tabs from each pane first so the layout no longer references
  // the doomed buffers; then drop the buffers themselves. closeTab handles
  // pane-empty cases internally (e.g. dropping secondary when its last tab
  // goes away).
  const layoutA = useLayout.getState();
  for (const id of ids) {
    if (layoutA.primary.tabs.includes(id)) layoutA.closeTab("primary", id);
  }
  const layoutB = useLayout.getState();
  for (const id of ids) {
    if (layoutB.secondary?.tabs.includes(id)) layoutB.closeTab("secondary", id);
  }
  const docState = useDocuments.getState();
  for (const id of ids) docState.closeDocument(id);
}
