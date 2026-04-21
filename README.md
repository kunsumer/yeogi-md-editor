# Markdown Editor — macOS

A focused Claude Code scaffold for building a small, reliable **macOS desktop application to read and edit `.md` files**.

Stack is intentionally undecided at this level of the scaffold. The operating contract, rules, agents, commands, hooks, and spec layout apply whether you build with:
- Swift / SwiftUI (native)
- Tauri (Rust + webview)
- Electron (Node + webview)

## First setup
1. Fill in `docs/claude-code/PROJECT_PROFILE.md` once a stack is chosen.
2. Replace the placeholder CI with real install / lint / typecheck / test / build steps for that stack.
3. Add the first spec under `docs/claude-code/specs/<feature>/` using `_template/` and point `specs/_active.md` at it.
4. Run `/plan-ui-change` before coding anything user-visible.
