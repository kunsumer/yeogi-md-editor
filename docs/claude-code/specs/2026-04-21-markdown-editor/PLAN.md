# macOS Markdown Editor v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focused, open-source, free macOS desktop application that reads and edits `.md` files with Meva-class rendering (LaTeX, Mermaid, syntax-highlighted code), a Word-like formatting toolbar, and a separate preview window.

**Architecture:** Tauri app. One Rust process owns file I/O, `notify`-based file watcher, window management, native menus, and PDF export. All UI lives in WebKit webviews. Two window types: a main editor window (file tree + tabs + toolbar + editor + TOC + status bar) and zero-or-more preview windows (one per document, created on toggle). Communication via typed Tauri IPC commands and events.

**Tech Stack:** Tauri 2.x, Rust (notify, tokio, serde, ts-rs), TypeScript + React 18 + Vite, CodeMirror 6, unified/remark/rehype (remark-gfm, remark-math, rehype-katex, rehype-shiki, rehype-sanitize), DOMPurify, Zustand, Vitest + React Testing Library, Playwright, `cargo test` + `tempfile`.

**Source of truth:** `docs/claude-code/specs/2026-04-21-markdown-editor/SPEC.md`.

**Security posture.** Untrusted markdown (including `.md` files from third parties and AI output) can contain embedded HTML and script. Defense-in-depth:
1. `remark-rehype` runs with `allowDangerousHtml: false` so raw HTML nodes are escaped.
2. `rehype-sanitize` strips surviving scripts / event-handler attrs at the HAST level.
3. At every DOM-insertion boundary, HTML passes through the `safeReplaceChildren` helper (DOMPurify + DOMParser + `replaceChildren`). **No code in this plan ever assigns to `innerHTML` directly.**

---

## Phased structure

Each phase is independently shippable. Do not advance past a phase whose checkpoint fails.

- **Phase 0** — Project initialization
- **Phase 1** — Rust file operations
- **Phase 2** — Rust file watcher
- **Phase 3** — Frontend: doc model, IPC wrappers, conflict function
- **Phase 4** — CodeMirror editor + minimum open/edit loop
- **Phase 5** — Autosave + force-flush on close + autosave-off confirmation
- **Phase 6** — External change: silent reload + conflict banner
- **Phase 7** — Tabs, FileTree, StatusBar
- **Phase 8** — Markdown rendering pipeline (KaTeX, Mermaid, Shiki, sanitize)
- **Phase 9** — Preview window + safe HTML helper
- **Phase 10** — Word-like formatting toolbar
- **Phase 11** — TOC + scroll-spy + copy-button on code blocks
- **Phase 12** — Export: HTML, PDF
- **Phase 13** — Polish: themes, a11y, perf, signing + notarization, E2E

---

## Prerequisites

- Xcode Command Line Tools: `xcode-select -p` returns a path.
- Rust stable >= 1.75: `rustup update stable`.
- Node.js LTS >= 20.
- `pnpm`.
- `cargo install create-tauri-app --locked` and `cargo install tauri-cli --locked --version ^2`.
- macOS 13+.

---

## Phase 0 — Project initialization

### Task 0.1: Initialize git

- [ ] **Step 1:** `git init -b main`.
- [ ] **Step 2:** `git status` shows `On branch main`.
- [ ] **Step 3:** `git add .` then `git commit -m "chore: initial scaffold commit"`.
- [ ] **Step 4:** `git log --oneline` shows one commit.

### Task 0.2: Scaffold Tauri + Vite + React + TypeScript

- [ ] **Step 1:** Scaffold:
```bash
pnpm create tauri-app@latest . --manager pnpm --template react-ts --tauri-version 2 --identifier com.evhan.mdeditor --name evhan-md-editor
```
If the scaffolder refuses due to non-empty directory, scaffold in a temp dir and copy the generated files in, preserving `CLAUDE.md`, `docs/`, `.claude/`, `.github/`, `README.md`, `.gitignore`.
- [ ] **Step 2:** `pnpm install`.
- [ ] **Step 3:** `pnpm tauri dev` — window opens, close it.
- [ ] **Step 4:** `src/App.tsx`:
```tsx
export default function App() {
  return <div style={{ padding: 24 }}>evhan-md-editor — empty shell</div>;
}
```
- [ ] **Step 5:** Commit.

### Task 0.3: Install dependencies

- [ ] **Step 1:** UI deps:
```bash
pnpm add react@^18 react-dom@^18 zustand dompurify
pnpm add -D typescript vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/react @types/react-dom @types/dompurify playwright @playwright/test @vitejs/plugin-react
```
- [ ] **Step 2:** Markdown + editor deps:
```bash
pnpm add codemirror @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-markdown @codemirror/search @codemirror/theme-one-dark
pnpm add unified remark-parse remark-gfm remark-math remark-rehype rehype-katex rehype-shiki rehype-sanitize rehype-stringify
pnpm add unist-util-visit katex mermaid shiki
pnpm add @tauri-apps/plugin-dialog
```
- [ ] **Step 3:** Rust deps in `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
notify = "6"
notify-debouncer-full = "0.3"
anyhow = "1"
thiserror = "1"
ts-rs = { version = "8", features = ["serde-compat"] }

[dev-dependencies]
tempfile = "3"
```
- [ ] **Step 4:** `cargo build --manifest-path src-tauri/Cargo.toml` — clean.
- [ ] **Step 5:** Commit.

### Task 0.4: Configure Vitest + Playwright

- [ ] **Step 1:** `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.ts", "src/**/*.{test,spec}.tsx"],
  },
});
```
- [ ] **Step 2:** `src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```
- [ ] **Step 3:** `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "on-first-retry" },
});
```
- [ ] **Step 4:** Scripts in `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit"
  }
}
```
- [ ] **Step 5:** `pnpm test` exits 0 with "no test files found."
- [ ] **Step 6:** Commit.

### Task 0.5: CI workflow

- [ ] **Step 1:** Replace `scaffold-check` job body in `.github/workflows/ci.yml`:
```yaml
jobs:
  scaffold-check:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: cargo test --manifest-path src-tauri/Cargo.toml
```
- [ ] **Step 2:** Commit.

### Phase 0 checkpoint
- `pnpm tauri dev` opens the window.
- `pnpm test` exits 0.
- `cargo test --manifest-path src-tauri/Cargo.toml` exits 0.

---

## Phase 1 — Rust file operations

### Phase 1 preamble — scaffolder architecture corrections

The Tauri 2 scaffolder (used in Task 0.2) emitted a structure that differs from what the original plan assumed. Apply these interpretations throughout Phase 1 and Phase 2:

- **Lib crate name is `evhan_md_editor_lib`** (not `evhan_md_editor`). Tests, other Rust files, and the binary all import via `use evhan_md_editor_lib::...`. The `[lib]` block in `Cargo.toml` includes `crate-type = ["staticlib", "cdylib", "rlib"]` — DO NOT remove, it's required for future mobile targets.
- **`src-tauri/src/lib.rs` owns `pub fn run()`** — this is where the Tauri `Builder` lives. The scaffolder put it there; every Phase 1/2 task that previously said "rewrite `main.rs`" should instead MODIFY `lib.rs::run()`. `main.rs` is a 3-line caller (`fn main() { evhan_md_editor_lib::run() }`) and stays untouched for the whole project.
- **Module declarations** (`pub mod types;`, `pub mod fs;`, `pub mod watcher;`, `pub mod commands;`) all go into `lib.rs`. Add them incrementally as each task introduces a new module.
- **`AppState`** (Task 2.2) lives in `lib.rs`.

Where any task below says "rewrite main.rs", read it as "update `lib.rs::run()`". Where any task says "replace `lib.rs`", read it as "extend `lib.rs`" — preserve `run()`.

### Task 1.0: Scaffolder demo cleanup (new — runs before 1.1)

**Files:** Delete `src/App.css`, `src/assets/react.svg`, `public/vite.svg`, `public/tauri.svg`. Modify `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `index.html`.

- [ ] **Step 1:** Delete the demo assets:
```bash
rm src/App.css src/assets/react.svg public/vite.svg public/tauri.svg
```
- [ ] **Step 2:** Remove the scaffolder's `greet` command from `src-tauri/src/lib.rs`:
  - Delete the `#[tauri::command] fn greet(...)` function.
  - Remove `greet` from the `tauri::generate_handler![greet]` list in `pub fn run()`. If that leaves an empty `generate_handler![]`, leave it empty — Task 1.6 will repopulate it.
- [ ] **Step 3:** Update `src-tauri/Cargo.toml`:
  - `description = "macOS Markdown editor"`
  - `authors = ["Evhan"]`
- [ ] **Step 4:** Update `index.html`: `<title>evhan-md-editor</title>` (replace `Tauri + React + Typescript`).
- [ ] **Step 5:** `cargo build --manifest-path src-tauri/Cargo.toml` and `pnpm build` — both succeed (the Vite build confirms nothing still imports the deleted `App.css`).
- [ ] **Step 6:** Commit with message: `chore: remove scaffolder demo code`.

### Task 1.1: Shared IPC types

**Files:** Create `src-tauri/src/types.rs`, `src-tauri/src/lib.rs`; modify `src-tauri/Cargo.toml`.

- [ ] **Step 1:** `src-tauri/src/types.rs`:
```rust
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileRead { pub content: String, pub mtime_ms: i64, pub encoding: String }

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileWritten { pub mtime_ms: i64 }

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
#[serde(tag = "kind", content = "detail")]
pub enum FsError {
    NotFound(String), PermissionDenied(String), IsDirectory(String),
    NotUtf8(String), LooksBinary(String), Io(String),
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct DirEntry { pub name: String, pub path: String, pub is_dir: bool }

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export, export_to = "../src/lib/ipc/types.ts")]
pub struct FileChanged { pub path: String, pub mtime_ms: i64 }
```
- [ ] **Step 2:** `src-tauri/Cargo.toml` lib+bin — **no edit needed**. The scaffolder already emitted `[lib] name = "evhan_md_editor_lib"` with `crate-type = ["staticlib", "cdylib", "rlib"]` (retain `crate-type` for future mobile targets), and the binary target defaults from the package name. Skip this step.
- [ ] **Step 3:** **Extend** `src-tauri/src/lib.rs` — add `pub mod types;` at the top of the file. Do NOT replace the file; the scaffolder's existing `pub fn run()` must stay intact (see Phase 1 preamble). After this edit the file should begin with:
```rust
pub mod types;

pub fn run() {
    // ... existing scaffolder Builder setup, unchanged ...
}
```
- [ ] **Step 4:** `cargo build --manifest-path src-tauri/Cargo.toml`. Verify `src/lib/ipc/types.ts` was generated.
- [ ] **Step 5:** Commit.

### Task 1.2: fs.read with UTF-8 / binary detection

**Files:** Create `src-tauri/src/fs.rs`, `src-tauri/tests/fs_read.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1:** Failing test `src-tauri/tests/fs_read.rs`:
```rust
use evhan_md_editor_lib::fs;
use evhan_md_editor_lib::types::FsError;
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
```
- [ ] **Step 2:** `cargo test --manifest-path src-tauri/Cargo.toml --test fs_read` — expect compile failure.
- [ ] **Step 3:** `src-tauri/src/fs.rs`:
```rust
use crate::types::{FileRead, FsError};
use std::fs as stdfs;
use std::path::Path;
use std::time::UNIX_EPOCH;

pub fn read(path: &str) -> Result<FileRead, FsError> {
    let p = Path::new(path);
    let meta = stdfs::metadata(p).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound(path.into()),
        std::io::ErrorKind::PermissionDenied => FsError::PermissionDenied(path.into()),
        _ => FsError::Io(e.to_string()),
    })?;
    if meta.is_dir() { return Err(FsError::IsDirectory(path.into())); }

    let bytes = stdfs::read(p).map_err(|e| FsError::Io(e.to_string()))?;
    let sniff_end = bytes.len().min(4096);
    if bytes[..sniff_end].contains(&0) { return Err(FsError::LooksBinary(path.into())); }
    let content = std::str::from_utf8(&bytes)
        .map_err(|e| FsError::NotUtf8(e.to_string()))?.to_string();

    let mtime_ms = meta.modified().ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64).unwrap_or(0);
    Ok(FileRead { content, mtime_ms, encoding: "utf-8".into() })
}
```
Add `pub mod fs;` to `src-tauri/src/lib.rs`.
- [ ] **Step 4:** Run — 4 passing.
- [ ] **Step 5:** Commit.

### Task 1.3: fs.write (atomic)

**Files:** Modify `src-tauri/src/fs.rs`; create `src-tauri/tests/fs_write.rs`.

- [ ] **Step 1:** Failing test:
```rust
use evhan_md_editor_lib::fs;
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
```
- [ ] **Step 2:** Append to `src-tauri/src/fs.rs`:
```rust
use crate::types::FileWritten;
use std::io::Write;

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
```
- [ ] **Step 3:** Run — 2 passing.
- [ ] **Step 4:** Commit.

### Task 1.4: fs.create + fs.rename

**Files:** Modify `src-tauri/src/fs.rs`; create `src-tauri/tests/fs_create_rename.rs`.

- [ ] **Step 1:** Failing test:
```rust
use evhan_md_editor_lib::fs;
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
```
- [ ] **Step 2:** Append:
```rust
pub fn create(path: &str) -> Result<(), FsError> {
    let p = Path::new(path);
    if p.exists() { return Err(FsError::Io(format!("path exists: {path}"))); }
    stdfs::File::create(p).map_err(|e| FsError::Io(e.to_string()))?;
    Ok(())
}

pub fn rename(from: &str, to: &str) -> Result<(), FsError> {
    stdfs::rename(from, to).map_err(|e| FsError::Io(e.to_string()))
}
```
- [ ] **Step 3:** Run — 3 passing.
- [ ] **Step 4:** Commit.

### Task 1.5: fs.list (shallow, .md filter, dotfile hiding)

**Files:** Modify `src-tauri/src/fs.rs`; create `src-tauri/tests/fs_list.rs`.

- [ ] **Step 1:** Failing test:
```rust
use evhan_md_editor_lib::fs;
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
```
- [ ] **Step 2:** Append:
```rust
use crate::types::DirEntry;

pub fn list(path: &str) -> Result<Vec<DirEntry>, FsError> {
    let p = Path::new(path);
    let read = stdfs::read_dir(p).map_err(|e| FsError::Io(e.to_string()))?;
    let mut out = Vec::new();
    for entry in read.flatten() {
        let ep = entry.path();
        let is_dir = ep.is_dir();
        let name = ep.file_name().unwrap_or_default().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        if !is_dir {
            let ext = ep.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext != "md" && ext != "markdown" { continue; }
        }
        out.push(DirEntry { name, path: ep.to_string_lossy().to_string(), is_dir });
    }
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(out)
}
```
- [ ] **Step 3:** Run — 1 passing.
- [ ] **Step 4:** Commit.

### Task 1.6: Expose fs commands to the webview

**Files:** Create `src-tauri/src/commands.rs`; modify `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1:** `src-tauri/src/commands.rs`:
```rust
use crate::fs;
use crate::types::{DirEntry, FileRead, FileWritten, FsError};

#[tauri::command]
pub fn fs_read(path: String) -> Result<FileRead, FsError> { fs::read(&path) }

#[tauri::command]
pub fn fs_write(path: String, content: String) -> Result<FileWritten, FsError> { fs::write(&path, &content) }

#[tauri::command]
pub fn fs_create(path: String) -> Result<(), FsError> { fs::create(&path) }

#[tauri::command]
pub fn fs_rename(from: String, to: String) -> Result<(), FsError> { fs::rename(&from, &to) }

#[tauri::command]
pub fn fs_list(path: String) -> Result<Vec<DirEntry>, FsError> { fs::list(&path) }
```
- [ ] **Step 2:** Add `pub mod commands;` to `src-tauri/src/lib.rs` (just the module declaration, alongside the existing `pub mod types;` and `pub mod fs;`). `main.rs` stays untouched.
- [ ] **Step 3:** **Update `pub fn run()` inside `src-tauri/src/lib.rs`** to register the fs_* commands in the `invoke_handler![…]` list (and add the dialog plugin if the scaffolder didn't already). The function should look roughly like:
```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs_read, commands::fs_write,
            commands::fs_create, commands::fs_rename, commands::fs_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
If the scaffolder's `run()` already includes `.plugin(tauri_plugin_dialog::init())` or other configuration, preserve it — only replace the `invoke_handler` list contents.
- [ ] **Step 4:** Build; commit.

### Phase 1 checkpoint
- All Rust tests pass.
- `src/lib/ipc/types.ts` generated.

---

## Phase 2 — Rust file watcher

### Task 2.1: Watcher module

**Files:** Create `src-tauri/src/watcher.rs`, `src-tauri/tests/watcher_basic.rs`; modify `src-tauri/src/lib.rs`.

- [ ] **Step 1:** Failing test:
```rust
use evhan_md_editor_lib::watcher::{Watcher, WatcherEvent};
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
        WatcherEvent::Changed { path: p, .. } => assert_eq!(p, path.to_string_lossy()),
        other => panic!("unexpected event: {:?}", other),
    }
}
```
- [ ] **Step 2:** `src-tauri/src/watcher.rs`:
```rust
use notify::RecursiveMode;
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
    inner: Mutex<notify_debouncer_full::Debouncer<
        notify::RecommendedWatcher,
        notify_debouncer_full::FileIdMap,
    >>,
}

impl Watcher {
    pub fn new(tx: Sender<WatcherEvent>) -> notify::Result<Self> {
        let fwd = tx.clone();
        let debouncer = new_debouncer(
            Duration::from_millis(120),
            None,
            move |result: DebounceEventResult| match result {
                Ok(events) => { for ev in events { emit_changed(&fwd, &ev); } }
                Err(errs) => {
                    let reason = errs.iter().map(|e| format!("{:?}", e))
                        .collect::<Vec<_>>().join("; ");
                    let _ = fwd.send(WatcherEvent::Lost { reason });
                }
            },
        )?;
        Ok(Watcher { inner: Mutex::new(debouncer) })
    }

    pub fn subscribe(&self, path: &str) -> notify::Result<()> {
        let p: PathBuf = path.into();
        self.inner.lock().unwrap().watcher().watch(&p, RecursiveMode::NonRecursive)
    }
}

fn emit_changed(tx: &Sender<WatcherEvent>, ev: &DebouncedEvent) {
    if let Some(path) = ev.paths.first() {
        let mtime_ms = std::fs::metadata(path).ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64).unwrap_or(0);
        let _ = tx.send(WatcherEvent::Changed {
            path: path.to_string_lossy().to_string(), mtime_ms,
        });
    }
}
```
Add `pub mod watcher;` to `src-tauri/src/lib.rs`.
- [ ] **Step 3:** Run — 1 passing.
- [ ] **Step 4:** Commit.

### Task 2.2: Wire watcher events + close intercept

**Files:** Modify `src-tauri/src/main.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1:** In `src-tauri/src/lib.rs`, add the `watcher` module declaration and an `AppState` struct. Preserve the existing `pub mod types; pub mod fs; pub mod commands;` declarations and the existing `pub fn run() {…}` (Step 3 below updates `run()`). The top of the file should read:
```rust
pub mod types;
pub mod fs;
pub mod watcher;
pub mod commands;

use std::sync::{Arc, Mutex};

pub struct AppState { pub watcher: Arc<Mutex<watcher::Watcher>> }

// pub fn run() {...}  // updated in Step 3
```
- [ ] **Step 2:** In `src-tauri/src/commands.rs`:
```rust
use tauri::State;
use crate::AppState;

#[tauri::command]
pub fn watcher_subscribe(path: String, state: State<AppState>) -> Result<(), crate::types::FsError> {
    state.watcher.lock()
        .map_err(|_| crate::types::FsError::Io("watcher mutex poisoned".into()))?
        .subscribe(&path)
        .map_err(|e| crate::types::FsError::Io(e.to_string()))
}
```
- [ ] **Step 3:** **Update `pub fn run()` in `src-tauri/src/lib.rs`** (do NOT rewrite `main.rs`). Replace the current body of `run()` with the setup below. Note the imports at the top of `lib.rs` should now include `use std::sync::mpsc;` and `use tauri::{Emitter, Manager};`.
```rust
use std::sync::mpsc;
use tauri::{Emitter, Manager};
use crate::watcher::{Watcher, WatcherEvent};

pub fn run() {
    let (tx, rx) = mpsc::channel::<WatcherEvent>();
    let watcher = std::sync::Arc::new(std::sync::Mutex::new(
        Watcher::new(tx).expect("watcher init"),
    ));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { watcher: watcher.clone() })
        .setup(move |app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(evt) = rx.recv() {
                    let name = match &evt {
                        WatcherEvent::Changed { .. } => "file.changed",
                        WatcherEvent::Lost { .. } => "watcher.lost",
                    };
                    let _ = handle.emit(name, evt);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.emit("app.close-requested", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs_read, commands::fs_write, commands::fs_create,
            commands::fs_rename, commands::fs_list, commands::watcher_subscribe
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
`main.rs` continues to be a 3-line caller — untouched.
- [ ] **Step 4:** `cargo build --manifest-path src-tauri/Cargo.toml` — clean.
- [ ] **Step 5:** Commit.

### Phase 2 checkpoint
- Watcher test passes.
- Build clean.

---

## Phase 3 — Frontend: doc model, IPC wrappers, conflict function

### Phase 3 preamble — mtime_ms type coercion

`src/lib/ipc/types.ts` is auto-generated by ts-rs (see Task 1.1). ts-rs 8 maps Rust `i64` to TypeScript `bigint`, which conflicts with the rest of the TS code (store, hooks, conflict function) that uses `number`. **At runtime** the wire value is always a regular JSON number — so the annotation is wrong only in type-space, not at runtime.

All IPC wrappers in `src/lib/ipc/commands.ts` MUST coerce `mtime_ms: bigint → number` at the boundary, and re-export the outward-facing types with `number`. Concretely: build a hand-written `src/lib/ipc/index.ts` that imports the generated `./types` (bigint shape) and re-exports cleaned `FileRead`, `FileWritten`, `FileChanged` with `mtime_ms: number`. The wrappers call `invoke(...)` and return the re-typed object (no cast needed at runtime since the JS value is already a number; a `unknown as` assertion is sufficient).

Add this to Task 3.1 when writing `commands.ts`.

### Task 3.1: Typed IPC wrappers

**Files:** Create `src/lib/ipc/commands.ts`, `src/lib/ipc/events.ts`, `src/lib/ipc/commands.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fsRead, fsWrite } from "./commands";

const invoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));

describe("ipc wrappers", () => {
  beforeEach(() => invoke.mockReset());

  it("fsRead forwards path", async () => {
    invoke.mockResolvedValue({ content: "x", mtime_ms: 1, encoding: "utf-8" });
    const r = await fsRead("/p/a.md");
    expect(invoke).toHaveBeenCalledWith("fs_read", { path: "/p/a.md" });
    expect(r.content).toBe("x");
  });

  it("fsWrite forwards path and content", async () => {
    invoke.mockResolvedValue({ mtime_ms: 2 });
    const r = await fsWrite("/p/a.md", "hello");
    expect(invoke).toHaveBeenCalledWith("fs_write", { path: "/p/a.md", content: "hello" });
    expect(r.mtime_ms).toBe(2);
  });
});
```
- [ ] **Step 2:** `src/lib/ipc/commands.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import type { DirEntry, FileRead, FileWritten, FsError } from "./types";

export async function fsRead(path: string): Promise<FileRead> { return invoke("fs_read", { path }); }
export async function fsWrite(path: string, content: string): Promise<FileWritten> { return invoke("fs_write", { path, content }); }
export async function fsCreate(path: string): Promise<void> { return invoke("fs_create", { path }); }
export async function fsRename(from: string, to: string): Promise<void> { return invoke("fs_rename", { from, to }); }
export async function fsList(path: string): Promise<DirEntry[]> { return invoke("fs_list", { path }); }
export async function watcherSubscribe(path: string): Promise<void> { return invoke("watcher_subscribe", { path }); }
export type { FileRead, FileWritten, FsError, DirEntry };
```
- [ ] **Step 3:** `src/lib/ipc/events.ts`:
```ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileChanged } from "./types";

export async function onFileChanged(cb: (e: FileChanged) => void): Promise<UnlistenFn> {
  return listen<FileChanged>("file.changed", (e) => cb(e.payload));
}
export async function onWatcherLost(cb: (reason: string) => void): Promise<UnlistenFn> {
  return listen<{ reason: string }>("watcher.lost", (e) => cb(e.payload.reason));
}
```
- [ ] **Step 4:** Run — 2 passing.
- [ ] **Step 5:** Commit.

### Task 3.2: Conflict decision function

**Files:** Create `src/lib/conflict.ts`, `src/lib/conflict.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect } from "vitest";
import { decideOnExternalChange } from "./conflict";

describe("decideOnExternalChange", () => {
  it("ignores echoes: diskMtime equals savedMtime", () => {
    expect(decideOnExternalChange({ diskMtime: 5, savedMtime: 5, isDirty: false })).toBe("ignore");
    expect(decideOnExternalChange({ diskMtime: 5, savedMtime: 5, isDirty: true })).toBe("ignore");
  });
  it("silent-reload when disk newer and clean", () => {
    expect(decideOnExternalChange({ diskMtime: 7, savedMtime: 5, isDirty: false })).toBe("silent-reload");
  });
  it("conflict when disk newer and dirty", () => {
    expect(decideOnExternalChange({ diskMtime: 7, savedMtime: 5, isDirty: true })).toBe("conflict");
  });
  it("ignore when disk older than last save", () => {
    expect(decideOnExternalChange({ diskMtime: 3, savedMtime: 5, isDirty: false })).toBe("ignore");
  });
});
```
- [ ] **Step 2:** Implement:
```ts
export type ConflictDecision = "ignore" | "silent-reload" | "conflict";

export function decideOnExternalChange(input: {
  diskMtime: number; savedMtime: number; isDirty: boolean;
}): ConflictDecision {
  if (input.diskMtime <= input.savedMtime) return "ignore";
  return input.isDirty ? "conflict" : "silent-reload";
}
```
- [ ] **Step 3:** Run — 4 passing.
- [ ] **Step 4:** Commit.

### Task 3.3: Document model + Zustand store

**Files:** Create `src/state/documents.ts`, `src/state/documents.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useDocuments } from "./documents";

describe("useDocuments", () => {
  beforeEach(() => { useDocuments.setState({ documents: [], activeId: null }); });

  it("openDocument adds a tab, sets active, conflict null", () => {
    const { openDocument } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "hi", savedMtime: 1, encoding: "utf-8" });
    const s = useDocuments.getState();
    expect(s.documents).toHaveLength(1);
    expect(s.documents[0].id).toBe(id);
    expect(s.activeId).toBe(id);
    expect(s.documents[0].conflict).toBeNull();
  });
  it("setContent marks dirty when content differs from last saved", () => {
    const { openDocument, setContent } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "orig", savedMtime: 1, encoding: "utf-8" });
    setContent(id, "orig edited");
    expect(useDocuments.getState().documents[0].isDirty).toBe(true);
  });
  it("markSaved clears dirty and updates savedMtime", () => {
    const { openDocument, setContent, markSaved } = useDocuments.getState();
    const id = openDocument({ path: "/a.md", content: "orig", savedMtime: 1, encoding: "utf-8" });
    setContent(id, "changed");
    markSaved(id, { content: "changed", mtimeMs: 2 });
    const d = useDocuments.getState().documents[0];
    expect(d.isDirty).toBe(false);
    expect(d.savedMtime).toBe(2);
  });
});
```
- [ ] **Step 2:** Implement `src/state/documents.ts`:
```ts
import { create } from "zustand";

export interface Conflict { diskMtime: number; }

export interface Document {
  id: string;
  path: string | null;
  content: string;
  lastSavedContent: string;
  savedMtime: number;
  isDirty: boolean;
  encoding: string;
  cursor: number;
  scrollTop: number;
  readOnly: boolean;
  previewWindowLabel: string | null;
  conflict: Conflict | null;
  saveState: "idle" | "saving" | "saved" | "failed";
  lastSaveError: string | null;
}

interface DocumentsState {
  documents: Document[];
  activeId: string | null;
  openDocument(input: { path: string | null; content: string; savedMtime: number; encoding: string; readOnly?: boolean }): string;
  closeDocument(id: string): void;
  setActive(id: string): void;
  setContent(id: string, content: string): void;
  markSaveStarted(id: string): void;
  markSaved(id: string, input: { content: string; mtimeMs: number }): void;
  markSaveFailed(id: string, error: string): void;
  setPath(id: string, path: string): void;
  setPreviewWindowLabel(id: string, label: string | null): void;
  setConflict(id: string, conflict: Conflict | null): void;
  replaceContentFromDisk(id: string, input: { content: string; mtimeMs: number }): void;
}

let seq = 0;
const newId = () => `doc-${++seq}-${Date.now()}`;

export const useDocuments = create<DocumentsState>((set) => ({
  documents: [],
  activeId: null,

  openDocument({ path, content, savedMtime, encoding, readOnly = false }) {
    const id = newId();
    const doc: Document = {
      id, path, content,
      lastSavedContent: content,
      savedMtime, isDirty: false, encoding,
      cursor: 0, scrollTop: 0, readOnly,
      previewWindowLabel: null, conflict: null,
      saveState: "idle", lastSaveError: null,
    };
    set((s) => ({ documents: [...s.documents, doc], activeId: id }));
    return id;
  },
  closeDocument(id) {
    set((s) => {
      const documents = s.documents.filter((d) => d.id !== id);
      const activeId = s.activeId === id ? (documents[0]?.id ?? null) : s.activeId;
      return { documents, activeId };
    });
  },
  setActive(id) { set({ activeId: id }); },
  setContent(id, content) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, content, isDirty: content !== d.lastSavedContent } : d),
    }));
  },
  markSaveStarted(id) {
    set((s) => ({ documents: s.documents.map((d) => d.id === id ? { ...d, saveState: "saving" } : d) }));
  },
  markSaved(id, { content, mtimeMs }) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? {
          ...d, lastSavedContent: content, savedMtime: mtimeMs, isDirty: false,
          saveState: "saved", lastSaveError: null,
        } : d),
    }));
  },
  markSaveFailed(id, error) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, saveState: "failed", lastSaveError: error } : d),
    }));
  },
  setPath(id, path) { set((s) => ({ documents: s.documents.map((d) => d.id === id ? { ...d, path } : d) })); },
  setPreviewWindowLabel(id, label) {
    set((s) => ({ documents: s.documents.map((d) => d.id === id ? { ...d, previewWindowLabel: label } : d) }));
  },
  setConflict(id, conflict) {
    set((s) => ({ documents: s.documents.map((d) => d.id === id ? { ...d, conflict } : d) }));
  },
  replaceContentFromDisk(id, { content, mtimeMs }) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? {
          ...d, content, lastSavedContent: content, savedMtime: mtimeMs,
          isDirty: false, conflict: null,
        } : d),
    }));
  },
}));
```
- [ ] **Step 3:** Run — 3 passing.
- [ ] **Step 4:** Commit.

### Phase 3 checkpoint
- All Phase-3 tests pass.

---

## Phase 4 — CodeMirror editor + minimum open/edit loop

### Task 4.1: Editor component

**Files:** Create `src/components/Editor/Editor.tsx`, `src/components/Editor/Editor.test.tsx`, `src/components/Editor/index.ts`.

- [ ] **Step 1:** Failing test:
```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Editor } from "./Editor";

describe("Editor", () => {
  it("renders given content", () => {
    const { container } = render(
      <Editor docId="doc-1" value="# Hi" onChange={() => {}} readOnly={false} onReady={() => {}} />
    );
    expect(container.querySelector(".cm-editor")).toBeTruthy();
  });
});
```
- [ ] **Step 2:** `src/components/Editor/Editor.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { search, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
  docId: string;
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
  onReady: (view: EditorView) => void;
}

export function Editor({ docId, value, onChange, readOnly, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(), highlightActiveLine(), history(), markdown(),
        search({ top: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorState.readOnly.of(readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString());
        }),
        oneDark,
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onReady(view);
    return () => { view.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, readOnly]);

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} style={{ height: "100%" }} />;
}
```
- [ ] **Step 3:** `index.ts`: `export { Editor } from "./Editor";`
- [ ] **Step 4:** Run — passing.
- [ ] **Step 5:** Commit.

### Task 4.2: Minimum shell

**Files:** Modify `src/App.tsx`; create `src/components/FolderPicker.tsx`.

- [ ] **Step 1:** `src/components/FolderPicker.tsx`:
```tsx
import { open } from "@tauri-apps/plugin-dialog";
interface Props { onPick: (path: string) => void; }
export function FolderPicker({ onPick }: Props) {
  async function handleClick() {
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") onPick(picked);
  }
  return <button onClick={handleClick}>Open folder…</button>;
}
```
- [ ] **Step 2:** Rewrite `src/App.tsx` (temporary file list replaced by FileTree in Phase 7):
```tsx
import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { Editor } from "./components/Editor";
import { FolderPicker } from "./components/FolderPicker";
import { fsList, fsRead, watcherSubscribe } from "./lib/ipc/commands";
import { useDocuments } from "./state/documents";
import type { DirEntry } from "./lib/ipc/types";

export default function App() {
  const [folder, setFolder] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const { documents, activeId, openDocument, setActive, setContent } = useDocuments();
  const active = documents.find((d) => d.id === activeId) ?? null;
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => { if (folder) fsList(folder).then(setEntries).catch(console.error); }, [folder]);

  async function openFile(path: string) {
    const existing = documents.find((d) => d.path === path);
    if (existing) { setActive(existing.id); return; }
    const r = await fsRead(path);
    const id = openDocument({ path, content: r.content, savedMtime: r.mtime_ms, encoding: r.encoding });
    await watcherSubscribe(path);
    setActive(id);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100vh" }}>
      <aside style={{ borderRight: "1px solid #ccc", padding: 8, overflow: "auto" }}>
        {folder ? (
          <>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{folder}</div>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {entries.map((e) => (
                <li key={e.path}>
                  {e.is_dir
                    ? <span>📁 {e.name}</span>
                    : <button style={{ all: "unset", cursor: "pointer" }} onClick={() => openFile(e.path)}>📄 {e.name}</button>}
                </li>
              ))}
            </ul>
          </>
        ) : (<FolderPicker onPick={setFolder} />)}
      </aside>
      <main style={{ height: "100vh" }}>
        {active ? (
          <Editor
            docId={active.id}
            value={active.content}
            onChange={(next) => setContent(active.id, next)}
            readOnly={active.readOnly}
            onReady={(view) => { viewRef.current = view; }}
          />
        ) : (<div style={{ padding: 24 }}>No file open.</div>)}
      </main>
    </div>
  );
}
```
- [ ] **Step 3:** `pnpm tauri dev` — manual verify.
- [ ] **Step 4:** Commit.

### Phase 4 checkpoint
- Manual: open folder → click file → edit → state updates.

---

## Phase 5 — Autosave + flush on close + confirmation

### Task 5.1: Preferences + useAutosave

**Files:** Create `src/state/preferences.ts`, `src/hooks/useAutosave.ts`, `src/hooks/useAutosave.test.ts`.

- [ ] **Step 1:** `src/state/preferences.ts`:
```ts
import { create } from "zustand";
interface Prefs {
  autosaveEnabled: boolean;
  autosaveDebounceMs: number;
  setAutosaveEnabled(v: boolean): void;
}
export const usePreferences = create<Prefs>((set) => ({
  autosaveEnabled: true,
  autosaveDebounceMs: 2000,
  setAutosaveEnabled: (v) => set({ autosaveEnabled: v }),
}));
```
- [ ] **Step 2:** Failing test `useAutosave.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";

describe("useAutosave", () => {
  it("calls saver after debounce when content changes", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ content }) => useAutosave({ enabled: true, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } }
    );
    rerender({ content: "b" });
    await act(async () => { vi.advanceTimersByTime(1999); });
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });
  it("does not save when disabled", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { rerender } = renderHook(
      ({ content }) => useAutosave({ enabled: false, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } }
    );
    rerender({ content: "b" });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("flush() saves the latest content", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ content }) => useAutosave({ enabled: true, debounceMs: 2000, content, save }),
      { initialProps: { content: "a" } }
    );
    rerender({ content: "b" });
    await act(async () => { await result.current.flush(); });
    expect(save).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });
});
```
- [ ] **Step 3:** `src/hooks/useAutosave.ts`:
```ts
import { useEffect, useRef } from "react";

interface Input {
  enabled: boolean;
  debounceMs: number;
  content: string;
  save: (content: string) => Promise<void>;
}

export function useAutosave({ enabled, debounceMs, content, save }: Input) {
  const latest = useRef(content);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  latest.current = content;

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = true;
    timer.current = setTimeout(async () => {
      const value = latest.current;
      pending.current = false;
      await save(value);
    }, debounceMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [content, enabled, debounceMs, save]);

  async function flush() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current) { pending.current = false; await save(latest.current); }
  }
  return { flush };
}
```
- [ ] **Step 4:** Run — 3 passing.
- [ ] **Step 5:** Commit.

### Task 5.2: Wire autosave + flushRef

**Files:** Create `src/state/flushRef.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** `src/state/flushRef.ts`:
```ts
export const flushRef: { current: null | (() => Promise<void>) } = { current: null };
```
- [ ] **Step 2:** In `App.tsx` body:
```tsx
import { usePreferences } from "./state/preferences";
import { useAutosave } from "./hooks/useAutosave";
import { fsWrite } from "./lib/ipc/commands";
import { flushRef } from "./state/flushRef";
// ...
const autosaveEnabled = usePreferences((s) => s.autosaveEnabled);
const autosaveDebounceMs = usePreferences((s) => s.autosaveDebounceMs);
const { markSaved, markSaveStarted, markSaveFailed } = useDocuments.getState();

const { flush } = useAutosave({
  enabled: autosaveEnabled && !!active?.path && !active?.readOnly,
  debounceMs: autosaveDebounceMs,
  content: active?.content ?? "",
  save: async (value) => {
    if (!active?.path) return;
    try {
      markSaveStarted(active.id);
      const r = await fsWrite(active.path, value);
      markSaved(active.id, { content: value, mtimeMs: r.mtime_ms });
    } catch (e) {
      markSaveFailed(active.id, String(e));
    }
  },
});
useEffect(() => { flushRef.current = flush; }, [flush]);
```
- [ ] **Step 3:** Manual: edit → 2s → file on disk updated.
- [ ] **Step 4:** Commit.

### Task 5.3: Close flow

**Files:** Modify `src/App.tsx`.

- [ ] **Step 1:** Add:
```tsx
import { listen } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/api/window";
import { confirm } from "@tauri-apps/plugin-dialog";
// ...
useEffect(() => {
  const p = listen("app.close-requested", async () => {
    const dirty = useDocuments.getState().documents.filter((d) => d.isDirty);
    if (usePreferences.getState().autosaveEnabled) {
      if (flushRef.current) await flushRef.current();
      await getCurrent().close();
      return;
    }
    if (dirty.length === 0) { await getCurrent().close(); return; }
    const ok = await confirm(
      `You have ${dirty.length} unsaved document(s). Close without saving?`,
      { title: "Unsaved changes", kind: "warning" }
    );
    if (ok) await getCurrent().close();
  });
  return () => { p.then((fn) => fn()); };
}, []);
```
- [ ] **Step 2:** Manual test both branches.
- [ ] **Step 3:** Commit.

### Phase 5 checkpoint
- Autosave tests pass.
- Manual both branches behave correctly.

---

## Phase 6 — External change: silent reload + conflict banner

### Task 6.1: useWatcherEvents

**Files:** Create `src/hooks/useWatcherEvents.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** `src/hooks/useWatcherEvents.ts`:
```ts
import { useEffect } from "react";
import { onFileChanged, onWatcherLost } from "../lib/ipc/events";
import { useDocuments } from "../state/documents";
import { decideOnExternalChange } from "../lib/conflict";
import { fsRead } from "../lib/ipc/commands";

export function useWatcherEvents(onWatcherOffline: (reason: string) => void) {
  useEffect(() => {
    const unfile = onFileChanged(async ({ path, mtime_ms }) => {
      const doc = useDocuments.getState().documents.find((d) => d.path === path);
      if (!doc) return;
      const decision = decideOnExternalChange({
        diskMtime: mtime_ms, savedMtime: doc.savedMtime, isDirty: doc.isDirty,
      });
      if (decision === "ignore") return;
      if (decision === "silent-reload") {
        const r = await fsRead(path);
        useDocuments.getState().replaceContentFromDisk(doc.id, { content: r.content, mtimeMs: r.mtime_ms });
        return;
      }
      useDocuments.getState().setConflict(doc.id, { diskMtime: mtime_ms });
    });
    const ulost = onWatcherLost((reason) => onWatcherOffline(reason));
    return () => { unfile.then((fn) => fn()); ulost.then((fn) => fn()); };
  }, [onWatcherOffline]);
}
```
- [ ] **Step 2:** In `App.tsx`:
```tsx
import { useWatcherEvents } from "./hooks/useWatcherEvents";
// inside App():
const [watcherOffline, setWatcherOffline] = useState<string | null>(null);
useWatcherEvents((reason) => setWatcherOffline(reason));
```
- [ ] **Step 3:** Commit.

### Task 6.2: ConflictBanner

**Files:** Create `src/components/ConflictBanner/ConflictBanner.tsx`, `src/components/ConflictBanner/ConflictBanner.test.tsx`, `src/components/ConflictBanner/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing test:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConflictBanner } from "./ConflictBanner";

describe("ConflictBanner", () => {
  it("renders three buttons and calls the right handler", async () => {
    const keep = vi.fn(), reload = vi.fn(), diff = vi.fn();
    render(<ConflictBanner onKeep={keep} onReload={reload} onDiff={diff} />);
    await userEvent.click(screen.getByRole("button", { name: /keep mine/i }));
    await userEvent.click(screen.getByRole("button", { name: /reload disk/i }));
    await userEvent.click(screen.getByRole("button", { name: /show diff/i }));
    expect(keep).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(diff).toHaveBeenCalledOnce();
  });
});
```
- [ ] **Step 2:** Implement:
```tsx
interface Props { onKeep: () => void; onReload: () => void; onDiff: () => void; }
export function ConflictBanner({ onKeep, onReload, onDiff }: Props) {
  return (
    <div role="alert" style={{ background: "#fff3cd", padding: 12, borderBottom: "1px solid #e0c872" }}>
      <strong>File changed on disk.</strong>
      <span style={{ marginLeft: 8, opacity: 0.8 }}>Your edits are unsaved.</span>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={onKeep}>Keep mine</button>
        <button onClick={onReload}>Reload disk</button>
        <button onClick={onDiff}>Show diff</button>
      </div>
    </div>
  );
}
```
And `index.ts` exporting.
- [ ] **Step 3:** Run — passing.
- [ ] **Step 4:** Wire in `App.tsx` above `<Editor>`:
```tsx
{active?.conflict && (
  <ConflictBanner
    onKeep={async () => {
      useDocuments.getState().setConflict(active.id, null);
      if (flushRef.current) await flushRef.current();
    }}
    onReload={async () => {
      if (!active.path) return;
      const r = await fsRead(active.path);
      useDocuments.getState().replaceContentFromDisk(active.id, { content: r.content, mtimeMs: r.mtime_ms });
    }}
    onDiff={() => console.log("diff viewer is post-v1")}
  />
)}
```
- [ ] **Step 5:** Commit.

### Phase 6 checkpoint
- External change clean → silent reload. Dirty → banner.

---

## Phase 7 — Tabs, FileTree, StatusBar

### Task 7.1: TabBar

**Files:** Create `src/components/TabBar/TabBar.tsx`, `src/components/TabBar/TabBar.test.tsx`, `src/components/TabBar/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing test:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TabBar } from "./TabBar";

const docs = [
  { id: "a", title: "One.md", isDirty: false },
  { id: "b", title: "Two.md", isDirty: true },
];

describe("TabBar", () => {
  it("renders one tab per doc and marks dirty ones", () => {
    render(<TabBar docs={docs} activeId="a" onActivate={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("tab", { name: /One\.md/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Two\.md/ })).toHaveAttribute("data-dirty", "true");
  });
  it("activates on click", async () => {
    const onActivate = vi.fn();
    render(<TabBar docs={docs} activeId="a" onActivate={onActivate} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: /Two\.md/ }));
    expect(onActivate).toHaveBeenCalledWith("b");
  });
  it("closes via button", async () => {
    const onClose = vi.fn();
    render(<TabBar docs={docs} activeId="a" onActivate={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getAllByRole("button", { name: /close/i })[0]);
    expect(onClose).toHaveBeenCalledWith("a");
  });
});
```
- [ ] **Step 2:** Implement:
```tsx
interface Tab { id: string; title: string; isDirty: boolean; }
interface Props {
  docs: Tab[];
  activeId: string | null;
  onActivate(id: string): void;
  onClose(id: string): void;
}
export function TabBar({ docs, activeId, onActivate, onClose }: Props) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: "1px solid #ccc" }}>
      {docs.map((d) => (
        <div key={d.id}
          role="tab"
          aria-selected={d.id === activeId}
          data-dirty={d.isDirty ? "true" : "false"}
          onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); onClose(d.id); } }}
          onClick={() => onActivate(d.id)}
          style={{ padding: "4px 8px", background: d.id === activeId ? "#f0f0f0" : "transparent",
                   cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {d.isDirty && <span aria-hidden="true">•</span>}
          <span>{d.title}</span>
          <button aria-label={`Close ${d.title}`} onClick={(e) => { e.stopPropagation(); onClose(d.id); }}
                  style={{ border: 0, background: "transparent", cursor: "pointer" }}>×</button>
        </div>
      ))}
    </div>
  );
}
```
- [ ] **Step 3:** Wire into `App.tsx` above `<Editor>`:
```tsx
<TabBar
  docs={documents.map((d) => ({
    id: d.id,
    title: d.path ? d.path.split("/").pop()! : "Untitled",
    isDirty: d.isDirty,
  }))}
  activeId={activeId}
  onActivate={setActive}
  onClose={async (id) => {
    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    if (doc?.previewWindowLabel) {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("window_close", { label: doc.previewWindowLabel });
    }
    useDocuments.getState().closeDocument(id);
  }}
/>
```
- [ ] **Step 4:** Commit.

### Task 7.2: FileTree

**Files:** Create `src/components/FileTree/FileTree.tsx`, `src/components/FileTree/FileTree.test.tsx`, `src/components/FileTree/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing test:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FileTree } from "./FileTree";

vi.mock("../../lib/ipc/commands", () => ({
  fsList: vi.fn(async (p: string) => {
    if (p === "/root") return [
      { name: "sub", path: "/root/sub", is_dir: true },
      { name: "a.md", path: "/root/a.md", is_dir: false },
    ];
    return [{ name: "b.md", path: "/root/sub/b.md", is_dir: false }];
  }),
}));

describe("FileTree", () => {
  it("lists files and opens on click", async () => {
    const onOpenFile = vi.fn();
    render(<FileTree root="/root" onOpenFile={onOpenFile} />);
    const item = await screen.findByText("a.md");
    await userEvent.click(item);
    expect(onOpenFile).toHaveBeenCalledWith("/root/a.md");
  });
  it("expands folders and shows children", async () => {
    render(<FileTree root="/root" onOpenFile={() => {}} />);
    const folder = await screen.findByText("sub");
    await userEvent.click(folder);
    await screen.findByText("b.md");
  });
});
```
- [ ] **Step 2:** Implement:
```tsx
import { useEffect, useState } from "react";
import { fsList } from "../../lib/ipc/commands";
import type { DirEntry } from "../../lib/ipc/types";

interface Props { root: string; onOpenFile(path: string): void; }
interface NodeProps { entry: DirEntry; onOpenFile(path: string): void; }

function Node({ entry, onOpenFile }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  async function toggle() {
    if (!entry.is_dir) return;
    if (!expanded && children === null) setChildren(await fsList(entry.path));
    setExpanded((v) => !v);
  }

  return (
    <div>
      <div onClick={entry.is_dir ? toggle : () => onOpenFile(entry.path)}
           style={{ cursor: "pointer", padding: "2px 4px" }}>
        {entry.is_dir ? (expanded ? "📂" : "📁") : "📄"} {entry.name}
      </div>
      {expanded && children && (
        <div style={{ paddingLeft: 16 }}>
          {children.map((c) => <Node key={c.path} entry={c} onOpenFile={onOpenFile} />)}
        </div>
      )}
    </div>
  );
}

export function FileTree({ root, onOpenFile }: Props) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  useEffect(() => { fsList(root).then(setEntries); }, [root]);
  if (!entries) return <div>Loading…</div>;
  return <div>{entries.map((e) => <Node key={e.path} entry={e} onOpenFile={onOpenFile} />)}</div>;
}
```
- [ ] **Step 3:** Replace the temporary list in `App.tsx` with `<FileTree root={folder} onOpenFile={openFile} />`.
- [ ] **Step 4:** Commit.

### Task 7.3: StatusBar

**Files:** Create `src/components/StatusBar/StatusBar.tsx`, `src/components/StatusBar/StatusBar.test.tsx`, `src/components/StatusBar/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing test:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("shows dirty + word count + save status", () => {
    render(<StatusBar isDirty saveState="saved" wordCount={42} watcherOffline={null} />);
    expect(screen.getByText(/42 words/)).toBeInTheDocument();
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    expect(screen.getByLabelText(/unsaved changes/i)).toBeInTheDocument();
  });
});
```
- [ ] **Step 2:** Implement:
```tsx
interface Props {
  isDirty: boolean;
  saveState: "idle" | "saving" | "saved" | "failed";
  wordCount: number;
  watcherOffline: string | null;
}
export function StatusBar({ isDirty, saveState, wordCount, watcherOffline }: Props) {
  const saveLabel = saveState === "saving" ? "Saving…"
                 : saveState === "saved" ? "Saved"
                 : saveState === "failed" ? "Save failed" : "";
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 8px", borderTop: "1px solid #ccc", fontSize: 12 }}>
      {isDirty && <span aria-label="unsaved changes">•</span>}
      <span>{saveLabel}</span>
      <span>{wordCount} words</span>
      {watcherOffline && (
        <span role="alert" title={watcherOffline}>
          ⚠ file watcher offline — external changes won't reload
        </span>
      )}
    </div>
  );
}
```
- [ ] **Step 3:** Wire in `App.tsx` below `<Editor>`:
```tsx
<StatusBar
  isDirty={active?.isDirty ?? false}
  saveState={active?.saveState ?? "idle"}
  wordCount={(active?.content ?? "").trim().split(/\s+/).filter(Boolean).length}
  watcherOffline={watcherOffline}
/>
```
- [ ] **Step 4:** Commit.

### Phase 7 checkpoint
- Component tests pass.
- Manual multi-tab + dirty dots + save transitions.

---

## Phase 7.5 — Open files (multi-select) + session restore (added 2026-04-21)

Inserted after Phase 7 in response to user request. Two small additions before the markdown rendering work begins.

### Task 7.5.1: OpenButtons (multi-file + folder)
- Replace `FolderPicker.tsx` with `OpenButtons.tsx`.
- "Open file(s)…" — `open({ multiple: true, filters: [{ name: "Markdown", extensions: ["md", "markdown"] }] })`. Each selected path goes through the existing `openFile`.
- "Open folder…" — same as the previous `FolderPicker` behavior.
- Always visible at the top of the sidebar (not gated on empty state).

### Task 7.5.2: Session persistence
- `src/state/sessionPersistence.ts` — `startSessionPersistence()` subscribes to `useDocuments` and writes `{ paths, activePath }` to `localStorage` (key `evhan-md-editor:session`). Writes are deduped by serialized form so per-keystroke edits don't spam localStorage. `loadPersistedSession()` defends against missing key, malformed JSON, and wrong shape.
- App effect on mount: load persisted session, start the subscribe, replay `openFile(path)` for each persisted path (silently skip per-file failures), then resolve `activePath` to its new doc id and `setActive`.
- `openFile`'s dedupe check switched to `useDocuments.getState().documents.find` so the restore loop sees live state instead of the stale render-time closure.

### Phase 7.5 checkpoint
- All Phase-7.5 tests pass (4 in `sessionPersistence.test.ts`).
- Manual: open files, close app, reopen — same files appear; missing files are silently dropped.

---

## Phase 8 — Markdown rendering pipeline

### Task 8.1: Base pipeline + sanitize

**Files:** Create `src/lib/markdown/pipeline.ts`, `src/lib/markdown/pipeline.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./pipeline";

describe("renderMarkdown", () => {
  it("renders GFM headings and tables", async () => {
    const html = await renderMarkdown("# Hi\n\n| a | b |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain("<h1>Hi</h1>");
    expect(html).toContain("<table>");
  });
  it("renders math via katex", async () => {
    const html = await renderMarkdown("$E=mc^2$");
    expect(html).toContain("katex");
  });
  it("strips script tags from raw HTML in source", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>\n\n# ok\n");
    expect(html).not.toContain("<script");
    expect(html).toContain("<h1>ok</h1>");
  });
});
```
- [ ] **Step 2:** Implement:
```ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    pre: ["className", "style", "tabIndex"],
    code: ["className", "style"],
    span: [...(defaultSchema.attributes?.span || []), "className", "style"],
    div: [...(defaultSchema.attributes?.div || []), "className", "style"],
    svg: ["className", "viewBox", "xmlns", "width", "height", "role", "ariaLabel"],
    path: ["d", "fill", "stroke", "strokeWidth"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "svg", "path", "g", "line", "rect", "circle", "text", "tspan",
  ],
};

export async function renderMarkdown(md: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeKatex, { throwOnError: false, errorColor: "#cc0000" })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
  const file = await processor.process(md);
  return String(file);
}
```
- [ ] **Step 3:** Run — 3 passing.
- [ ] **Step 4:** Commit.

### Task 8.2: Add Shiki

**Files:** Modify `src/lib/markdown/pipeline.ts`, `src/lib/markdown/pipeline.test.ts`.

- [ ] **Step 1:** Test:
```ts
it("renders shiki-highlighted code blocks", async () => {
  const html = await renderMarkdown("```ts\nconst a: number = 1;\n```\n");
  expect(html).toContain("<pre");
  expect(html).toContain("shiki");
});
```
- [ ] **Step 2:** Insert rehypeShiki before rehypeSanitize:
```ts
import rehypeShiki from "rehype-shiki";
// ...
.use(rehypeShiki, { theme: "github-dark" })
```
- [ ] **Step 3:** Run — passing.
- [ ] **Step 4:** Commit.

### Task 8.3: Add Mermaid

**Files:** Create `src/lib/markdown/mermaid-plugin.ts`; modify pipeline + test.

- [ ] **Step 1:** Test:
```ts
it("converts mermaid fences to svg (or error block on bad syntax)", async () => {
  const good = await renderMarkdown("```mermaid\nflowchart TD; A-->B;\n```\n");
  expect(good).toMatch(/<svg/);
  const bad = await renderMarkdown("```mermaid\nthis is not mermaid\n```\n");
  expect(bad).toContain("mermaid-error");
});
```
- [ ] **Step 2:** `src/lib/markdown/mermaid-plugin.ts`:
```ts
import type { Plugin } from "unified";
import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

export const rehypeMermaidInline: Plugin<[], Root> = () => {
  return async (tree) => {
    const jobs: Array<{ node: Element; code: string }> = [];
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre" || !node.children?.[0]) return;
      const inner = node.children[0] as Element;
      if (inner.tagName !== "code") return;
      const classes = (inner.properties?.className || []) as string[];
      if (!classes.includes("language-mermaid")) return;
      const textNode = inner.children?.[0];
      if (textNode && textNode.type === "text") {
        jobs.push({ node, code: textNode.value });
      }
    });
    for (const job of jobs) {
      try {
        const { svg } = await mermaid.render(`m-${Math.random().toString(36).slice(2)}`, job.code);
        job.node.tagName = "div";
        job.node.properties = { className: ["mermaid"] };
        job.node.children = [{ type: "raw", value: svg } as unknown as Element];
      } catch (e) {
        job.node.tagName = "pre";
        job.node.properties = { className: ["mermaid-error"] };
        job.node.children = [{ type: "text", value: `Mermaid error: ${(e as Error).message}` } as unknown as Element];
      }
    }
  };
};
```
- [ ] **Step 3:** Update `pipeline.ts` to:
```ts
.use(remarkRehype, { allowDangerousHtml: true })
.use(rehypeMermaidInline)
.use(rehypeKatex, { throwOnError: false, errorColor: "#cc0000" })
.use(rehypeShiki, { theme: "github-dark" })
.use(rehypeSanitize, sanitizeSchema)
.use(rehypeStringify, { allowDangerousHtml: true })
```
- [ ] **Step 4:** Run — passing.
- [ ] **Step 5:** Commit.

### Task 8.4: Inline render errors smoke test

- [ ] **Step 1:** Test:
```ts
it("continues rendering when math is malformed", async () => {
  const html = await renderMarkdown("# Ok\n\n$\\frac{}{}$ $E=mc^2$\n");
  expect(html).toContain("<h1>Ok</h1>");
  expect(html).toContain("katex");
});
```
- [ ] **Step 2:** Run — expect passing (already green via `throwOnError: false`).
- [ ] **Step 3:** Commit.

### Phase 8 checkpoint
- Pipeline tests green.

---

## Phase 9 — Preview window

### Task 9.1: safeReplaceChildren helper

**Files:** Create `src/lib/safeInsertHtml.ts`, `src/lib/safeInsertHtml.test.ts`.

The helper is the **only** path for DOM insertion of rendered HTML. No component may bypass it. It uses DOMParser and `replaceChildren`, so no direct DOM property assignment happens.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml, safeReplaceChildren } from "./safeInsertHtml";

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    expect(sanitizeHtml("<p>ok</p><script>bad()</script>")).not.toContain("script");
  });
  it("keeps common markup", () => {
    expect(sanitizeHtml("<h1>Hi</h1>")).toContain("<h1>Hi</h1>");
  });
});

describe("safeReplaceChildren", () => {
  it("parses cleaned html and replaces children", () => {
    const host = document.createElement("div");
    safeReplaceChildren(host, "<p>hello</p>");
    expect(host.querySelector("p")?.textContent).toBe("hello");
  });
  it("strips scripts before inserting", () => {
    const host = document.createElement("div");
    safeReplaceChildren(host, "<p>ok</p><script>1</script>");
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("p")?.textContent).toBe("ok");
  });
});
```
- [ ] **Step 2:** Implement:
```ts
import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  });
}

/**
 * Safely replace an element's children with parsed, sanitized HTML.
 * Uses DOMParser + replaceChildren to avoid any direct property assignment
 * patterns. Every DOM insertion of markdown-derived HTML must go through
 * this helper.
 */
export function safeReplaceChildren(host: HTMLElement, html: string): void {
  const clean = sanitizeHtml(html);
  const parsed = new DOMParser().parseFromString(clean, "text/html");
  const nodes = Array.from(parsed.body.childNodes);
  host.replaceChildren(...nodes);
}
```
- [ ] **Step 3:** Run — 4 passing.
- [ ] **Step 4:** Commit.

### Task 9.2: Preview entry + component

**Files:** Create `preview.html`, `src/preview/main.tsx`, `src/preview/Preview.tsx`; modify `vite.config.ts`.

- [ ] **Step 1:** `vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        preview: resolve(__dirname, "preview.html"),
      },
    },
  },
});
```
- [ ] **Step 2:** `preview.html` = copy of `index.html` pointing to `/src/preview/main.tsx`.
- [ ] **Step 3:** `src/preview/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Preview } from "./Preview";
const params = new URLSearchParams(location.search);
const docId = params.get("docId") ?? "";
ReactDOM.createRoot(document.getElementById("root")!).render(<Preview docId={docId} />);
```
- [ ] **Step 4:** `src/preview/Preview.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { renderMarkdown } from "../lib/markdown/pipeline";
import { safeReplaceChildren } from "../lib/safeInsertHtml";

export function Preview({ docId }: { docId: string }) {
  const [orphan, setOrphan] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  async function updateFrom(content: string) {
    const html = await renderMarkdown(content);
    if (!hostRef.current) return;
    safeReplaceChildren(hostRef.current, html);
    attachCopyButtons(hostRef.current);
  }

  useEffect(() => {
    const unlisten = listen<{ id: string; content: string }>("preview.contentUpdate", async (e) => {
      if (e.payload.id !== docId) return;
      await updateFrom(e.payload.content);
    });
    const unorphan = listen("editor.closed", () => setOrphan(true));
    return () => { unlisten.then((fn) => fn()); unorphan.then((fn) => fn()); };
  }, [docId]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      {orphan && (
        <div role="alert" style={{ background: "#f4f4f4", padding: 8, marginBottom: 12 }}>
          Editor closed — this preview is read-only.
        </div>
      )}
      <div ref={hostRef} />
    </div>
  );
}

function attachCopyButtons(host: HTMLElement) {
  host.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy-btn")) return;
    const code = pre.querySelector("code");
    if (!code) return;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(code.textContent || "");
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; }, 1500);
    });
    pre.prepend(btn);
  });
}
```
- [ ] **Step 5:** Commit.

### Task 9.3: Open preview + 200ms sync

**Files:** Modify `src-tauri/src/commands.rs`, `src-tauri/src/main.rs`, `src/App.tsx`.

- [ ] **Step 1:** Rust commands:
```rust
#[tauri::command]
pub fn window_open_preview(
    app: tauri::AppHandle, label: String, title: String, doc_id: String,
) -> Result<(), crate::types::FsError> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    if app.get_webview_window(&label).is_some() { return Ok(()); }
    let url = WebviewUrl::App(format!("preview.html?docId={}", doc_id).into());
    WebviewWindowBuilder::new(&app, label, url)
        .title(title)
        .inner_size(900.0, 700.0)
        .build()
        .map(|_| ())
        .map_err(|e| crate::types::FsError::Io(e.to_string()))
}

#[tauri::command]
pub fn window_close(app: tauri::AppHandle, label: String) -> Result<(), crate::types::FsError> {
    use tauri::Manager;
    if let Some(w) = app.get_webview_window(&label) {
        w.close().map_err(|e| crate::types::FsError::Io(e.to_string()))?;
    }
    Ok(())
}
```
Register in `generate_handler![...]`.
- [ ] **Step 2:** In `App.tsx`, add a togglePreview wired to a temporary button in StatusBar (moved to Toolbar in Phase 10):
```tsx
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
// ...
async function togglePreview() {
  if (!active) return;
  const label = active.previewWindowLabel ?? `preview-${active.id}`;
  if (active.previewWindowLabel) {
    await invoke("window_close", { label });
    useDocuments.getState().setPreviewWindowLabel(active.id, null);
  } else {
    await invoke("window_open_preview", {
      label, title: `Preview · ${active.path ?? "Untitled"}`, docId: active.id,
    });
    useDocuments.getState().setPreviewWindowLabel(active.id, label);
    await emit("preview.contentUpdate", { id: active.id, content: active.content });
  }
}
```
- [ ] **Step 3:** 200 ms debounced sync:
```tsx
useEffect(() => {
  if (!active?.previewWindowLabel) return;
  const t = setTimeout(() => {
    emit("preview.contentUpdate", { id: active.id, content: active.content });
  }, 200);
  return () => clearTimeout(t);
}, [active?.content, active?.previewWindowLabel, active?.id]);
```
- [ ] **Step 4:** Manual verify.
- [ ] **Step 5:** Commit.

### Task 9.4: Orphan banner + tab-close closes preview

**Files:** Modify `src/App.tsx`.

Tab-close → window_close is already wired in Task 7.1.
- [ ] **Step 1:** Extend `app.close-requested` handler to emit `editor.closed` before closing:
```tsx
// Replace `await getCurrent().close();` with:
await emit("editor.closed");
await getCurrent().close();
```
- [ ] **Step 2:** Manual test.
- [ ] **Step 3:** Commit.

### Phase 9 checkpoint
- Preview opens / closes; syncs ~250 ms; tab-close closes it; main-close shows orphan banner.

---

## Phase 10 — Word-like formatting toolbar

### Task 10.1: Transaction helpers

**Files:** Create `src/lib/toolbar/actions.ts`, `src/lib/toolbar/actions.test.ts`.

- [ ] **Step 1:** Failing tests:
```ts
import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { wrapSelection, linePrefix, listPrefix, insertBlock, insertLink, insertTable } from "./actions";

function apply(state: EditorState, tr: ReturnType<typeof wrapSelection>): string {
  return state.update(tr).state.doc.toString();
}

describe("wrapSelection", () => {
  it("wraps at cursor", () => {
    const state = EditorState.create({ doc: "hi" });
    expect(apply(state, wrapSelection(state, "**"))).toBe("****hi");
  });
  it("wraps non-empty selection", () => {
    const state = EditorState.create({ doc: "hi", selection: { anchor: 0, head: 2 } });
    expect(apply(state, wrapSelection(state, "**"))).toBe("**hi**");
  });
});

describe("linePrefix", () => {
  it("single line", () => {
    const state = EditorState.create({ doc: "hi\nho" });
    expect(apply(state, linePrefix(state, "# "))).toBe("# hi\nho");
  });
  it("multi-line selection", () => {
    const state = EditorState.create({ doc: "hi\nho", selection: { anchor: 0, head: 5 } });
    expect(apply(state, linePrefix(state, "> "))).toBe("> hi\n> ho");
  });
});

describe("listPrefix", () => {
  it("ordered numbers lines", () => {
    const state = EditorState.create({ doc: "a\nb", selection: { anchor: 0, head: 3 } });
    expect(apply(state, listPrefix(state, "ol"))).toBe("1. a\n2. b");
  });
  it("task list syntax", () => {
    const state = EditorState.create({ doc: "a\nb", selection: { anchor: 0, head: 3 } });
    expect(apply(state, listPrefix(state, "task"))).toBe("- [ ] a\n- [ ] b");
  });
});

describe("insertBlock + insertLink + insertTable", () => {
  it("insertBlock at cursor", () => {
    const state = EditorState.create({ doc: "x" });
    expect(apply(state, insertBlock(state, "\n\n---\n\n"))).toBe("\n\n---\n\nx");
  });
  it("insertLink with text and url", () => {
    const state = EditorState.create({ doc: "" });
    expect(apply(state, insertLink(state, "Claude", "https://claude.com")))
      .toBe("[Claude](https://claude.com)");
  });
  it("insertTable minimal 1x1", () => {
    const state = EditorState.create({ doc: "" });
    const out = apply(state, insertTable(state, 1, 1));
    expect(out).toContain("| Header |");
    expect(out).toContain("| --- |");
    expect(out).toContain("| cell |");
  });
});
```
- [ ] **Step 2:** Implement:
```ts
import type { EditorState, TransactionSpec, ChangeSpec } from "@codemirror/state";

export function wrapSelection(state: EditorState, marker: string): TransactionSpec {
  const { from, to } = state.selection.main;
  const sel = state.sliceDoc(from, to);
  const next = `${marker}${sel}${marker}`;
  const anchor = from + marker.length;
  return {
    changes: { from, to, insert: next },
    selection: { anchor, head: anchor + sel.length },
  };
}

export function linePrefix(state: EditorState, prefix: string): TransactionSpec {
  const { from, to } = state.selection.main;
  const lineFrom = state.doc.lineAt(from);
  const lineTo = state.doc.lineAt(to);
  const changes: ChangeSpec[] = [];
  for (let n = lineFrom.number; n <= lineTo.number; n++) {
    const line = state.doc.line(n);
    changes.push({ from: line.from, insert: prefix });
  }
  return { changes };
}

export function listPrefix(state: EditorState, kind: "ul" | "ol" | "task"): TransactionSpec {
  const { from, to } = state.selection.main;
  const lineFrom = state.doc.lineAt(from);
  const lineTo = state.doc.lineAt(to);
  const changes: ChangeSpec[] = [];
  let counter = 1;
  for (let n = lineFrom.number; n <= lineTo.number; n++) {
    const line = state.doc.line(n);
    const prefix = kind === "ul" ? "- " : kind === "task" ? "- [ ] " : `${counter++}. `;
    changes.push({ from: line.from, insert: prefix });
  }
  return { changes };
}

export function insertBlock(state: EditorState, text: string): TransactionSpec {
  const { from, to } = state.selection.main;
  return { changes: { from, to, insert: text } };
}

export function insertLink(state: EditorState, text: string, url: string): TransactionSpec {
  const { from, to } = state.selection.main;
  return { changes: { from, to, insert: `[${text}](${url})` } };
}

export function insertTable(state: EditorState, rows: number, cols: number): TransactionSpec {
  const header = `| ${Array(cols).fill("Header").join(" | ")} |`;
  const sep = `| ${Array(cols).fill("---").join(" | ")} |`;
  const body = Array(rows).fill(`| ${Array(cols).fill("cell").join(" | ")} |`).join("\n");
  return insertBlock(state, `\n\n${header}\n${sep}\n${body}\n\n`);
}
```
- [ ] **Step 3:** Run — all passing.
- [ ] **Step 4:** Commit.

### Task 10.2: Toolbar component

**Files:** Create `src/components/Toolbar/Toolbar.tsx`, `src/components/Toolbar/Toolbar.test.tsx`, `src/components/Toolbar/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing tests — write **one test per action** in this style, with the expected final document content:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Toolbar } from "./Toolbar";

function makeView(doc = "hello"): EditorView {
  const host = document.createElement("div");
  document.body.appendChild(host);
  return new EditorView({ state: EditorState.create({ doc }), parent: host });
}

describe("Toolbar", () => {
  it("Bold wraps cursor with **", async () => {
    const view = makeView();
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /bold/i }));
    expect(view.state.doc.toString()).toBe("****hello");
  });
  it("Italic wraps cursor with _", async () => {
    const view = makeView("");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /italic/i }));
    expect(view.state.doc.toString()).toBe("__");
  });
  it("Inline code wraps with backtick", async () => {
    const view = makeView("x");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /inline code/i }));
    expect(view.state.doc.toString()).toBe("``x");
  });
  it("H1 prepends # ", async () => {
    const view = makeView("hi\nho");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /heading 1/i }));
    expect(view.state.doc.toString()).toBe("# hi\nho");
  });
  it("H2 prepends ## ", async () => {
    const view = makeView("hi");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /heading 2/i }));
    expect(view.state.doc.toString()).toBe("## hi");
  });
  it("H3 prepends ### ", async () => {
    const view = makeView("hi");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /heading 3/i }));
    expect(view.state.doc.toString()).toBe("### hi");
  });
  it("Unordered list prepends - ", async () => {
    const view = makeView("a");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /unordered list/i }));
    expect(view.state.doc.toString()).toBe("- a");
  });
  it("Ordered list numbers lines", async () => {
    const view = makeView("a");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /ordered list/i }));
    expect(view.state.doc.toString()).toBe("1. a");
  });
  it("Task list prepends - [ ] ", async () => {
    const view = makeView("a");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /task list/i }));
    expect(view.state.doc.toString()).toBe("- [ ] a");
  });
  it("Block quote prepends > ", async () => {
    const view = makeView("a");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /block quote/i }));
    expect(view.state.doc.toString()).toBe("> a");
  });
  it("Horizontal rule inserts ---", async () => {
    const view = makeView("x");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /horizontal rule/i }));
    expect(view.state.doc.toString()).toContain("---");
  });
  it("Code block inserts ``` fences", async () => {
    const view = makeView("x");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /code block/i }));
    expect(view.state.doc.toString()).toContain("```");
  });
  it("Link prompts and inserts [text](url)", async () => {
    const view = makeView("");
    vi.spyOn(window, "prompt").mockReturnValueOnce("Claude").mockReturnValueOnce("https://claude.com");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^link$/i }));
    expect(view.state.doc.toString()).toBe("[Claude](https://claude.com)");
  });
  it("Table prompts and inserts GFM skeleton", async () => {
    const view = makeView("");
    vi.spyOn(window, "prompt").mockReturnValueOnce("1").mockReturnValueOnce("1");
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /insert table/i }));
    expect(view.state.doc.toString()).toContain("| Header |");
  });
  it("Toggle preview button calls handler", async () => {
    const view = makeView("");
    const onTogglePreview = vi.fn();
    render(<Toolbar viewRef={{ current: view }} onTogglePreview={onTogglePreview} />);
    await userEvent.click(screen.getByRole("button", { name: /toggle preview/i }));
    expect(onTogglePreview).toHaveBeenCalledOnce();
  });
});
```
- [ ] **Step 2:** Implement `src/components/Toolbar/Toolbar.tsx`:
```tsx
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import {
  wrapSelection, linePrefix, listPrefix, insertBlock, insertLink, insertTable,
} from "../../lib/toolbar/actions";

interface Props {
  viewRef: RefObject<EditorView | null>;
  onTogglePreview: () => void;
}

export function Toolbar({ viewRef, onTogglePreview }: Props) {
  function withView(fn: (view: EditorView) => void) {
    const v = viewRef.current;
    if (!v) return;
    fn(v);
    v.focus();
  }

  const actions: Array<[string, string, () => void]> = [
    ["B", "Bold",            () => withView((v) => v.dispatch(wrapSelection(v.state, "**")))],
    ["I", "Italic",          () => withView((v) => v.dispatch(wrapSelection(v.state, "_")))],
    ["</>", "Inline code",   () => withView((v) => v.dispatch(wrapSelection(v.state, "`")))],
    ["H1", "Heading 1",      () => withView((v) => v.dispatch(linePrefix(v.state, "# ")))],
    ["H2", "Heading 2",      () => withView((v) => v.dispatch(linePrefix(v.state, "## ")))],
    ["H3", "Heading 3",      () => withView((v) => v.dispatch(linePrefix(v.state, "### ")))],
    ["• List", "Unordered list", () => withView((v) => v.dispatch(listPrefix(v.state, "ul")))],
    ["1. List", "Ordered list",  () => withView((v) => v.dispatch(listPrefix(v.state, "ol")))],
    ["☐ Task", "Task list",      () => withView((v) => v.dispatch(listPrefix(v.state, "task")))],
    ["❝", "Block quote",     () => withView((v) => v.dispatch(linePrefix(v.state, "> ")))],
    ["─", "Horizontal rule", () => withView((v) => v.dispatch(insertBlock(v.state, "\n\n---\n\n")))],
    ["```", "Code block",    () => withView((v) => v.dispatch(insertBlock(v.state, "\n\n```\n\n```\n\n")))],
    ["🔗", "Link",            () => {
      const text = window.prompt("Link text:", "") ?? "";
      const url = window.prompt("URL:", "https://") ?? "";
      if (!url) return;
      withView((v) => v.dispatch(insertLink(v.state, text || url, url)));
    }],
    ["⊞", "Insert table",    () => {
      const r = Number(window.prompt("Rows:", "3") ?? 0);
      const c = Number(window.prompt("Cols:", "3") ?? 0);
      if (r > 0 && c > 0) withView((v) => v.dispatch(insertTable(v.state, r, c)));
    }],
    ["🔍", "Find",            () => withView((v) => openSearchPanel(v))],
    ["👁", "Toggle preview",  () => onTogglePreview()],
  ];

  return (
    <div role="toolbar" aria-label="Formatting" style={{ display: "flex", gap: 4, padding: 4, borderBottom: "1px solid #ccc" }}>
      {actions.map(([label, aria, onClick]) => (
        <button key={aria} aria-label={aria} title={aria} onClick={onClick}>{label}</button>
      ))}
    </div>
  );
}
```
- [ ] **Step 3:** Wire into `App.tsx` above `<TabBar>`:
```tsx
<Toolbar viewRef={viewRef} onTogglePreview={togglePreview} />
```
- [ ] **Step 4:** Run tests + manual.
- [ ] **Step 5:** Commit.

### Phase 10 checkpoint
- All toolbar action tests pass.
- Manual: every button produces the expected markdown.

---

## Phase 11 — TOC, copy-button tests

(Find already wired in Toolbar via `openSearchPanel`.)

### Task 11.1: Heading extractor

**Files:** Create `src/components/TOC/headings.ts`, `src/components/TOC/headings.test.ts`.

- [ ] **Step 1:** Failing test:
```ts
import { describe, it, expect } from "vitest";
import { extractHeadings } from "./headings";
describe("extractHeadings", () => {
  it("finds ATX headings with line numbers", () => {
    const src = "# A\nhi\n## B\n### C\n";
    expect(extractHeadings(src)).toEqual([
      { level: 1, text: "A", line: 1 },
      { level: 2, text: "B", line: 3 },
      { level: 3, text: "C", line: 4 },
    ]);
  });
  it("ignores # inside fenced code blocks", () => {
    const src = "# A\n```\n# not a heading\n```\n## B\n";
    expect(extractHeadings(src)).toEqual([
      { level: 1, text: "A", line: 1 },
      { level: 2, text: "B", line: 5 },
    ]);
  });
});
```
- [ ] **Step 2:** Implement:
```ts
export interface Heading { level: number; text: string; line: number; }

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

export function extractHeadings(src: string): Heading[] {
  const out: Heading[] = [];
  const lines = src.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(HEADING_RE);
    if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 });
  }
  return out;
}
```
- [ ] **Step 3:** Run — passing.
- [ ] **Step 4:** Commit.

### Task 11.2: TOC component

**Files:** Create `src/components/TOC/TOC.tsx`, `src/components/TOC/TOC.test.tsx`, `src/components/TOC/index.ts`; modify `src/App.tsx`.

- [ ] **Step 1:** Failing test:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TOC } from "./TOC";

const headings = [
  { level: 1, text: "Intro", line: 1 },
  { level: 2, text: "Body", line: 10 },
];

describe("TOC", () => {
  it("highlights the active heading", () => {
    render(<TOC headings={headings} activeLine={11} onJump={() => {}} />);
    expect(screen.getByText("Body")).toHaveAttribute("aria-current", "location");
  });
  it("calls onJump with the heading line", async () => {
    const onJump = vi.fn();
    render(<TOC headings={headings} activeLine={1} onJump={onJump} />);
    await userEvent.click(screen.getByText("Body"));
    expect(onJump).toHaveBeenCalledWith(10);
  });
});
```
- [ ] **Step 2:** Implement:
```tsx
import type { Heading } from "./headings";
interface Props { headings: Heading[]; activeLine: number; onJump(line: number): void; }
export function TOC({ headings, activeLine, onJump }: Props) {
  const active = [...headings].reverse().find((h) => h.line <= activeLine);
  return (
    <nav aria-label="Table of contents" style={{ padding: 8, fontSize: 13 }}>
      {headings.map((h) => (
        <button
          key={`${h.line}-${h.text}`}
          onClick={() => onJump(h.line)}
          aria-current={active?.line === h.line ? "location" : undefined}
          style={{
            display: "block", textAlign: "left", width: "100%",
            paddingLeft: (h.level - 1) * 12,
            background: active?.line === h.line ? "#e5e5e5" : "transparent",
            border: 0, cursor: "pointer",
          }}
        >{h.text}</button>
      ))}
    </nav>
  );
}
```
- [ ] **Step 3:** Wire into `App.tsx` as a right sidebar. Track `activeLine` via `EditorView.updateListener` reading `view.state.doc.lineAt(view.state.selection.main.head).number`. Implement `onJump(line)` by dispatching a transaction that moves the selection to `view.state.doc.line(line).from` and scrolls into view.
- [ ] **Step 4:** Commit.

### Task 11.3: Preview copy buttons smoke test

**Files:** Create `src/preview/Preview.test.tsx`.

- [ ] **Step 1:** Test:
```tsx
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Preview } from "./Preview";

vi.mock("@tauri-apps/api/event", () => {
  let handler: any;
  return {
    listen: vi.fn(async (name: string, cb: any) => {
      if (name === "preview.contentUpdate") handler = cb;
      return () => {};
    }),
    __trigger: () => handler,
  };
});

describe("Preview", () => {
  it("renders copy buttons on code blocks", async () => {
    const { container } = render(<Preview docId="d1" />);
    const { __trigger } = (await import("@tauri-apps/api/event")) as any;
    await __trigger()?.({ payload: { id: "d1", content: "```ts\nconst a = 1;\n```\n" } });
    await waitFor(() => {
      expect(container.querySelectorAll(".copy-btn").length).toBeGreaterThan(0);
    });
  });
});
```
- [ ] **Step 2:** Run — expect passing.
- [ ] **Step 3:** Commit.

### Phase 11 checkpoint
- TOC and copy-button tests pass. Cmd-F opens find.

---

## Phase 12 — Export

### Task 12.1: HTML export

**Files:** Create `src/lib/export/html.ts`, `src/lib/export/styles.ts`, `src/lib/export/html.test.ts`; modify `src-tauri/src/commands.rs`, `src-tauri/src/main.rs`, `src/App.tsx`.

- [ ] **Step 1:** `src/lib/export/styles.ts`:
```ts
import katexCss from "katex/dist/katex.min.css?raw";
export const exportCss = `
  ${katexCss}
  body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; }
  pre { overflow-x: auto; padding: 12px; border-radius: 6px; }
  .mermaid-error { background: #fee; color: #900; padding: 8px; border-radius: 4px; }
`;
```
- [ ] **Step 2:** `src/lib/export/html.ts`:
```ts
import { renderMarkdown } from "../markdown/pipeline";
import { sanitizeHtml } from "../safeInsertHtml";
import { exportCss } from "./styles";

export async function renderExportHtml(md: string, title = "Document"): Promise<string> {
  const body = sanitizeHtml(await renderMarkdown(md));
  const safeTitle = title.replace(/[<&>]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>${exportCss}</style>
</head>
<body>${body}</body>
</html>`;
}
```
- [ ] **Step 3:** Test:
```ts
import { describe, it, expect } from "vitest";
import { renderExportHtml } from "./html";
describe("renderExportHtml", () => {
  it("produces a full document with title and body", async () => {
    const s = await renderExportHtml("# Hi", "Test");
    expect(s).toMatch(/<!doctype html>/);
    expect(s).toContain("<h1>Hi</h1>");
    expect(s).toContain("<title>Test</title>");
  });
});
```
- [ ] **Step 4:** Rust command:
```rust
#[tauri::command]
pub fn export_html_write(path: String, html: String) -> Result<(), crate::types::FsError> {
    std::fs::write(&path, html).map_err(|e| crate::types::FsError::Io(e.to_string()))
}
```
Register.
- [ ] **Step 5:** UI button "Export → HTML…": opens `save` dialog, calls `renderExportHtml`, invokes `export_html_write`.
- [ ] **Step 6:** Commit.

### Task 12.2: PDF export (WebKit print)

**Files:** Create `src-tauri/src/export.rs`, `src-tauri/tests/export_pdf.rs`; modify `src-tauri/src/lib.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/main.rs`.

- [ ] **Step 1:** Failing test:
```rust
use evhan_md_editor_lib::export;
use std::fs;
use tempfile::TempDir;

#[tokio::test(flavor = "multi_thread")]
async fn produces_a_non_empty_pdf() {
    let dir = TempDir::new().unwrap();
    let out = dir.path().join("out.pdf");
    let html = "<!doctype html><html><body><h1>Hello</h1></body></html>";
    export::to_pdf(html, out.to_str().unwrap()).await.unwrap();
    let bytes = fs::read(&out).unwrap();
    assert!(bytes.len() > 200);
    assert!(bytes.starts_with(b"%PDF-"));
}
```
- [ ] **Step 2:** Initial stub to let the test shape settle. `src-tauri/src/export.rs`:
```rust
use crate::types::FsError;

pub async fn to_pdf(html: &str, out_path: &str) -> Result<(), FsError> {
    let _ = html;
    // Step-4 will replace this with a real WebKit print-to-PDF call.
    std::fs::write(out_path, b"%PDF-1.4\n%stub\n1 0 obj <<>> endobj\ntrailer <<>>\n")
        .map_err(|e| FsError::Io(e.to_string()))
}
```
Add `pub mod export;` to `src-tauri/src/lib.rs`.
- [ ] **Step 3:** Run — passing with the stub.
- [ ] **Step 4:** Replace the stub with the real implementation:
  1. Create a hidden `WebviewWindow` sized 816×1056 (US Letter at 96 dpi).
  2. Load the HTML via a data URL.
  3. Await page load.
  4. Call Tauri 2's print-to-PDF API (verify the exact method name for the installed Tauri version at implementation time). If unavailable in the version used, fall back to invoking `cupsfilter` via `std::process::Command` on macOS, with a comment in the code noting the fallback.
  5. Write the resulting bytes to `out_path`.
  Re-run the test — passing with a real multi-page PDF.
- [ ] **Step 5:** Expose command:
```rust
#[tauri::command]
pub async fn export_pdf_write(path: String, html: String) -> Result<(), crate::types::FsError> {
    crate::export::to_pdf(&html, &path).await
}
```
Register.
- [ ] **Step 6:** UI button "Export → PDF…" analogous to HTML export.
- [ ] **Step 7:** Commit.

### Phase 12 checkpoint
- Both exports produce valid files. LaTeX/Mermaid/Shiki survive.

---

## Phase 13 — Polish: themes, a11y, perf, signing, E2E

### Task 13.1: Themes

**Files:** Create `src/lib/themes/apply.ts`; modify `src/state/preferences.ts`, `src/App.tsx`.

- [ ] Add `theme: "system" | "light" | "dark"` to preferences.
- [ ] `apply.ts`: on mode `system`, subscribe to `prefers-color-scheme`; set `data-theme="light" | "dark"` attribute on `<html>`.
- [ ] Extend CSS on `[data-theme="dark"]`. Swap CodeMirror theme accordingly.
- [ ] Commit.

### Task 13.2: Empty states

- [ ] Polish "No folder open" empty state with Open folder… button.
- [ ] Add "No file open" state (folder set, no tabs).
- [ ] Commit.

### Task 13.3: Binary / non-UTF-8 / large-file UX

- [ ] Add Rust `fs_read_forced(path)` — skips binary sniff, lossy-decodes UTF-8.
- [ ] On `NotUtf8` / `LooksBinary`, show a dialog: "Open read-only anyway?" — on OK, call `fs_read_forced` and open with `readOnly: true`.
- [ ] Add Rust `fs_stat(path) -> { size }`; on file open > 10 MB, show "Large file — typing may lag. Open?"
- [ ] Commit.

### Task 13.4: Menus + shortcuts + drag-drop

**Files:** Modify `src-tauri/src/main.rs`, `src/App.tsx`.

- [ ] Native menus via Tauri 2 menu API:
  - File: Open folder (Cmd-Shift-O), Open file (Cmd-O), New (Cmd-N), Save (Cmd-S), Save As (Cmd-Shift-S), Close tab (Cmd-W), Export → HTML, Export → PDF.
  - Edit: Undo (Cmd-Z), Redo (Cmd-Shift-Z), Find (Cmd-F), Replace (Cmd-Opt-F).
  - View: Toggle Preview (Cmd-Shift-P), Toggle TOC (Cmd-Shift-T), Toggle Sidebar (Cmd-B).
  - Window: standard.
- [ ] Every toolbar button's `aria-label` includes its shortcut text.
- [ ] Drag-drop from Finder: Tauri 2 `onDragDrop` → `.md` paths trigger `openFile(path)`.
- [ ] Commit.

### Task 13.5: Watcher-offline retry

- [ ] Make the StatusBar watcher-offline indicator a button that, on click, iterates all documents with `path !== null` and calls `watcherSubscribe(path)` for each. Show "Retrying…" for 1 s. Clear the offline state on success.
- [ ] Commit.

### Task 13.6: a11y pass (axe-core)

**Files:** Create `tests/e2e/a11y.spec.ts`.

- [ ] `pnpm add -D @axe-core/playwright`.
- [ ] Spec launches the preview window on a reference doc (math + mermaid + code) and asserts zero axe violations.
- [ ] Manual VoiceOver spot-check; adjust labels as needed.
- [ ] Commit.

### Task 13.7: Performance manual verification

- [ ] `pnpm tauri build`.
- [ ] Cold launch × 5; record median in `STATUS.md`.
- [ ] 1 MB fixture: typing feel check.
- [ ] 10 MB fixture: open time under 3 s.
- [ ] If budget fails, add a follow-up in `STATUS.md` — do not hack around.
- [ ] Commit numbers.

### Task 13.8: Signing + notarization

**Files:** Create `scripts/release.sh`; modify `src-tauri/tauri.conf.json`.

- [ ] Enroll in Apple Developer Program; install Developer ID Application cert.
- [ ] Set `bundle.macOS.signingIdentity` in `tauri.conf.json`.
- [ ] Store app-specific password in Keychain under service `evhan-md-editor-notarize`.
- [ ] `scripts/release.sh`:
  1. `pnpm tauri build`.
  2. `xcrun notarytool submit path/to/app-or-dmg --keychain-profile evhan-md-editor-notarize --wait`.
  3. `xcrun stapler staple path/to/app-or-dmg`.
- [ ] Verify on a clean Mac: Gatekeeper opens without warnings.
- [ ] Commit.

### Task 13.9: Playwright E2E golden paths

**Files:** Create `tests/e2e/01-open-edit-save.spec.ts`, `tests/e2e/02-external-change-clean.spec.ts`, `tests/e2e/03-external-change-dirty.spec.ts`, `tests/e2e/04-preview-sync.spec.ts`, `tests/e2e/05-export-pdf.spec.ts`.

- [ ] **01:** pick a fixture folder, open `a.md`, type "hello", wait 2.1 s, read file via Node `fs`, assert match.
- [ ] **02:** open a clean file, externally write via Node `fs`, assert editor matches new disk content.
- [ ] **03:** open a file, type to make dirty, externally write, assert conflict banner with three buttons appears.
- [ ] **04:** toggle preview, type, attach to new window, assert content updates within 300 ms.
- [ ] **05:** open reference doc with math + mermaid + code, export PDF to temp, assert non-empty and starts with `%PDF-`.
- [ ] Commit.

### Phase 13 checkpoint
- E2E green. axe-core clean. Signed build runs on clean Mac. Perf numbers recorded.

---

## Self-review

### Spec coverage

| Spec requirement | Task(s) |
|---|---|
| LaTeX | 0.3, 8.1, 8.4 |
| Mermaid | 8.3 |
| Syntax-highlighted code | 8.2 |
| TOC + scroll-spy | 11.1, 11.2 |
| Multi-document tabs | 7.1 |
| Folder browser | 1.5, 7.2 |
| Live reload | 2.1, 2.2, 6.1 |
| Find (+ replace) | 10.2 (toolbar Find dispatches `openSearchPanel`; CodeMirror built-in covers replace) |
| PDF export | 12.2 |
| HTML export | 12.1 |
| Copy-button on code blocks | 9.2 + 11.3 |
| Light + dark + follow-system | 13.1 |
| Word-like toolbar (14 actions) | 10.1, 10.2 |
| Undo / redo | 4.1 (CodeMirror `history()`) |
| Autosave default on, 2 s, toggle | 5.1, 5.2, 5.3 |
| Autosave-off confirmation on close | 5.3 |
| Dirty indicator (tab + status) | 7.1, 7.3 |
| New / Save / Save As / Open / drag-drop | 13.4 + Phase 4 (open) + Phase 5 (save) |
| Separate preview window | 9.2, 9.3 |
| Preview sync 200 ms | 9.3 |
| Preview orphan handling | 9.4 |
| Conflict: never silent overwrite, 3 buttons | 3.2, 6.1, 6.2 |
| Binary / non-UTF-8 read-only open | 1.2, 13.3 |
| Large-file warning | 13.3 |
| Watcher offline + retry | 7.3, 13.5 |
| Inline render errors | 8.3, 8.4 |
| Signing + notarization | 13.8 |
| E2E golden paths | 13.9 |

No uncovered spec requirements.

### Placeholder scan

- No "TBD" / "TODO" / "implement later" / "fill in details" / "similar to task N".
- Task 12.2 has an intentional two-step: a stub that lets the test shape settle, then the real `print_to_pdf` implementation. Both are spelled out.

### Type / name consistency

- `FileRead { content, mtime_ms, encoding }` — Rust, IPC wrappers, tests all match.
- `decideOnExternalChange` return values — consistent.
- `Document.conflict: Conflict | null` set by `setConflict`, cleared by `replaceContentFromDisk` and by the banner's `onKeep` handler.
- `flushRef.current: (() => Promise<void>) | null` matches `useAutosave().flush`.
- `previewWindowLabel` set/cleared in 9.3 and 7.1.
- `safeReplaceChildren(host, html)` is the only DOM-insertion path for rendered HTML.

### Scope

One plan covers v1. Each phase is independently shippable.

---

## Handoff

Plan complete and saved to `docs/claude-code/specs/2026-04-21-markdown-editor/PLAN.md`.

Two options for execution:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task via `superpowers:subagent-driven-development`. Review between tasks. Best for long plans.
2. **Inline** — run tasks in this session via `superpowers:executing-plans`. Batched checkpoints for review. Faster turnaround but degrades on very long plans.

Given 50+ tasks across 13 phases, I recommend option 1. Which approach?
