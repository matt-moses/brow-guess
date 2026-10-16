#!/usr/bin/env bash
# Purity guard (plan Phase 1): game logic must stay DOM-free so it runs under
# plain Node in Vitest. Fails if any browser global is referenced in the target
# directory (default: src/game). Usage: scripts/check-pure.sh [dir]
set -euo pipefail

dir="${1:-src/game}"
pattern='document|window|navigator|localStorage|requestAnimationFrame'

if [[ ! -d "$dir" ]]; then
  echo "check:pure: directory not found: $dir" >&2
  exit 2
fi

if grep -rnE "$pattern" "$dir"; then
  echo "check:pure: FAILED: browser globals referenced in $dir (see above)" >&2
  exit 1
fi

echo "check:pure: OK ($dir is DOM-free)"
