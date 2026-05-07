# CLAUDE.md — Repository Operating Contract

This repository builds a **macOS desktop application for reading and editing Markdown (`.md`) files**.

## Mission
Ship a focused, reliable Markdown editor with:
- clear file and editor states (empty, loading, dirty, error, saved)
- strong keyboard + VoiceOver accessibility
- consistent use of the chosen UI framework's native idioms
- responsive behavior on large files
- small, verified changes

## Working mode
- Repository type: macOS desktop app (native or webview-wrapped)
- Stack is defined in `docs/claude-code/PROJECT_PROFILE.md`
- Risk profile: medium by default; high for anything involving file I/O, unsaved changes, destructive file operations, or accessibility regressions
- Source of truth: repo files and the active spec

## Read order
1. `CLAUDE.md`
2. `docs/claude-code/PROJECT_PROFILE.md`
3. `docs/claude-code/UI_ARCHITECTURE.md`
4. `docs/claude-code/DESIGN_SYSTEM.md`
5. `docs/claude-code/UX_STATES.md`
6. `docs/claude-code/specs/_active.md`
7. only then the bounded working set

## Non-negotiables
1. Never lose user edits. Unsaved-change handling is part of correctness.
2. Accessibility (keyboard, focus, labels, VoiceOver, Dynamic Type) is correctness, not polish.
3. Empty, loading, error, dirty, and saved states must be explicit.
4. Prefer the chosen framework's native controls; custom widgets require justification.
5. Do not guess project commands if `PROJECT_PROFILE.md` defines them.
6. Never claim checks passed unless they were actually run.
7. Never read or print secrets or `.env` contents.

## Verification contract
Report:
1. files changed
2. commands run
3. tests / verification performed
4. UX, accessibility, or data-safety risks
5. rollback or recovery note when relevant

## Imports
@docs/claude-code/PROJECT_PROFILE.md
@docs/claude-code/CONTEXT_MAP.md
@docs/claude-code/UI_ARCHITECTURE.md
@docs/claude-code/DESIGN_SYSTEM.md
@docs/claude-code/UX_STATES.md
@docs/claude-code/PERFORMANCE.md
@docs/claude-code/GOVERNANCE.md
@docs/claude-code/specs/_active.md
