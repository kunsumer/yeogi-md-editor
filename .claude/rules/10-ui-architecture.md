# UI Architecture Rules

- Keep document model, editor view, preview, chrome, and persistence separated.
- Prefer composition over giant god-views or god-controllers.
- Do not hide file I/O or unsaved-state logic inside presentation components.
- Boundary decisions should be visible in file structure and naming.
