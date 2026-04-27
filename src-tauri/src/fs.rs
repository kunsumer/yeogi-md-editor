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

/// File-only copy. Refuses to overwrite an existing target so the caller
/// must compute a unique destination (Duplicate's `name (N).md` suffix
/// loop in the frontend handles this). Refuses to copy directories — for
/// v1 the file-tree's Duplicate action is files-only.
pub fn copy(from: &str, to: &str) -> Result<(), FsError> {
    let src = Path::new(from);
    let dst = Path::new(to);
    if dst.exists() {
        return Err(FsError::Io(format!("path exists: {to}")));
    }
    let meta = stdfs::metadata(src).map_err(|e| FsError::Io(e.to_string()))?;
    if meta.is_dir() {
        return Err(FsError::Io(format!("cannot duplicate directories: {from}")));
    }
    stdfs::copy(src, dst).map_err(|e| FsError::Io(e.to_string()))?;
    Ok(())
}

/// Permanently remove a file or directory. For directories, recursively
/// removes every descendant. The frontend gates this behind a destructive-
/// confirmation modal so this command itself trusts its caller.
pub fn delete(path: &str) -> Result<(), FsError> {
    let p = Path::new(path);
    let meta = stdfs::metadata(p).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound(path.into()),
        std::io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.into()),
        _ => FsError::Io(e.to_string()),
    })?;
    if meta.is_dir() {
        stdfs::remove_dir_all(p).map_err(|e| FsError::Io(e.to_string()))
    } else {
        stdfs::remove_file(p).map_err(|e| FsError::Io(e.to_string()))
    }
}

/// Count every descendant of `path` (files + directories combined),
/// excluding `path` itself. Returns 0 for a file. Used by the delete
/// confirmation dialog to surface "this will delete N items inside" so the
/// user knows how much they're about to lose. Unreadable subdirs are
/// skipped silently — the count is best-effort, not authoritative.
pub fn count_recursive(path: &str) -> Result<u64, FsError> {
    let p = Path::new(path);
    let meta = stdfs::metadata(p).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound(path.into()),
        std::io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.into()),
        _ => FsError::Io(e.to_string()),
    })?;
    if !meta.is_dir() {
        return Ok(0);
    }
    let mut total: u64 = 0;
    let mut stack: Vec<std::path::PathBuf> = vec![p.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let read = match stdfs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in read.flatten() {
            total = total.saturating_add(1);
            let ep = entry.path();
            if ep.is_dir() {
                stack.push(ep);
            }
        }
    }
    Ok(total)
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
