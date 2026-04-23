# DESIGN_SYSTEM

For a macOS Markdown editor, "design system" usually means the platform itself.

Document:
- baseline: macOS Human Interface Guidelines (or chosen web UI kit for Tauri/Electron)
- typography: editor font vs. UI font vs. preview font, monospace choice
- spacing: toolbar, sidebar, editor padding, preview padding
- icon policy: SF Symbols vs. custom set
- color / theme: light + dark + accent color, syntax highlight palette
- split-pane and window-chrome conventions
- allowed extension patterns (when a native control is insufficient)
- anti-patterns (custom scrollbars, non-standard keybindings, unlabeled icons)

Consistency matters most in: menus and shortcuts, save / dirty indicators, find/replace, file-open/save dialogs, and focus rings.
