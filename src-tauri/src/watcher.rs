use notify::{RecursiveMode, Watcher as _};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, DebouncedEvent};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use std::time::{Duration, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
pub enum WatcherEvent {
    Changed { path: String, mtime_ms: i64 },
    Lost { reason: String },
}

pub struct Watcher {
    inner: Mutex<
        notify_debouncer_full::Debouncer<
            notify::RecommendedWatcher,
            notify_debouncer_full::FileIdMap,
        >,
    >,
}

impl Watcher {
    pub fn new(tx: Sender<WatcherEvent>) -> notify::Result<Self> {
        let fwd = tx.clone();
        let debouncer = new_debouncer(
            Duration::from_millis(120),
            None,
            move |result: DebounceEventResult| match result {
                Ok(events) => {
                    for ev in events {
                        emit_changed(&fwd, &ev);
                    }
                }
                Err(errs) => {
                    let reason = errs
                        .iter()
                        .map(|e| format!("{:?}", e))
                        .collect::<Vec<_>>()
                        .join("; ");
                    let _ = fwd.send(WatcherEvent::Lost { reason });
                }
            },
        )?;
        Ok(Watcher {
            inner: Mutex::new(debouncer),
        })
    }

    pub fn subscribe(&self, path: &str) -> notify::Result<()> {
        let p: PathBuf = path.into();
        self.inner
            .lock()
            .unwrap()
            .watcher()
            .watch(&p, RecursiveMode::NonRecursive)
    }
}

fn emit_changed(tx: &Sender<WatcherEvent>, ev: &DebouncedEvent) {
    if let Some(path) = ev.paths.first() {
        let mtime_ms = std::fs::metadata(path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let _ = tx.send(WatcherEvent::Changed {
            path: path.to_string_lossy().to_string(),
            mtime_ms,
        });
    }
}
