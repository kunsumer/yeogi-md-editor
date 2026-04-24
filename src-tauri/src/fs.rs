use crate::types::{DirEntry, FileRead, FileWritten, FsError};
use std::fs as stdfs;
use std::io::Write;
use std::path::Path;
use std::time::UNIX_EPOCH;

pub fn read(path: &str) -> Result<FileRead, FsError> {
    let p = Path::new(path);
    let meta = stdfs::metadata(p).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound(path.into()),
        std::io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.into()),
        _ => FsError::Io(e.to_string()),
    })?;
    if meta.is_dir() {
        return Err(FsError::IsDirectory(path.into()));
    }

    let bytes = stdfs::read(p).map_err(|e| FsError::Io(e.to_string()))?;
    let sniff_end = bytes.len().min(4096);
    if bytes[..sniff_end].contains(&0) {
        return Err(FsError::LooksBinary(path.into()));
    }
    let content = std::str::from_utf8(&bytes)
        .map_err(|e| FsError::NotUtf8(e.to_string()))?
        .to_string();

    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(FileRead {
        content,
        mtime_ms,
        encoding: "utf-8".into(),
    })
}

pub fn write(path: &str, content: &str) -> Result<FileWritten, FsError> {
    let p = Path::new(path);
    let dir = p.parent().ok_or_else(|| FsError::Io("no parent".into()))?;
    let file_name = p.file_name()
        .ok_or_else(|| FsError::Io("no file name".into()))?
        .to_string_lossy().to_string();
    let tmp = dir.join(format!(".{}.tmp-yeogi-md-editor", file_name));

    {
        let mut f = stdfs::File::create(&tmp).map_err(|e| FsError::Io(e.to_string()))?;
        f.write_all(content.as_bytes()).map_err(|e| FsError::Io(e.to_string()))?;
        f.sync_all().map_err(|e| FsError::Io(e.to_string()))?;
    }
    stdfs::rename(&tmp, p).map_err(|e| FsError::Io(e.to_string()))?;

    let meta = stdfs::metadata(p).map_err(|e| FsError::Io(e.to_string()))?;
    let mtime_ms = meta.modified().ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64).unwrap_or(0);
    Ok(FileWritten { mtime_ms })
}

pub fn create(path: &str) -> Result<(), FsError> {
    let p = Path::new(path);
    if p.exists() { return Err(FsError::Io(format!("path exists: {path}"))); }
    stdfs::File::create(p).map_err(|e| FsError::Io(e.to_string()))?;
    Ok(())
}

pub fn rename(from: &str, to: &str) -> Result<(), FsError> {
    stdfs::rename(from, to).map_err(|e| FsError::Io(e.to_string()))
}

pub fn list(path: &str) -> Result<Vec<DirEntry>, FsError> {
    let p = Path::new(path);
    let read = stdfs::read_dir(p).map_err(|e| FsError::Io(e.to_string()))?;
    let mut out = Vec::new();
    for entry in read.flatten() {
        let ep = entry.path();
        let is_dir = ep.is_dir();
        let name = ep.file_name().unwrap_or_default().to_string_lossy().to_string();
        // Filter macOS metadata files — they're not user content and clutter
        // every Mac folder. Other dot-files / dot-folders are shown so users
        // who keep notes alongside config (e.g. `.obsidian/`, `.notes/`,
        // dotfile-style sidecar metadata) can navigate to them.
        if name == ".DS_Store" { continue; }
        if !is_dir {
            let ext = ep
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_default();
            // Markdown is the primary file type; the rest are "viewable as
            // plain text" extensions that open in Edit mode only — see
            // src/lib/isMarkdownPath.ts for the markdown-vs-other split.
            // Keep this list in sync with the file-dialog filters in App.tsx.
            const ALLOWED: &[&str] = &[
                "md", "markdown", "mdown", "mkd",
                "txt", "json", "yaml", "yml", "toml", "sh", "log", "csv",
            ];
            if !ALLOWED.contains(&ext.as_str()) { continue; }
        }
        out.push(DirEntry { name, path: ep.to_string_lossy().to_string(), is_dir });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(out)
}
