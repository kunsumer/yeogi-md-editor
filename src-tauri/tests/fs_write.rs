use yeogi_md_editor_lib::fs;
use std::fs as stdfs;
use tempfile::TempDir;

#[test]
fn writes_and_returns_new_mtime() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a.md");
    stdfs::write(&path, "old").unwrap();
    let r = fs::write(path.to_str().unwrap(), "new content\n").unwrap();
    assert!(r.mtime_ms > 0);
    assert_eq!(stdfs::read_to_string(&path).unwrap(), "new content\n");
}

#[test]
fn write_cleans_up_its_temp_file() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a.md");
    stdfs::write(&path, "original").unwrap();
    fs::write(path.to_str().unwrap(), "replacement").unwrap();
    let siblings: Vec<_> = stdfs::read_dir(dir.path()).unwrap()
        .filter_map(|e| e.ok()).map(|e| e.file_name()).collect();
    assert_eq!(siblings.len(), 1);
}
