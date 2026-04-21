pub mod types;
pub mod fs;
pub mod watcher;
pub mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

use crate::watcher::{Watcher, WatcherEvent};

pub struct AppState {
    pub watcher: Arc<Mutex<watcher::Watcher>>,
}

/// When true, the main window's CloseRequested is no longer intercepted —
/// the webview has finished its flush and wants the native close to proceed.
/// Flipped via the `allow_close` command from App.tsx's close handler.
pub static ALLOW_CLOSE: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<WatcherEvent>();
    let watcher = Arc::new(Mutex::new(
        Watcher::new(tx).expect("watcher init"),
    ));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            watcher: watcher.clone(),
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(evt) = rx.recv() {
                    let name = match &evt {
                        WatcherEvent::Changed { .. } => "file.changed",
                        WatcherEvent::Lost { .. } => "watcher.lost",
                    };
                    let _ = handle.emit(name, evt);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && !ALLOW_CLOSE.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window.emit("app.close-requested", ());
                }
            }
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
            commands::allow_close,
            commands::app_exit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
