use crate::types::{FileRead, FileWritten, FsError};
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
    let tmp = dir.join(format!(".{}.tmp-evhan-md-editor", file_name));

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
