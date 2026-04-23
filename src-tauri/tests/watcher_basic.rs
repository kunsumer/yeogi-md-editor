use yeogi_md_editor_lib::watcher::{Watcher, WatcherEvent};
use std::fs;
use std::sync::mpsc;
use std::time::Duration;
use tempfile::TempDir;

#[test]
fn watcher_emits_on_write() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("a.md");
    fs::write(&path, "v1").unwrap();

    let (tx, rx) = mpsc::channel();
    let w = Watcher::new(tx).unwrap();
    w.subscribe(path.to_str().unwrap()).unwrap();

    std::thread::sleep(Duration::from_millis(200));
    fs::write(&path, "v2").unwrap();

    let evt = rx.recv_timeout(Duration::from_secs(2)).expect("no event");
    match evt {
        WatcherEvent::Changed { path: p, .. } => {
            let expected = fs::canonicalize(&path).unwrap();
            let got = fs::canonicalize(&p).unwrap();
            assert_eq!(got, expected);
        }
        other => panic!("unexpected event: {:?}", other),
    }
}
