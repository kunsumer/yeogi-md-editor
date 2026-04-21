# GOVERNANCE

Treat these as governance-sensitive — they require deliberate review, spec updates, and explicit verification:

- file I/O surface changes (open/save flow, autosave, file watching)
- unsaved-change and destructive-confirmation flows
- sandbox / entitlements / file-access scope changes
- keyboard shortcut and menu structure changes
- accessibility-impacting changes (focus, labels, VoiceOver, Dynamic Type)
- design-system / framework control substitutions
- performance budget regressions (launch time, large-file open, typing latency)
