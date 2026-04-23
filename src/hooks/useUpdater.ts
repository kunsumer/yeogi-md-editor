import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Tauri updater integration.
 *
 * - On app startup, `check()` silently hits the manifest endpoint configured
 *   in `tauri.conf.json`. If a newer version is available, we surface it as
 *   state (the App shell renders a banner offering Install + Later).
 * - Manual triggers (Help → Check for Updates…) route through `runCheck()`
 *   and report status for user-visible feedback.
 * - `applyUpdate()` downloads + verifies + installs, then relaunches. The
 *   Tauri runtime writes the new .app in place; on macOS the running
 *   process exits via `relaunch()` and the OS respawns the replacement.
 *
 * The updater only works once the user has:
 *   1. Generated a signing key pair  (`pnpm tauri signer generate …`)
 *   2. Pasted the public key into `tauri.conf.json` → `plugins.updater.pubkey`
 *   3. Replaced the placeholder GitHub endpoint with their own
 *   4. Set `TAURI_SIGNING_PRIVATE_KEY` (+ optional passphrase) at build time
 *      so each release gets a `.app.tar.gz.sig`
 * Until those are in place, `check()` rejects locally and we silently swallow
 * the error — the banner simply never appears.
 */

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; received: number; total: number | null }
  | { kind: "installing"; update: Update }
  | { kind: "installed"; update: Update }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

export function useUpdater({ checkOnStartup }: { checkOnStartup: boolean }) {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const startedRef = useRef(false);

  const runCheck = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setStatus({ kind: "checking" });
    try {
      const update = await check();
      if (update) {
        setStatus({ kind: "available", update });
      } else if (!silent) {
        setStatus({ kind: "up-to-date" });
      }
    } catch (err) {
      // In dev / unconfigured builds the updater rejects here. When the user
      // asked explicitly (Help → Check for Updates…) surface the message;
      // otherwise stay quiet so the app feels normal.
      if (!silent) {
        setStatus({ kind: "error", message: String(err) });
      } else {
        console.warn("[updater] check failed:", err);
      }
    }
  }, []);

  const applyUpdate = useCallback(async (update: Update) => {
    try {
      setStatus({ kind: "downloading", update, received: 0, total: null });
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setStatus({
            kind: "downloading",
            update,
            received: 0,
            total: event.data.contentLength ?? null,
          });
        } else if (event.event === "Progress") {
          setStatus((prev) =>
            prev.kind === "downloading"
              ? {
                  ...prev,
                  received: prev.received + event.data.chunkLength,
                }
              : prev,
          );
        } else if (event.event === "Finished") {
          setStatus({ kind: "installing", update });
        }
      });
      setStatus({ kind: "installed", update });
      // Short delay so the user sees the "installed" state before the
      // relaunch flashes everything away.
      setTimeout(() => {
        relaunch().catch((err) => console.error("[updater] relaunch failed:", err));
      }, 400);
    } catch (err) {
      setStatus({ kind: "error", message: String(err) });
    }
  }, []);

  const dismiss = useCallback(() => {
    setStatus({ kind: "idle" });
  }, []);

  useEffect(() => {
    if (!checkOnStartup || startedRef.current) return;
    startedRef.current = true;
    // Defer past the initial paint so startup isn't blocked on a network
    // round-trip the user doesn't care about yet.
    const handle = window.setTimeout(() => {
      runCheck({ silent: true });
    }, 3000);
    return () => window.clearTimeout(handle);
  }, [checkOnStartup, runCheck]);

  return { status, runCheck, applyUpdate, dismiss };
}
