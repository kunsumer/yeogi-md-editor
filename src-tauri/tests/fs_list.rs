use yeogi_md_editor_lib::fs;
use std::fs as stdfs;
use tempfile::TempDir;

#[test]
fn lists_md_files_and_subfolders() {
    let dir = TempDir::new().unwrap();
    stdfs::write(dir.path().join("a.md"), "").unwrap();
    stdfs::write(dir.path().join("b.txt"), "").unwrap();
    stdfs::write(dir.path().join(".hidden.md"), "").unwrap();
    stdfs::create_dir(dir.path().join("sub")).unwrap();

    let entries = fs::list(dir.path().to_str().unwrap()).unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.clone()).collect();
    assert!(names.contains(&"a.md".to_string()));
    assert!(names.contains(&"sub".to_string()));
    assert!(!names.contains(&"b.txt".to_string()));
    assert!(!names.contains(&".hidden.md".to_string()));
}
