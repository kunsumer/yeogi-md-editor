use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::fs;
use crate::types::{DirEntry, FileRead, FileWritten, FsError};
use crate::AppState;

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

/// Exit the whole process cleanly. Used by future menu items like Cmd-Q;
/// not on the red-X path (native close handles that directly now that the
/// window-event intercept is gone).
#[tauri::command]
pub fn app_exit(app: AppHandle) {
    app.exit(0);
}

/// Content of the bundled welcome / test document. Compiled into the binary
/// so the installed .app is self-contained — no external resource lookup,
/// no path-relative fragility.
const WELCOME_CONTENT: &str = include_str!("../resources/welcome.md");

/// On first run, seeds a "Welcome.md" file in the user's Documents folder
/// and returns its path. Subsequent calls return the same path without
/// overwriting, so the user's edits stick.
#[tauri::command]
pub fn ensure_welcome_file(app: AppHandle) -> Result<String, FsError> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| FsError::Io(format!("document_dir: {}", e)))?;
    let app_dir = docs.join("Yeogi .MD Editor");
    std::fs::create_dir_all(&app_dir).map_err(|e| FsError::Io(e.to_string()))?;
    let file_path = app_dir.join("Welcome.md");
    if !file_path.exists() {
        std::fs::write(&file_path, WELCOME_CONTENT).map_err(|e| FsError::Io(e.to_string()))?;
    }
    Ok(file_path.to_string_lossy().to_string())
}

/// Rebuild the native menu with a new "Open Recent" submenu and swap it in.
/// Called from the frontend whenever the MRU list in usePreferences changes
/// (including once at mount, so the menu is populated after hydration).
/// Paths are absolute; the basename is derived here so the frontend doesn't
/// have to know about filesystem separators.
#[tauri::command]
pub fn set_recent_files(app: AppHandle, paths: Vec<String>) -> Result<(), FsError> {
    let entries: Vec<crate::menu::RecentFile> = paths
        .into_iter()
        .map(|path| {
            let display = std::path::Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&path)
                .to_string();
            crate::menu::RecentFile { path, display }
        })
        .collect();
    let menu = crate::menu::build_menu(&app, &entries)
        .map_err(|e| FsError::Io(format!("menu build failed: {}", e)))?;
    app.set_menu(menu)
        .map_err(|e| FsError::Io(format!("set_menu failed: {}", e)))?;
    Ok(())
}
