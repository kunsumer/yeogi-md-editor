#!/usr/bin/env bash
set -euo pipefail
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
PROTECTED_PATTERNS=(
  ".env"
  ".env."
  "secrets/"
  ".claude/settings.json"
  ".claude/hooks/"
)
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done
exit 0
