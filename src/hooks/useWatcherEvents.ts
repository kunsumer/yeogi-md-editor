import { useEffect } from "react";
import { onFileChanged, onWatcherLost } from "../lib/ipc/events";
import { useDocuments } from "../state/documents";
import { decideOnExternalChange } from "../lib/conflict";
import { fsRead } from "../lib/ipc/commands";

export function useWatcherEvents(onWatcherOffline: (reason: string) => void) {
  useEffect(() => {
    const unfile = onFileChanged(async ({ path, mtime_ms }) => {
      const doc = useDocuments.getState().documents.find((d) => d.path === path);
      if (!doc) return;
      const decision = decideOnExternalChange({
        diskMtime: mtime_ms,
        savedMtime: doc.savedMtime,
        isDirty: doc.isDirty,
      });
      if (decision === "ignore") return;
      if (decision === "silent-reload") {
        const r = await fsRead(path);
        useDocuments
          .getState()
          .replaceContentFromDisk(doc.id, { content: r.content, mtimeMs: r.mtime_ms });
        return;
      }
      useDocuments.getState().setConflict(doc.id, { diskMtime: mtime_ms });
    });
    const ulost = onWatcherLost((reason) => onWatcherOffline(reason));
    return () => {
      unfile.then((fn) => fn());
      ulost.then((fn) => fn());
    };
  }, [onWatcherOffline]);
}
