use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::fs;
use crate::types::{DirEntry, FileRead, FileWritten, FsError};
use crate::{AppState, ALLOW_CLOSE};

#[tauri::command]
pub fn fs_read(path: String) -> Result<FileRead, FsError> {
    fs::read(&path)
}

#[tauri::command]
pub fn fs_write(path: String, content: String) -> Result<FileWritten, FsError> {
    fs::write(&path, &content)
}

#[tauri::command]
pub fn fs_create(path: String) -> Result<(), FsError> {
    fs::create(&path)
}

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> Result<(), FsError> {
    fs::rename(&from, &to)
}

#[tauri::command]
pub fn fs_list(path: String) -> Result<Vec<DirEntry>, FsError> {
    fs::list(&path)
}

#[tauri::command]
pub fn watcher_subscribe(path: String, state: State<AppState>) -> Result<(), FsError> {
    state
        .watcher
        .lock()
        .map_err(|_| FsError::Io("watcher mutex poisoned".into()))?
        .subscribe(&path)
        .map_err(|e| FsError::Io(e.to_string()))
}

#[tauri::command]
pub fn window_open_preview(
    app: AppHandle,
    label: String,
    title: String,
    doc_id: String,
) -> Result<(), FsError> {
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }
    let url = WebviewUrl::App(format!("preview.html?docId={}", doc_id).into());
    WebviewWindowBuilder::new(&app, label, url)
        .title(title)
        .inner_size(900.0, 700.0)
        .build()
        .map(|_| ())
        .map_err(|e| FsError::Io(e.to_string()))
}

#[tauri::command]
pub fn window_close(app: AppHandle, label: String) -> Result<(), FsError> {
    if let Some(w) = app.get_webview_window(&label) {
        w.close().map_err(|e| FsError::Io(e.to_string()))?;
    }
    Ok(())
}

/// Flip the ALLOW_CLOSE flag so the next `CloseRequested` for the main
/// window bypasses the intercept in `on_window_event` and closes natively.
/// Called by the webview after it finishes its flush-on-close flow.
#[tauri::command]
pub fn allow_close() {
    ALLOW_CLOSE.store(true, Ordering::Relaxed);
}

/// Exit the whole process cleanly. This is the last-resort close path the
/// webview uses if the cooperative close (allow_close + window.close) fails
/// for any reason.
#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}
