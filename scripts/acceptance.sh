#!/usr/bin/env bash
# Runs the automatable acceptance criteria (PRD §10) and prints a table.
# Exit non-zero on any FAIL. PENDING (needs CI / network) does not fail.
#
#   npm run acceptance                 # e2e parts marked "CI"
#   ACCEPTANCE_E2E=1 npm run acceptance  # also runs the Playwright specs locally
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

BASE_PATH="${BASE_PATH:-/brow-guess/}"
export BASE_PATH
E2E="${ACCEPTANCE_E2E:-0}"
LOGDIR="$(mktemp -d "${TMPDIR:-/tmp}/acceptance.XXXXXX")"

ROWS=()
FAILED=0
PENDING=0

# run <logname> <cmd...> — returns the command's exit code, output to a log.
run() {
  local name="$1"
  shift
  "$@" >"$LOGDIR/$name.log" 2>&1
}

# record <AC> <status> <detail>
record() {
  ROWS+=("$1|$2|$3")
  case "$2" in
    FAIL) FAILED=1 ;;
    PENDING) PENDING=1 ;;
  esac
}

# check <AC> <label> <logname> <cmd...>
check() {
  local ac="$1" label="$2" name="$3"
  shift 3
  if run "$name" "$@"; then
    record "$ac" PASS "$label"
  else
    record "$ac" FAIL "$label (log: $LOGDIR/$name.log)"
  fi
}

echo "Running acceptance checks (logs in $LOGDIR)..."

# AC1 — full round
check AC1 "jsdom happy-path flow" ac1-flow npx vitest run tests/flow/happy.test.ts
if [ "$E2E" = "1" ]; then
  if run ac1-build npm run build; then
    check AC1 "Playwright smoke" ac1-e2e npx playwright test e2e/smoke.spec.ts
  else
    record AC1 FAIL "build for smoke (log: $LOGDIR/ac1-build.log)"
  fi
else
  record AC1 CI "Playwright smoke (set ACCEPTANCE_E2E=1 to run locally)"
fi

# AC2 — single fire + neutral gating
check AC2 "tilt unit + gating flow tests" ac2 \
  npx vitest run tests/game/tilt.test.ts tests/flow/gating.test.ts

# AC3 — wake lock
check AC3 "wake lock device + happy/pause flow tests" ac3 \
  npx vitest run tests/device/wakelock.test.ts tests/flow/happy.test.ts tests/flow/pause-quit.test.ts

# AC4 — results + buttons
check AC4 "results, Play again, Choose deck flow tests" ac4 \
  npx vitest run tests/flow/results-home.test.ts

# AC5 — offline + installable
if run ac5-build npm run build; then
  check AC5 "check-dist (manifest, icons, SW precache) @ $BASE_PATH" ac5-dist node scripts/check-dist.mjs
  if [ "$E2E" = "1" ]; then
    check AC5 "Playwright offline" ac5-e2e npx playwright test e2e/offline.spec.ts
  else
    record AC5 CI "Playwright offline (set ACCEPTANCE_E2E=1 to run locally)"
  fi
else
  record AC5 FAIL "build @ $BASE_PATH (log: $LOGDIR/ac5-build.log)"
fi

# AC6 — CI gates + deploy (needs gh with access to the repo)
slug="$(git remote get-url origin 2>/dev/null | sed -E 's#^(https://[^/]+/|git@[^:]+:)##; s#\.git$##')"
if [ -z "$slug" ]; then
  record AC6 PENDING "no origin remote; cannot query CI"
elif ! command -v gh >/dev/null 2>&1; then
  record AC6 PENDING "gh not installed; check latest main run of deploy.yml on $slug"
else
  concl="$(gh run list -R "$slug" --workflow deploy.yml --branch main --limit 1 \
    --json conclusion -q '.[0].conclusion' 2>"$LOGDIR/ac6.log")"
  rc=$?
  if [ $rc -ne 0 ] || [ -z "$concl" ]; then
    record AC6 PENDING "gh unavailable or no runs for $slug (log: $LOGDIR/ac6.log)"
  elif [ "$concl" = "success" ]; then
    record AC6 PASS "latest main deploy.yml run on $slug: success"
  else
    record AC6 FAIL "latest main deploy.yml run on $slug: $concl"
  fi
fi

# AC7 — no third-party brand content
check AC7 "check:brand" ac7 npm run check:brand

# AC8 — README sections
readme_missing=()
grep -qF -- 'npm run dev -- --host' README.md || readme_missing+=("dev --host")
grep -qiE 'HTTPS' README.md && grep -qiE 'motion|deviceorientation' README.md && grep -qiE 'iOS' README.md ||
  readme_missing+=("HTTPS motion/iOS caveat")
grep -qF 'GitHub Actions' README.md && grep -qiE 'Settings.*Pages' README.md ||
  readme_missing+=("Pages source = GitHub Actions")
grep -qiE '^#+ .*QA checklist' README.md || readme_missing+=("QA checklist heading")
if [ ${#readme_missing[@]} -eq 0 ]; then
  record AC8 PASS "README: dev --host, HTTPS caveat, Pages setup, QA checklist"
else
  record AC8 FAIL "README missing: ${readme_missing[*]}"
fi

echo
printf '%-4s  %-7s  %s\n' "AC" "Result" "Check"
printf '%-4s  %-7s  %s\n' "----" "-------" "-----"
for row in "${ROWS[@]}"; do
  IFS='|' read -r ac st detail <<<"$row"
  printf '%-4s  %-7s  %s\n' "$ac" "$st" "$detail"
done
echo

if [ $PENDING -eq 1 ]; then
  echo "NOTE: PENDING rows need CI or GitHub access and do not fail this script."
fi
if [ $FAILED -eq 1 ]; then
  echo "acceptance: FAIL"
  exit 1
fi
echo "acceptance: OK (no FAIL rows)"
