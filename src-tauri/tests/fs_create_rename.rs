use yeogi_md_editor_lib::fs;
use std::fs as stdfs;
use tempfile::TempDir;

#[test]
fn create_new_empty_file() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("new.md");
    fs::create(path.to_str().unwrap()).unwrap();
    assert!(path.exists());
    assert_eq!(stdfs::read_to_string(&path).unwrap(), "");
}

#[test]
fn create_errors_if_exists() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a.md");
    stdfs::write(&path, "hi").unwrap();
    assert!(fs::create(path.to_str().unwrap()).is_err());
}

#[test]
fn rename_moves_file() {
    let dir = TempDir::new().unwrap();
    let src = dir.path().join("a.md");
    let dst = dir.path().join("b.md");
    stdfs::write(&src, "x").unwrap();
    fs::rename(src.to_str().unwrap(), dst.to_str().unwrap()).unwrap();
    assert!(!src.exists() && dst.exists());
}
