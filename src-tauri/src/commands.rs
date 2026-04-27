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
pub fn fs_copy(from: String, to: String) -> Result<(), FsError> {
    fs::copy(&from, &to)
}

#[tauri::command]
pub fn fs_list(path: String) -> Result<Vec<DirEntry>, FsError> {
    fs::list(&path)
}

#[tauri::command]
pub fn fs_delete(path: String) -> Result<(), FsError> {
    fs::delete(&path)
}

#[tauri::command]
pub fn fs_count_recursive(path: String) -> Result<u64, FsError> {
    fs::count_recursive(&path)
}

/// Reveal a file or folder in Finder (highlights it inside its parent
/// directory). macOS-only. Equivalent to right-click → Show in Finder.
#[tauri::command]
pub fn shell_reveal_in_finder(path: String) -> Result<(), FsError> {
    std::process::Command::new("open")
        .args(["-R", &path])
        .spawn()
        .map(|_| ())
        .map_err(|e| FsError::Io(format!("reveal failed: {e}")))
}

/// Open Terminal.app at the given directory (or the parent directory if
/// `path` points at a file). macOS-only.
#[tauri::command]
pub fn shell_open_in_terminal(path: String) -> Result<(), FsError> {
    let p = std::path::Path::new(&path);
    let dir = if p.is_dir() {
        p.to_path_buf()
    } else {
        p.parent()
            .map(|x| x.to_path_buf())
            .unwrap_or_else(|| p.to_path_buf())
    };
    std::process::Command::new("open")
        .args(["-a", "Terminal", &dir.to_string_lossy()])
        .spawn()
        .map(|_| ())
        .map_err(|e| FsError::Io(format!("open terminal failed: {e}")))
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

/// Overwrite "Welcome.md" with the bundled seed. Unlike `ensure_welcome_file`,
/// this unconditionally replaces the file — used by the "Help → Reset
/// Welcome.md to Default" menu item so users can pick up the latest seed
/// after an app update. Callers are expected to have already shown the user
/// a destructive-confirmation prompt before invoking this.
#[tauri::command]
pub fn reseed_welcome_file(app: AppHandle) -> Result<String, FsError> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| FsError::Io(format!("document_dir: {}", e)))?;
    let app_dir = docs.join("Yeogi .MD Editor");
    std::fs::create_dir_all(&app_dir).map_err(|e| FsError::Io(e.to_string()))?;
    let file_path = app_dir.join("Welcome.md");
    std::fs::write(&file_path, WELCOME_CONTENT).map_err(|e| FsError::Io(e.to_string()))?;
    Ok(file_path.to_string_lossy().to_string())
}

/// Rebuild the native menu to reflect the frontend's current state and swap
/// it in. Called once at mount (after preferences hydrate) and any time
/// either the MRU list or the theme preference changes. Batching both into
/// one command avoids the Rust side needing to cache either piece of state
/// — the frontend already does, and sends both on every change.
#[tauri::command]
pub fn sync_menu_state(
    app: AppHandle,
    recent_files: Vec<String>,
    theme: String,
) -> Result<(), FsError> {
    let entries: Vec<crate::menu::RecentFile> = recent_files
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
    let menu = crate::menu::build_menu(&app, &entries, theme.as_str())
        .map_err(|e| FsError::Io(format!("menu build failed: {}", e)))?;
    app.set_menu(menu)
        .map_err(|e| FsError::Io(format!("set_menu failed: {}", e)))?;
    Ok(())
}
