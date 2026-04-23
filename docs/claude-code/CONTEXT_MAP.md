# CONTEXT_MAP

## Mandatory read order
1. `CLAUDE.md`
2. `docs/claude-code/PROJECT_PROFILE.md`
3. `docs/claude-code/UI_ARCHITECTURE.md`
4. `docs/claude-code/DESIGN_SYSTEM.md`
5. `docs/claude-code/UX_STATES.md`
6. `docs/claude-code/specs/_active.md`
7. active feature spec folder
8. only then the bounded working set

## High-value locations
- `.claude/settings.json` — permissions and hook wiring
- `.claude/rules/` — operating rules loaded as context
- `.claude/commands/` — slash commands for planning, implementing, reviewing, verifying
- `.claude/agents/` — specialized reviewers
- `.claude/hooks/` — pre/post guards
- `docs/claude-code/` — operating docs
- `docs/claude-code/specs/` — per-feature specs
