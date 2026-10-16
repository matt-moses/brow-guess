#!/usr/bin/env bash
# Brand guard: fail if third-party trademarks appear anywhere in the repo.
# Scans tracked + untracked-not-ignored files; skips the lockfile and this script.
# Also blocks earlier name candidates that turned out to belong to existing games.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

self="scripts/check-trademarks.sh"
pattern='heads ?-?up|warner|\bWB\b|\bellen\b|forehead ?-?frenzy|tilt ?(&|and|n|-) ?tell'

hits=$(
  git ls-files -co --exclude-standard -z \
    | grep -zvE "^(package-lock\.json|${self//./\\.})$" \
    | xargs -0 -r grep -InE -i -- "$pattern" 2>/dev/null || true
)

if [[ -n "$hits" ]]; then
  echo "brand check: FAILED — trademarked terms found:" >&2
  echo "$hits" >&2
  exit 1
fi

echo "brand check: OK"
