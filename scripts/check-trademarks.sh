#!/usr/bin/env bash
# Brand guard (PRD AC-7): fail if third-party trademarks appear anywhere in the repo.
# Scans tracked + untracked-not-ignored files; skips the PRD/plan (which name the
# references on purpose), the lockfile, and this script. References to the repo slug
# itself (git remote / GitHub Pages base path) are allow-listed.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

self="scripts/check-trademarks.sh"
pattern='heads ?-?up|warner|\bWB\b|\bellen\b'
allow='matt-moses/headsup|/headsup/|headsup\.git'

hits=$(
  git ls-files -co --exclude-standard -z \
    | grep -zvE "^(prd\.md|plan\.md|package-lock\.json|${self//./\\.})$" \
    | xargs -0 -r grep -InE -i -- "$pattern" 2>/dev/null \
    | grep -viE -- "$allow" || true
)

if [[ -n "$hits" ]]; then
  echo "brand check: FAILED — trademarked terms found:" >&2
  echo "$hits" >&2
  exit 1
fi

echo "brand check: OK"
