// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

pub mod types;
pub mod fs;
pub mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs_read,
            commands::fs_write,
            commands::fs_create,
            commands::fs_rename,
            commands::fs_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
