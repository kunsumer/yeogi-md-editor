use tauri::State;

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
