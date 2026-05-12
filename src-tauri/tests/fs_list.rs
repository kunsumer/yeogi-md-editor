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
fn extensionless_text_files_surface() {
    let dir = TempDir::new().unwrap();
    // Common no-extension text files real repos contain.
    stdfs::write(dir.path().join(".env"), "API_KEY=secret\nDEBUG=true\n").unwrap();
    stdfs::write(dir.path().join("Dockerfile"), "FROM rust:1.78\nWORKDIR /app\n").unwrap();
    stdfs::write(dir.path().join("Makefile"), "all:\n\techo ok\n").unwrap();
    stdfs::write(dir.path().join("LICENSE"), "MIT License\n\nCopyright (c) 2026\n").unwrap();
    // Empty file with no extension should also count as text.
    stdfs::write(dir.path().join("Procfile"), "").unwrap();

    let entries = fs::list(dir.path().to_str().unwrap()).unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.clone()).collect();

    assert!(names.contains(&".env".to_string()), "names: {names:?}");
    assert!(names.contains(&"Dockerfile".to_string()));
    assert!(names.contains(&"Makefile".to_string()));
    assert!(names.contains(&"LICENSE".to_string()));
    assert!(names.contains(&"Procfile".to_string()));
}

#[test]
fn extensionless_binary_files_are_filtered() {
    let dir = TempDir::new().unwrap();
    // Binary file with no extension — should not surface in the tree.
    // NULs in the first 4 KB are what flags it as binary.
    let mut binary = vec![0u8; 16];
    binary.extend_from_slice(b"more bytes after the nuls");
    stdfs::write(dir.path().join("blob"), &binary).unwrap();
    // Keep one .md so the directory isn't empty (clearer failure mode).
    stdfs::write(dir.path().join("a.md"), "").unwrap();

    let entries = fs::list(dir.path().to_str().unwrap()).unwrap();
    let names: Vec<_> = entries.iter().map(|e| e.name.clone()).collect();
    assert!(names.contains(&"a.md".to_string()));
    assert!(!names.contains(&"blob".to_string()), "binary leaked: {names:?}");
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
