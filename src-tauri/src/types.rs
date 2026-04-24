use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileRead {
    pub content: String,
    #[ts(type = "number")]
    pub mtime_ms: i64,
    pub encoding: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileWritten {
    #[ts(type = "number")]
    pub mtime_ms: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
#[serde(tag = "kind", content = "detail")]
pub enum FsError {
    NotFound(String),
    PermissionDenied(String),
    IsDirectory(String),
    NotUtf8(String),
    LooksBinary(String),
    Io(String),
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileChanged {
    pub path: String,
    #[ts(type = "number")]
    pub mtime_ms: i64,
}
