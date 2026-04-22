# PERFORMANCE

Constraints that matter for a Markdown editor on macOS:

- cold launch time to first interactive editor
- time to open a large file (target: responsive UI during load)
- typing latency in large documents
- scroll smoothness in editor and preview
- preview re-render cost on each keystroke (debounce / incremental)
- syntax highlighting cost on large files
- memory footprint when many documents are open
- file-watcher cost when a large folder is being watched

Perceived performance matters (skeletons, progressive render), but fake-loading theater is not a strategy.
