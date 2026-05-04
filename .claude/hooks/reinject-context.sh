#!/usr/bin/env bash
set -euo pipefail
cat <<'EOF'
Re-load these anchors after compaction:
- docs/claude-code/PROJECT_PROFILE.md
- docs/claude-code/UI_ARCHITECTURE.md
- docs/claude-code/DESIGN_SYSTEM.md
- docs/claude-code/UX_STATES.md
- docs/claude-code/specs/_active.md
- Preserve changed files, checks run, open risks, and any unresolved UX or accessibility issues.
EOF
