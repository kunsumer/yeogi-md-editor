pub mod types;
pub mod fs;
pub mod watcher;
pub mod commands;
pub mod menu;

use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

use crate::watcher::{Watcher, WatcherEvent};

pub struct AppState {
    pub watcher: Arc<Mutex<watcher::Watcher>>,
    pub external_open: Mutex<ExternalOpenState>,
}

#[derive(Default)]
pub struct ExternalOpenState {
    frontend_ready: bool,
    pending_paths: Vec<String>,
}

impl ExternalOpenState {
    /// Queue paths until the webview has installed its event listener. Once
    /// ready, live opens can be emitted immediately.
    fn receive(&mut self, paths: Vec<String>) -> Option<Vec<String>> {
        if self.frontend_ready {
            Some(paths)
        } else {
            self.pending_paths.extend(paths);
            None
        }
    }

    /// Atomically switch to live delivery and drain files received during
    /// startup. Keeping both operations under one lock closes the gap where
    /// a Finder open could otherwise arrive between them.
    fn mark_frontend_ready(&mut self) -> Vec<String> {
        self.frontend_ready = true;
        std::mem::take(&mut self.pending_paths)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<WatcherEvent>();
    let watcher = Arc::new(Mutex::new(
        Watcher::new(tx).expect("watcher init"),
    ));

    // Note: we intentionally do NOT intercept CloseRequested. The webview's
    // autosave hook flushes every 2 s and on edit, so the native close
    // path is safe for the default configuration. If we ever add a
    // confirm-on-dirty dialog back, it has to live behind a mechanism that
    // can't itself block the close (e.g., a synchronous Rust-side flush).
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Updater checks a hosted manifest for a newer version, downloads
        // the matching platform artifact, verifies the minisign signature
        // (pubkey in tauri.conf.json), and swaps the .app on relaunch.
        // Works without Apple Developer signing — Tauri's own signature
        // gates the update, not Gatekeeper.
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Used by the frontend to relaunch the app after an update is
        // applied (so the user doesn't have to quit + reopen manually).
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            watcher: watcher.clone(),
            external_open: Mutex::new(ExternalOpenState::default()),
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.clone());
        })
        .setup(move |app| {
            // Initial menu: empty recent-files list, "system" theme. The
            // frontend pushes its persisted preferences on mount via
            // `sync_menu_state`, which rebuilds + swaps in one shot.
            let menu = menu::build_menu(app.handle(), &[], "system", true)?;
            app.set_menu(menu)?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(evt) = rx.recv() {
                    let name = match &evt {
                        WatcherEvent::Changed { .. } => "file:changed",
                        WatcherEvent::Lost { .. } => "watcher:lost",
                    };
                    let _ = handle.emit(name, evt);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs_read,
            commands::fs_write,
            commands::fs_create,
            commands::fs_create_dir,
            commands::fs_rename,
            commands::fs_list,
            commands::watcher_subscribe,
            commands::window_open_preview,
            commands::window_close,
            commands::app_exit,
            commands::ensure_welcome_file,
            commands::reseed_welcome_file,
            commands::sync_menu_state,
            commands::fs_copy,
            commands::fs_delete,
            commands::fs_count_recursive,
            commands::shell_reveal_in_finder,
            commands::shell_open_in_terminal,
            commands::external_open_ready,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Finder "Open With" on a .md file sends a RunEvent::Opened
            // carrying the file URLs. Forward their filesystem paths to the
            // webview so App.tsx can openFile each one. Paths the webview
            // already has open are deduped by useDocuments.openDocument.
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !paths.is_empty() {
                    // On a cold launch macOS can deliver RunEvent::Opened
                    // before React has mounted and subscribed. Buffer those
                    // paths; external_open_ready drains them after the
                    // frontend listener is installed. Once ready, preserve
                    // the existing live event path for subsequent opens.
                    let paths_to_emit = {
                        let state = app.state::<AppState>();
                        let result = match state.external_open.lock() {
                            Ok(mut external_open) => external_open.receive(paths),
                            // If the mutex is poisoned, emitting is still a
                            // better fallback than silently dropping files.
                            Err(_) => Some(paths),
                        };
                        result
                    };
                    if let Some(paths) = paths_to_emit {
                        let _ = app.emit("files-opened", paths);
                    }
                    // Bring the app forward so the user can see the file
                    // they just opened from Finder / `open`. Best-effort:
                    // unminimize + show + focus covers background, minimized,
                    // and cold-launch-by-Finder. set_focus activates the app
                    // on macOS.
                    if let Some(win) = app.get_webview_window("main") {
                        let _ = win.unminimize();
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::ExternalOpenState;

    #[test]
    fn external_opens_are_queued_until_frontend_is_ready() {
        let mut state = ExternalOpenState::default();

        assert_eq!(state.receive(vec!["/first.md".into()]), None);
        assert_eq!(state.receive(vec!["/second.md".into()]), None);
        assert_eq!(
            state.mark_frontend_ready(),
            vec!["/first.md".to_string(), "/second.md".to_string()]
        );
        assert!(state.mark_frontend_ready().is_empty());
    }

    #[test]
    fn external_opens_are_delivered_live_after_frontend_is_ready() {
        let mut state = ExternalOpenState::default();
        assert!(state.mark_frontend_ready().is_empty());

        assert_eq!(
            state.receive(vec!["/live.md".into()]),
            Some(vec!["/live.md".to_string()])
        );
    }
}
