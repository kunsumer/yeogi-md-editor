use yeogi_md_editor_lib::fs;
use std::fs as stdfs;
use tempfile::TempDir;

#[test]
fn lists_md_files_and_subfolders() {
    let dir = TempDir::new().unwrap();
    stdfs::write(dir.path().join("a.md"), "").unwrap();
    stdfs::write(dir.path().join("b.txt"), "").unwrap();
    stdfs::write(dir.path().join("c.json"), "").unwrap();
    stdfs::write(dir.path().join("d.png"), "").unwrap();
    stdfs::write(dir.path().join(".hidden.md"), "").unwrap();
    stdfs::create_dir(dir.path().join("sub")).unwrap();
    stdfs::create_dir(dir.path().join(".obsidian")).unwrap();

    let entries = fs::list(dir.path().to_str().unwrap()).unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.clone()).collect();

    // Markdown + the v0.4.4 expanded text-file allow-list (txt, json,
    // yaml, yml, toml, sh, log, csv) all surface.
    assert!(names.contains(&"a.md".to_string()));
    assert!(names.contains(&"b.txt".to_string()));
    assert!(names.contains(&"c.json".to_string()));

    // Non-text files outside the allow-list are filtered out.
    assert!(!names.contains(&"d.png".to_string()));

    // Dot-files with a recognized extension survive the filter — Path::
    // extension() on ".hidden.md" returns "md", which passes the
    // allow-list. Per v0.4.4 ("Dot-folders show in the explorer"),
    // dot-folders also show.
    assert!(names.contains(&".hidden.md".to_string()));
    assert!(names.contains(&"sub".to_string()));
    assert!(names.contains(&".obsidian".to_string()));
}

#[test]
fn ds_store_is_filtered_out() {
    let dir = TempDir::new().unwrap();
    stdfs::write(dir.path().join("a.md"), "").unwrap();
    stdfs::write(dir.path().join(".DS_Store"), "").unwrap();
    let entries = fs::list(dir.path().to_str().unwrap()).unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.clone()).collect();
    assert!(names.contains(&"a.md".to_string()));
    assert!(!names.contains(&".DS_Store".to_string()));
}
