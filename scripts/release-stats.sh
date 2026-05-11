#!/usr/bin/env bash
# release-stats.sh — print current .dmg download counts per release.
#
# Usage:
#   scripts/release-stats.sh                # default repo (kunsumer/yeogi-md-editor)
#   REPO=other/repo scripts/release-stats.sh
#
# Requires: gh (GitHub CLI) authenticated.

set -euo pipefail

REPO="${REPO:-kunsumer/yeogi-md-editor}"

printf "%-10s  %s\n" "TAG" "DOWNLOADS"
printf "%-10s  %s\n" "----------" "---------"

total=0
while IFS=$'\t' read -r tag dl; do
  printf "%-10s  %s\n" "$tag" "$dl"
  total=$((total + dl))
done < <(
  gh api "repos/${REPO}/releases" --paginate \
    --jq '.[] | [.tag_name, ([.assets[] | select(.name | endswith(".dmg")) | .download_count] | add // 0)] | @tsv'
)

printf "%-10s  %s\n" "----------" "---------"
printf "%-10s  %s\n" "TOTAL" "$total"
