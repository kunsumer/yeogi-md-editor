# UI_ARCHITECTURE

Describe, once the stack is chosen:
- window / scene composition (single-window, multi-window, document-based)
- primary layout (sidebar / editor / preview split, tabs, toolbar)
- state ownership (document model, editor state, app-level state)
- file I/O boundary (who reads, who writes, who watches)
- error boundary / crash handling
- command routing (menu bar, shortcuts, command palette)
- undo / redo ownership
- dirty-state tracking and autosave rules

## Module map
Define the concrete directory layout in this file once the stack is chosen.
Keep a clear boundary between:
- document model / file I/O
- editor view
- preview / rendering
- chrome (windows, sidebar, toolbar, menus)
- persistence (recent files, bookmarks, preferences)
