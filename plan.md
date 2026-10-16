# Execution Plan: Forehead Frenzy

Source: [`prd.md`](./prd.md). Target: a static PWA (vanilla TypeScript and Vite) deployed to GitHub Pages at `https://matt-moses.github.io/headsup/`.

## Ground rules (apply to every phase)

- **Dev host:** Raspberry Pi (aarch64), Node 22 (`.nvmrc` pins `22`, `engines` is `>=20`). Playwright runs **only in CI** (PRD §7.1).
- **One gate command:** Phase 0 adds `npm run verify`, which runs `lint && format:check && typecheck && test && build`. A phase is done only when `npm run verify` exits 0 **and** that phase's own checks pass. Every later phase extends `verify`. None may weaken it.
- **Git:** Commit straight to `main`, one or more conventional commits per phase. Never commit with `verify` failing.
- **Testability rule:** Keep game logic DOM-free and clock-injected (`now: () => number`). Device APIs live behind thin adapters that can be stubbed in jsdom. Then nearly all behaviour can be checked by Vitest on the Pi.
- **Scratch:** `$SCRATCH` means the session scratchpad dir. Temp files and binaries such as actionlint and PID files go there, never in the repo.
- **Phase completion record:** At the end of each phase, tick its checklist in this file and paste the final `verify` summary line under "Evidence".

## Dependency graph

```
P0 Scaffold ─┬─► P1 Game core ─┬─► P3 Device adapters ─┐
             │                 │                       ├─► P4 Screens & flow ─► P5 PWA ─► P6 CI/CD + E2E ─► P7 Acceptance
             └─► P2 Decks ─────┴───────────────────────┘
```

| Phase | Depends on | Can run in parallel with |
|---|---|---|
| P0 Scaffold & tooling | none | none |
| P1 Game core (pure) | P0 | P2 |
| P2 Decks & content guard | P0 | P1 |
| P3 Device adapters | P0, P1 (uses `normalizePitch`) | P2 |
| P4 Screens & game flow | P1, P2, P3 | none |
| P5 PWA, icons, base path | P4 | none |
| P6 CI/CD, Playwright, README | P5 | none |
| P7 Acceptance & hardening | P6 | none |

---

## Phase 0: Scaffold & tooling

**Depends on:** none.
**Delivers:** An empty but fully wired project. Every quality gate runs and passes.

### Tasks
- [x] `npm create vite@latest` (vanilla-ts) into the repo root, then trim the boilerplate.
- [x] Set TS `strict: true`, `noUncheckedIndexedAccess`, and `noImplicitOverride`. Add a `typecheck` script (`tsc --noEmit`).
- [x] Set `vite.config.ts` `base` from `process.env.BASE_PATH ?? '/'` (§7.3).
- [x] Add ESLint flat config with typescript-eslint (type-aware), plus Prettier and `eslint-config-prettier`.
- [x] Add Vitest with the `jsdom` environment available per file, `@vitest/coverage-v8`, and a `tests/` dir.
- [x] Add `package.json` scripts: `dev`, `build`, `preview`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `coverage`, and `verify`.
- [x] Add `.nvmrc` (`22`), `engines.node >=20`, `.gitignore`, and `.editorconfig`.
- [x] Create `src/config.ts` with `APP_NAME = 'Forehead Frenzy'`, `ROUND_SECONDS = 60`, `TILT_TRIGGER_DEG = 35`, `TILT_REARM_DEG = 15`, `TILT_COOLDOWN_MS = 500`, `FEEDBACK_MS = 600`, `READY_HOLD_MS = 1000`, `SENSOR_TIMEOUT_MS = 1500`, `FINAL_TICK_SECONDS = 10`, and `COUNTDOWN_FROM = 3`.
- [x] Add a `src/main.ts` stub that renders `APP_NAME`.
- [x] Add a sanity test `tests/config.test.ts` that checks the constants exist and are sane, for example `REARM < TRIGGER`.

### Check your work (autonomous)
```bash
npm ci && npm run verify                          # all gates green
BASE_PATH=/headsup/ npm run build && grep -q '/headsup/assets/' dist/index.html
npm run lint -- --max-warnings=0
```
**Done when:** All three commands exit 0 and the sanity test runs (Vitest reports ≥1 test).

**Evidence:** `Tests  5 passed (5)` (Test Files 2 passed) — verify green 2026-10-16

---

## Phase 1: Game core (pure, DOM-free)

**Depends on:** P0. **Parallel with:** P2.
**Delivers:** `src/game/shuffle.ts`, `src/game/tilt.ts`, `src/game/normalize.ts`, and `src/game/round.ts`, all fully unit-tested.

### Tasks
- [x] **`shuffle.ts`**: Fisher–Yates with an injectable RNG (`rng: () => number = Math.random`). Returns a new array and does not mutate its input.
- [x] **`normalize.ts`** (FR-4): `normalizePitch({beta, gamma, alpha}, screenAngle) → degrees`. Positive means screen toward the floor (correct) and negative means toward the ceiling (pass).
  - ⚠️ **Gotcha:** In landscape, a phone held upright puts `gamma` near ±90°, and `gamma` **wraps** from +90 to −90 right where the forehead pose sits. Do not use raw `gamma`. Instead, derive the gravity direction from the Euler angles (rotation matrix), then compute the pitch about the screen's long axis. This gives a continuous value across the vertical. Map `screenAngle` 90 (landscape-primary) and 270/−90 (landscape-secondary) to opposite signs. Portrait angles return `null`.
  - Also export `isUprightLandscape(sample, angle)` for the ready-hold check, with a tolerance constant in config.
- [x] **`tilt.ts`** (FR-6/7): `createTiltDetector(cfg)` takes `{ push(pitchDeg, tMs): TiltEvent | null, calibrate(neutralDeg), reset() }`.
  - Its states are `NEUTRAL → TRIGGERED(correct|pass) → COOLDOWN → NEUTRAL`.
  - It fires once when `|pitch − neutral| > trigger`. It re-arms only when `|Δ| < rearm` **and** `t − triggeredAt ≥ cooldown`.
  - It emits `{type:'correct'|'pass', t}` and also `{type:'rearmed', t}`, so the UI can gate "next word after return to neutral" (AC-2).
- [x] **`round.ts`**: `createRound({words, now, roundMs, rng})` takes `{start(), answer('correct'|'pass'), current(), remainingMs(), isOver(), pause(), resume(), results()}`.
  - The timer comes from `now()` deltas only (FR-9). Paused time is excluded (FR-10).
  - Exhaustion: when the queue empties, it reshuffles the passed words that are not yet re-shown. If there are none, the round ends early with reason `'exhausted'`.
  - `results()` returns the ordered `[{word, outcome}]` list and `score`.
  - The round guarantees no word is *answered correct* twice. Passed words may reappear only through the exhaustion path.

### Tests (`tests/game/*.test.ts`)
- [x] Shuffle: a permutation of the input (same multiset, no repeats) over 1,000 seeded runs; input not mutated; seeded RNG is deterministic.
- [x] Normalize: table tests for landscape-primary vs landscape-secondary giving opposite signs; continuity across the gamma ±90 wrap (sweep a synthetic pose from −60° to +60° pitch and assert monotonic output with no jumps >5° between steps); portrait gives `null`.
- [x] Tilt:
  - Fires at 36° and not at 34°.
  - The pass direction works.
  - Jitter around ±35° (for example 34/36/34/36…) fires **exactly once**.
  - No re-arm at 20° (outside hysteresis).
  - No re-arm before 500 ms, even when back at 0°.
  - Re-arms after both conditions are met.
  - Calibration offset is respected, for example neutral = 10° means a trigger at 46°.
  - Thresholds come from injected config.
- [x] Round:
  - Scoring.
  - Ordered results.
  - Timer accuracy with an irregular fake clock (big jumps, simulating dropped frames).
  - `isOver` at exactly 60 s.
  - Pause excludes elapsed time; resume continues.
  - Exhaustion with passes reshuffles them.
  - Exhaustion with all correct ends early.
  - `answer()` after the round is over is a no-op.

### Check your work (autonomous)
```bash
npm run verify
npx vitest run --coverage --coverage.include='src/game/**' \
  --coverage.thresholds.lines=95 --coverage.thresholds.branches=90
grep -rnE 'document|window|navigator' src/game && exit 1 || true   # purity guard
```
**Done when:** Verify is green, `src/game` coverage is ≥95% lines and ≥90% branches, and the purity grep finds nothing. Add the purity grep to `verify` as `npm run check:pure`.

**Evidence:** `tests/game` 71 passed; `src/game` coverage 100% lines/branches; check:pure green — 2026-10-16 (357ec3d)

---

## Phase 2: Decks & content guard

**Depends on:** P0. **Parallel with:** P1.
**Delivers:** 8 original decks of about 60 words each, a typed loader, schema validation, and a trademark guard.

### Tasks
- [x] `src/decks/types.ts`: the `Deck` interface, matching FR-2.
- [x] Write 8 JSON decks: `animals`, `food-drink`, `act-it-out`, `sports`, `jobs`, `places-landmarks`, `around-the-house`, and `kids-mix`. Each has about 60 original entries.
  - No living celebrities and no brands.
  - Entries should be short enough to read at 1–2 m.
- [x] `src/decks/index.ts`: `import.meta.glob('./*.json', { eager: true })` → `Deck[]`, in stable order. Bundling the decks into JS means the service worker precaches them automatically.
- [x] `tests/decks.test.ts` (FR-2):
  - Unique ids.
  - Every field present and well-typed.
  - `color` matches `/^#[0-9a-f]{6}$/i`.
  - ≥40 words per deck.
  - No duplicate words within a deck, case- and whitespace-insensitive.
  - No empty or whitespace-only entries.
  - Max entry length ≤ 28 chars, so autofit stays legible.
- [x] `scripts/check-trademarks.sh` (AC-7):
  - Greps the repo, excluding `node_modules`, `dist`, `.git`, `prd.md`, and `plan.md`, case-insensitively for `heads ?up`, `warner`, `\bWB\b`, and `ellen`.
  - Exits non-zero on a hit.
  - Allow-list the git remote/base-path references to the `headsup` slug only in deploy config, if needed.
  - Add it to `verify` as `npm run check:brand`.

### Check your work (autonomous)
```bash
npm run verify                     # now includes check:brand
npx vitest run tests/decks.test.ts
node -e "const d=require('fs').readdirSync('src/decks').filter(f=>f.endsWith('.json'));if(d.length<8)process.exit(1)"
```
**Done when:** All of these pass, with 8 decks of ≥40 (target about 60) unique words each and no brand hits.

**Evidence:** `tests/decks.test.ts` 60 passed; 8 decks × 60 words; brand guard fail/pass proven — 2026-10-16 (e87ad83)

---

## Phase 3: Device adapters

**Depends on:** P0 and P1 (`normalizePitch`). **Parallel with:** P2.
**Delivers:** `src/device/{orientation,wakelock,fullscreen,audio,haptics}.ts`. Each one uses feature detection, never throws, and is tested in jsdom with stubs.

### Tasks
- [x] **`orientation.ts`**:
  - `requestMotionPermission(): Promise<'granted'|'denied'|'not-required'>` (FR-15). It must be called synchronously at the start of the gesture handler, with no `await` before it.
  - `subscribePitch(cb, {getAngle}) → unsubscribe` normalizes each event through P1.
  - `getScreenAngle()` uses `screen.orientation.angle`, then falls back to `window.orientation`, then to `matchMedia('(orientation: landscape)')`.
  - `watchForSensor(timeoutMs) → Promise<boolean>` (FR-16).
- [x] **`wakelock.ts`** (FR-11): `acquire()` and `release()`. It auto-re-acquires on `visibilitychange → visible` while a flag says it is wanted. It is silent when unsupported.
- [x] **`fullscreen.ts`** (FR-12): `enter()`, `exit()`, and `lockLandscape()`. Each is wrapped in try/catch, with vendor-prefix fallbacks for `webkitRequestFullscreen`.
- [x] **`audio.ts`** (FR-14):
  - `unlockAudio()` creates or resumes the `AudioContext`. It must be called inside the gesture.
  - `play('tick'|'correct'|'pass'|'buzzer'|'countdown')` synthesizes each sound with oscillators and gain envelopes.
  - It does nothing if no AudioContext exists.
- [x] **`haptics.ts`** (FR-13): `pulse(pattern)` uses `navigator.vibrate?.()`.
- [x] A shared `tests/helpers/fakeDevice.ts` provides:
  - Installable stubs for `DeviceOrientationEvent.requestPermission`, `screen.orientation`, `navigator.wakeLock`, `AudioContext`, `vibrate`, and `requestFullscreen`.
  - A `dispatchOrientation({beta,gamma,alpha})` helper.
  - This file is reused by P4.

### Tests (`tests/device/*.test.ts`, jsdom)
- [x] Permission: granted, denied, a thrown error (maps to denied), and the method absent (maps to `not-required`).
- [x] `subscribePitch`: a dispatched event reaches the callback with the normalized value; the sign flips when the angle stub changes 90 to 270; unsubscribe stops delivery.
- [x] `watchForSensor`: resolves `false` after the timeout with fake timers; resolves `true` when an event arrives first.
- [x] Wake lock: acquire calls the stub; a visibility change re-acquires; release prevents re-acquire; a missing API does not throw.
- [x] Fullscreen and orientation lock: rejections are swallowed; missing APIs are fine.
- [x] Audio: `play` before unlock is a no-op; after unlock it creates oscillator nodes on the stub; missing AudioContext is fine.
- [x] Haptics: calls `vibrate` when present; no throw when absent.

### Check your work (autonomous)
```bash
npm run verify
npx vitest run tests/device --coverage --coverage.include='src/device/**' --coverage.thresholds.lines=85
```
**Done when:** Verify is green and device coverage is ≥85% lines.

**Evidence:** `vitest run tests/device`: 6 files, 60 tests passed; `src/device/**` coverage 96.85% lines (91.04% branches); full verify green (13 files, 196 tests) — 2026-10-16

---

## Phase 4: Screens & full game flow

**Depends on:** P1, P2, and P3.
**Delivers:** A playable app in the browser. All screens are wired through an in-memory router with no History API (§7.4). The whole user flow from PRD §5 is covered by jsdom integration tests.

### Tasks
- [x] **`src/router.ts`**: `show(screen, props)`. Each screen is `{mount(root, props, ctx) → cleanup}`. The router guarantees the previous screen's cleanup runs, which removes listeners, timers, and RAF loops.
- [x] **`src/app.ts`**: a controller that owns the game session and wires the device adapters to the screens. Dependencies are injected so tests can pass fakes.
- [x] **Screens** (`src/screens/`):
  - [x] `home`: a deck grid of `<button>` cards with emoji, title, and description, using `aria-label` and a deck colour. It remembers the last deck in `localStorage`, wrapped in try/catch. The tap handler runs, in this order and **synchronously first**: `requestMotionPermission()`, `unlockAudio()`, `enter()` fullscreen, `lockLandscape()`, and `wakelock.acquire()`.
  - [x] `permission`: the denied path, with iOS reload instructions plus the Settings path for older iOS.
  - [x] `unsupported`: "Motion sensors not available — play on a phone" (FR-16), with a Back button.
  - [x] `ready`: "Place on forehead". It shows a rotate-device overlay in portrait and advances after `READY_HOLD_MS` in upright landscape.
  - [x] `countdown`: 3‑2‑1 with a beep and pulse on each tick. It averages pitch samples over the final ~500 ms, then calls `calibrate()`.
  - [x] `round`:
    - The word is large and centered, with the timer in a corner.
    - A RAF loop reads `remainingMs()`.
    - Tilt events show a green "Correct!" or orange "Pass" overlay for `FEEDBACK_MS`, with sound and vibration.
    - The next word appears only after **both** the feedback has elapsed **and** a `rearmed` event has arrived.
    - The final 10 s tick once per second.
    - Time's up plays the buzzer, releases the wake lock, exits fullscreen, and shows results.
    - A Quit button in the top-left asks for confirmation and returns home.
    - On `visibilitychange` hidden, the round pauses and shows "Paused — tap to resume". Tapping re-runs the countdown and recalibrates (FR-10).
  - [x] `results`: the score, then an ordered list with ✓ in green or ✗ dimmed, plus **Play again** (same deck, new shuffle) and **Choose deck**.
- [x] **`src/ui/autofit.ts`** (FR-21): binary-search the font size so the text fits its container. Measurement is injected, so it can be tested.
- [x] **CSS**:
  - Custom properties for the theme.
  - A system display font stack, with no CDN.
  - High contrast.
  - `@media (prefers-reduced-motion: reduce)` disables the flash animations (FR-23).
  - Visible focus rings.
- [x] **Dev-only sensor simulator**: when `?sim` is in the URL in dev, keyboard arrows dispatch synthetic orientation events. This makes manual desktop checks possible and is tree-shaken from prod by `import.meta.env.DEV`.

### Tests
- [x] `tests/ui/autofit.test.ts`: a long entry gets a smaller size than a short one; the result is always within [min, max].
- [x] `tests/flow/*.test.ts` (jsdom, fake timers plus fake clock, `fakeDevice` helper):
  - [x] **Happy path**:
    - Tap the deck.
    - Hold landscape for 1 s.
    - Count down.
    - Tilt down to 50°, which shows the Correct overlay.
    - Return to 0 and wait 600 ms, which brings the next word.
    - Tilt up to −50°, which shows the Pass overlay.
    - Advance the clock to 60 s, which shows results with `1` correct, one ✓, and one ✗, in order.
  - [x] No next word while the phone is still tilted, even after 600 ms (AC-2).
  - [x] Jitter at the threshold registers one answer only.
  - [x] iOS denied leads to the permission screen. No events within 1.5 s leads to the unsupported screen.
  - [x] Portrait shows the rotate overlay and the countdown does not start.
  - [x] Visibility hidden mid-round pauses and stops the timer; resume re-runs the countdown and the remaining time is preserved.
  - [x] Quit, then confirm, returns home and all listeners are removed. Verify this by spying on `removeEventListener` counts and checking no RAF or timers remain.
  - [x] Play again uses the same deck with a different order (seeded RNG). Choose deck returns home.
  - [x] Wake lock is acquired at round start and released at time's up. The gesture handler calls `requestPermission` before any `await`.
  - [x] Accessibility: every deck card is a `button` with an accessible name and can be focused by tabbing.

### Check your work (autonomous)
```bash
npm run verify
npx vitest run tests/flow tests/ui
npm run build && (npx vite preview --port 4173 --strictPort & echo $! > "$SCRATCH/preview.pid") \
  && sleep 2 && curl -sf http://localhost:4173/ | grep -q 'Forehead Frenzy'; kill $(cat "$SCRATCH/preview.pid")
```
**Done when:** Verify is green, every flow test passes, and the preview serves the app shell.

**Evidence:** `vitest run tests/flow tests/ui`: 6 files, 31 tests passed (flow: happy path, gating/jitter, permission/sensor/portrait, pause/resume, quit leak check, play again/choose deck, a11y; ui: autofit); full verify green (20 files, 229 tests); `dist/` has no simulator code; preview serves the shell — 2026-10-16

---

## Phase 5: PWA, icons, base path

**Depends on:** P4.
**Delivers:** An installable, offline-capable build that is correct under `/headsup/`, with an update toast.

### Tasks
- [ ] Add `assets/logo.svg` and `assets/icon.svg` with original artwork, such as a stylised forehead and card.
- [ ] Add `@vite-pwa/assets-generator`, or `sharp` in a `scripts/gen-icons.mjs`, to produce `public/icons/` with 192, 512, maskable-512, `apple-touch-icon-180`, and a favicon. Generated PNGs are committed, so CI doesn't need native deps. Add a `gen:icons` script.
- [ ] Configure `vite-plugin-pwa` (FR-17/18/19):
  - `registerType: 'prompt'` and `strategies: 'generateSW'`.
  - `globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}']`.
  - The manifest:
    - `name`/`short_name` from `APP_NAME`
    - `display: 'fullscreen'` with `display_override: ['fullscreen','standalone']`
    - `orientation: 'landscape'`
    - `theme_color`/`background_color`
    - `start_url` and `scope` set to `base`
    - `icons` including `purpose: 'maskable'`
- [ ] Add `<meta>` tags for iOS: `apple-mobile-web-app-capable`, status bar, apple-touch-icon, and `viewport-fit=cover`. All URLs go through `import.meta.env.BASE_URL` (§7.3).
- [ ] Add `src/pwa.ts`, which uses `virtual:pwa-register` to show a "Update available — reload" toast with an accessible button that calls `updateSW(true)`.
- [ ] Add `scripts/check-dist.mjs` (wired into `verify` after `build` as `check:dist`). It asserts:
  - The manifest exists and parses, with `start_url` and `scope` equal to `BASE_PATH`, `display` set to `fullscreen`, `orientation` set to `landscape`, and the 192, 512, and maskable icons listed, with the files present in `dist/`.
  - The PNG dimensions match the declared sizes, read from the IHDR header with no deps.
  - `sw.js` exists and its precache manifest lists `index.html`, every `dist/assets/*.js|css`, and the icons.
  - `index.html` references only same-origin, base-prefixed URLs: no `http(s)://` and no CDN fonts (§7.5, FR-21).
  - It finds no `fetch(` and no `XMLHttpRequest` to external origins in `dist/assets/*.js`, apart from Workbox internals (§7.5).

### Check your work (autonomous)
```bash
npm run verify                                       # includes check:dist for BASE_PATH=/
BASE_PATH=/headsup/ npm run build && BASE_PATH=/headsup/ node scripts/check-dist.mjs
# serve under the sub-path and fetch the key assets
BASE_PATH=/headsup/ npx vite preview --port 4173 --strictPort &
sleep 2
for p in '' manifest.webmanifest sw.js icons/icon-192.png; do curl -sf "http://localhost:4173/headsup/$p" >/dev/null || echo "FAIL $p"; done
kill %1
```
**Done when:** `check-dist` passes for both `/` and `/headsup/`, and every curl succeeds with no `FAIL` lines. The offline behaviour itself is checked in CI by Playwright in P6.

---

## Phase 6: CI/CD, Playwright smoke, README

**Depends on:** P5.
**Delivers:** `.github/workflows/deploy.yml`, `e2e/smoke.spec.ts`, `playwright.config.ts`, and `README.md`, plus a live deployment.

### Tasks
- [ ] Add `@playwright/test` as a devDependency. Add a `test:e2e` script that runs only in CI or on demand; it is not part of `verify`.
- [ ] `playwright.config.ts`:
  - Project `mobile-landscape`: a Pixel 7 profile with a landscape viewport, `hasTouch`, and `isMobile`.
  - `webServer`: `npm run preview -- --port 4173 --strictPort` with `BASE_PATH=/headsup/`, so the real sub-path is exercised.
- [ ] `e2e/smoke.spec.ts` (PRD §8):
  - Use `addInitScript` to stub `DeviceOrientationEvent.requestPermission → 'granted'` and `screen.orientation` (angle 90). Expose a `window.__tilt(beta,gamma,alpha)` that dispatches a `DeviceOrientationEvent`.
  - Call `page.clock.install()`.
  - Pick a deck, hold neutral, and run the clock through the hold and the countdown.
  - Tilt down, then return to neutral and run the clock 700 ms.
  - Tilt up, then return to neutral.
  - `page.clock.runFor(61_000)`.
  - Assert the results show score `1`, with one ✓ row and one ✗ row.
- [ ] `e2e/offline.spec.ts` (AC-5):
  - Load the app, then wait for `navigator.serviceWorker.ready` and SW control (reload once).
  - `context.setOffline(true)`, then reload.
  - Assert the deck grid renders and a deck can be started.
- [ ] `.github/workflows/deploy.yml` (§8):
  - Triggers: `push: main`, `pull_request`, and `workflow_dispatch`.
  - Concurrency group `pages`.
  - **check job**:
    - `actions/setup-node` with `node-version-file: .nvmrc` and the npm cache.
    - Steps, each as a separate step for readable failures: `npm ci`, `lint`, `format:check`, `typecheck`, `test`, `check:brand`.
    - `npm run build` with `BASE_PATH=/${{ github.event.repository.name }}/`.
    - `check:dist`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`.
    - Upload the Playwright report on failure.
  - **deploy job**:
    - `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'` and `needs: check`.
    - Permissions `pages: write` and `id-token: write`, with environment `github-pages`.
    - `configure-pages`, then `upload-pages-artifact` (`dist/`), then `deploy-pages`.
    - The build is done once in `check` and uploaded there, so deploy ships the exact tested artifact.
- [ ] Lint the workflow locally with `actionlint`. It is a single static binary with an arm64 release, downloaded to the scratchpad.
- [ ] `README.md` (AC-8):
  - Local dev, including `npm run dev -- --host` for LAN testing.
  - The iOS motion-sensor HTTPS caveat, with the `@vitejs/plugin-basic-ssl` or tunnel options.
  - The `?sim` desktop simulator.
  - Scripts reference.
  - Pages setup: Settings → Pages → Source: GitHub Actions.
  - The private-repo and paid-plan caveat.
  - `BASE_PATH` and the repo-rename note.
  - The manual QA checklist from PRD §9.
- [ ] Push to `main`.

### ⚠️ Blockers that need the user (flag, don't work around)
1. **The repo is private.** Pages needs a paid plan, or the repo must be made public (PRD §11). Check with `gh api repos/matt-moses/headsup --jq .private` and `gh api user --jq .plan.name`. Ask the user before changing visibility.
2. **The Pages source must be "GitHub Actions".** This can be done with `gh api -X POST repos/matt-moses/headsup/pages -f build_type=workflow`, but only with user approval.
3. The PRD lists the remote as `git@github.com:…`, while the current `origin` is HTTPS. Either works; use whichever authenticates.

### Check your work (autonomous)
```bash
npm run verify
"$SCRATCH/actionlint" .github/workflows/deploy.yml
git push origin main
gh run watch "$(gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
curl -sf https://matt-moses.github.io/headsup/ | grep -q 'Forehead Frenzy'
curl -sf https://matt-moses.github.io/headsup/manifest.webmanifest | grep -q '"start_url": *"/headsup/"'
# PR path: open a throwaway PR and confirm check runs while deploy is skipped
gh pr create --draft --title 'ci: PR check dry-run' --body '...' && gh pr checks --watch
```
**Done when:**
- The `check` and `deploy` jobs are green on `main`, including both Playwright specs.
- The live URL serves the app and the manifest.
- A PR run shows `check` passing and `deploy` skipped.

If a CI-only Playwright failure occurs, download the report artifact with `gh run download`, fix it, and push again. Repeat until green.

---

## Phase 7: Acceptance & hardening

**Depends on:** P6.
**Delivers:** Proof against every acceptance criterion in PRD §10, plus a short list of things only a human with a phone can confirm.

### Tasks
- [ ] Add `scripts/acceptance.sh`, which runs the automatable criteria and prints a PASS/FAIL table:

  | AC | Automated check |
  |---|---|
  | 1 full round | Playwright smoke (CI) and jsdom happy-path flow |
  | 2 single-fire and neutral gating | tilt unit tests, and the flow tests "no next word while tilted" and "jitter" |
  | 3 wake lock | flow test asserts acquire and release; device test asserts re-acquire |
  | 4 results and buttons | flow tests for Play again and Choose deck |
  | 5 offline and installable | `e2e/offline.spec.ts` and `check-dist` (manifest fields, icons, SW precache) |
  | 6 CI gates and deploy | the latest `main` run is green via `gh run list --json conclusion`, and the PR run skipped deploy |
  | 7 no WB or "Heads Up!" content | `check:brand` |
  | 8 README sections | grep the README for the required headings: dev `--host`, HTTPS caveat, Pages setup, QA checklist |

- [ ] Run Lighthouse (PWA and accessibility categories) **in CI** against the preview as an optional, non-blocking job. Record the scores in the README.
- [ ] Do a cleanup pass:
  - No `console.log` in `src`, enforced by the ESLint rule.
  - Bundle size sanity: print it in `check-dist` and warn if it is over 150 KB gzip.
- [ ] Write `docs/manual-qa.md`, a copy of the README checklist with result columns. Hand it to the user for the real-device items:
  - Android Chrome, in the browser and as an installed PWA.
  - iOS Safari, including the permission prompt and the denied path.
  - Airplane mode.
  - Screen awake for 60 s.
  - Both landscape orientations.
  - Sensitivity feel at 35°/15°. Tune the constants in `config.ts` if needed.

### Check your work (autonomous)
```bash
npm run verify && ./scripts/acceptance.sh      # all rows PASS; exits non-zero otherwise
```
**Done when:** `acceptance.sh` exits 0, CI on `main` is green, and the manual QA doc has been sent to the user. Real-device sign-off is the only remaining human step.

---

## Out of scope (per PRD §3/§12)
TWA/Play Store, custom decks and import, tap-to-answer, a settings screen, team mode, analytics, localization, and video. The constants in `config.ts` keep the future settings cheap to add.
