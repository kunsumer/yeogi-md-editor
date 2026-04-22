use yeogi_md_editor_lib::fs;
use yeogi_md_editor_lib::types::FsError;
use std::fs as stdfs;
use tempfile::TempDir;

#[test]
fn reads_utf8_text_file() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a.md");
    stdfs::write(&path, "# Hello\n").unwrap();
    let got = fs::read(path.to_str().unwrap()).unwrap();
    assert_eq!(got.content, "# Hello\n");
    assert_eq!(got.encoding, "utf-8");
    assert!(got.mtime_ms > 0);
}

#[test]
fn rejects_binary_file() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("b.bin");
    stdfs::write(&path, [0u8, 1, 2, 0, 3, 4]).unwrap();
    assert!(matches!(fs::read(path.to_str().unwrap()).unwrap_err(), FsError::LooksBinary(_)));
}

#[test]
fn rejects_non_utf8() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("c.md");
    stdfs::write(&path, [0xFFu8, 0xFE, b'A']).unwrap();
    assert!(matches!(fs::read(path.to_str().unwrap()).unwrap_err(), FsError::NotUtf8(_)));
}

#[test]
fn returns_not_found() {
    assert!(matches!(fs::read("/definitely/does/not/exist.md").unwrap_err(), FsError::NotFound(_)));
}
