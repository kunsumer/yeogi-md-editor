pub mod types;
pub mod fs;
pub mod watcher;
pub mod commands;
pub mod menu;

use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use crate::watcher::{Watcher, WatcherEvent};

pub struct AppState {
    pub watcher: Arc<Mutex<watcher::Watcher>>,
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
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.clone());
        })
        .setup(move |app| {
            // Initial menu: empty recent-files list, "system" theme. The
            // frontend pushes its persisted preferences on mount via
            // `sync_menu_state`, which rebuilds + swaps in one shot.
            let menu = menu::build_menu(app.handle(), &[], "system")?;
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
            commands::fs_rename,
            commands::fs_list,
            commands::watcher_subscribe,
            commands::window_open_preview,
            commands::window_close,
            commands::app_exit,
            commands::ensure_welcome_file,
            commands::sync_menu_state,
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
                    let _ = app.emit("files-opened", paths);
                }
            }
        });
}
