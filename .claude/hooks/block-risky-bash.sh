#!/usr/bin/env bash
set -euo pipefail
INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
deny_patterns=(
  "rm -rf /"
  "rm -rf ."
  "git push --force"
  "git reset --hard"
)
for pattern in "${deny_patterns[@]}"; do
  if [[ "$COMMAND" == *"$pattern"* ]]; then
    echo "Blocked risky bash command: $pattern" >&2
    exit 2
  fi
done
exit 0
