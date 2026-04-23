# Performance and Quality

- Avoid unnecessary re-renders, full-document re-layouts, and preview re-renders on every keystroke.
- Treat cold launch time, large-file open time, and typing latency as real constraints.
- Debounce or incrementalize expensive work (syntax highlighting, preview rendering).
- Perceived performance matters, but fake-loading theater is not a strategy.
