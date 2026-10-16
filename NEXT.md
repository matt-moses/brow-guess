# NEXT: Resume Brow Guess in a new container

Handoff written 2026-10-16 just before the old dev container was destroyed. It tells the next session where things stand and what's left.

## TL;DR

- **App:** **Brow Guess**, a phone-on-forehead party guessing game. It is a static, offline-capable PWA built with vanilla TS and Vite. Tilt down means _correct_ and tilt up means _pass_.
- **Specs:** [`prd.md`](./prd.md) is the PRD and [`plan.md`](./plan.md) is the phased execution plan. The plan's checkboxes and Evidence lines show what's done.
- **Phases 0–5 are complete. Phases 6–7 are complete locally;** only the parts that need a push or CI remain.
- **Not yet pushed:** every commit after `ee9daca` (Phase 3) was made **locally only**, because pushing was blocked (see Blockers). If those commits aren't on GitHub yet, restore them from the git bundle first.

## 1. Get the code

Check whether GitHub already has the work:

```bash
git clone https://github.com/matt-moses/brow-guess.git && cd brow-guess
git log --oneline -1   # pushed work ends with "docs: add NEXT.md handoff"; ee9daca means the local work is missing
```

If it's missing, restore it from the bundle the user saved (`brow-guess.bundle`):

```bash
git clone brow-guess.bundle brow-guess && cd brow-guess
git remote set-url origin https://github.com/matt-moses/brow-guess.git
git log --oneline | head -15
```

## 2. Blockers that need the user

| #   | Blocker                                                                                                                                                                                                  | Fix                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Push auth.** The Claude GitHub App wasn't installed on the renamed repo `matt-moses/brow-guess`, so the error was `GitHub token provider unavailable: GitHub App is not installed on this repository`. | The user adds the repo under GitHub → Settings → Applications → Installed GitHub Apps → Claude → Configure → Repository access. Test it with `git push --dry-run origin main`.                         |
| 2   | **Pages source.**                                                                                                                                                                                        | Settings → Pages → Source: **GitHub Actions**. Do this once, before or after the first push. Only with the user's approval: `gh api -X POST repos/matt-moses/brow-guess/pages -f build_type=workflow`. |

The repo is already **public**, so Pages works on the Free plan.

## 3. Verify the local state (do this first)

```bash
nvm use || true          # Node 22 (.nvmrc); engines >=20
npm ci
npm run verify           # lint, format:check, typecheck, check:pure, check:brand, vitest, build, check:dist
npm run acceptance       # AC table; AC6 (CI) shows PENDING until the first green CI run
```

Expected: verify is green with about 235 Vitest tests, and acceptance shows every row PASS except AC6 PENDING.

## 4. Remaining work (in order)

1. **Push** `main` once blocker 1 is cleared: `git push origin main`.
2. **Watch CI**:
   `gh run watch "$(gh run list --workflow deploy.yml --branch main --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status`
   - If a Playwright step fails, run `gh run download <id> -n playwright-report`, fix the problem, and push again.
   - If an action tag doesn't resolve (`checkout@v5`, `setup-node@v5`, `upload-pages-artifact@v4`), drop it one major version.
3. **Check the live site**:
   ```bash
   curl -sf https://matt-moses.github.io/brow-guess/ | grep -q 'Brow Guess'
   curl -sf https://matt-moses.github.io/brow-guess/manifest.webmanifest | grep -q '"start_url": *"/brow-guess/"'
   ```
4. **Dry-run a PR**: open a throwaway draft PR and confirm `check` runs while `deploy` is skipped. Then close the PR.
5. **Lighthouse**: download the non-blocking `lighthouse` job's artifact and record the scores in the README.
6. **Re-run** `npm run acceptance`. AC6 should now be PASS.
7. **Tick the remaining boxes** in Phase 6 ("Push to `main`") and Phase 7 of `plan.md`, and update their Evidence lines.
8. **Hand real-device QA to the user**: send [`docs/manual-qa.md`](./docs/manual-qa.md) along with the live URL. Tune `TILT_*` in `src/config.ts` if the tilt doesn't feel right.

## 5. Conventions and decisions (don't re-litigate)

- **Git:** commit straight to `main`; no feature branches. Use conventional commits. Every commit ends with the `Co-Authored-By` / `Claude-Session` trailers the harness supplies.
- **Gate:** never commit with `npm run verify` failing, and never weaken `verify`.
- **Name:** the app name is **Brow Guess** and lives only in `APP_NAME` in `src/config.ts`. `index.html` gets it through `%APP_NAME%` placeholders.
  - Two earlier candidate names were rejected because existing games already use them (see `prd.md` §11).
  - `scripts/check-trademarks.sh` (`check:brand`) blocks those names along with third-party trademarks. `prd.md` and `plan.md` are excluded from that check, but this file is scanned, so don't write those names here.
- **Base path:** comes from the `BASE_PATH` env var (default `/`). CI sets it to `/${{ github.event.repository.name }}/`, which is `/brow-guess/`.
- **Pitch sign convention** (`src/game/normalize.ts`):
  - 0 means the phone is vertical in landscape, with the screen facing the group.
  - Positive means the screen is tilting toward the floor, which counts as _correct_. Negative means it's tilting toward the ceiling, which counts as _pass_.
  - Pitch is computed from the gravity vector, **not raw gamma**, because gamma wraps at ±90° exactly at the forehead pose.
- **Tilt detector** (`src/game/tilt.ts`):
  - It triggers past ±35°.
  - It re-arms only within ±15° **and** after 500 ms; at that point it emits `rearmed`.
  - The next word waits for both `FEEDBACK_MS` and `rearmed`.
  - `reset()` also clears calibration.
- **Testability:**
  - `src/game` is pure, enforced by `check:pure`.
  - Device adapters read globals lazily. `tests/helpers/fakeDevice.ts` stubs every device API.
  - `createApp(root, deps)` takes its clock, raf, rng, storage, confirm and device functions as arguments, so flow tests drive whole games in jsdom.
- **Playwright:** the PRD says CI only. It _can_ run on an aarch64 Pi without sudo: `npx playwright install chromium`, plus missing libraries fetched with `apt-get download` and passed in through `LD_LIBRARY_PATH`. The e2e specs set the event `timeStamp` to the faked `performance.now()`, and they rely on the CSS class selectors listed in `e2e/*.spec.ts`.
- **Dev simulator:** `npm run dev` then open `/?sim`. Arrow Down/Up tilt the phone. The simulator is stripped from production builds.

## 6. Map of the repo

```
src/config.ts         constants (APP_NAME, timings, tilt thresholds)
src/game/             pure: shuffle, normalize (pitch), tilt detector, round
src/decks/            8 original decks × 60 words (JSON) + typed loader
src/device/           orientation/permission, wake lock, fullscreen, audio (Web Audio synth), haptics
src/app.ts, router.ts, deps.ts, screens/, ui/   app controller, screens, autofit, toast, confirm
src/pwa.ts            SW registration + update toast (vite-plugin-pwa, registerType prompt)
scripts/              check-pure, check-trademarks, check-dist, gen-icons, acceptance
tests/                Vitest (unit, device, flow); e2e/ = Playwright (smoke, offline)
.github/workflows/deploy.yml   check → deploy to Pages (+ non-blocking lighthouse)
docs/manual-qa.md     real-device QA sheet
```

## 7. Prompt to paste into the new container

```text
I'm resuming the "Brow Guess" project (repo matt-moses/brow-guess). Read NEXT.md,
then prd.md and plan.md. Do the following in order:

1. Make sure the repo contains the latest local work. If origin/main is still at
   ee9daca, restore from the brow-guess.bundle file I'll provide (see NEXT.md §1).
2. Run `npm ci && npm run verify && npm run acceptance` and confirm everything is
   green except AC6, which should be PENDING.
3. Test push access with `git push --dry-run origin main`. If it fails, stop and
   tell me exactly what to fix (NEXT.md §2).
4. Push main, then finish the remaining work in NEXT.md §4: watch CI until it's
   green (fix and re-push as needed), check the live Pages URL, do the PR
   dry-run, record the Lighthouse scores, re-run acceptance, and tick the last
   boxes in plan.md.
5. Send me docs/manual-qa.md and the live URL for real-device testing.

Commit straight to main using conventional commits. Never commit with
`npm run verify` failing. Follow the conventions in NEXT.md §5.
```
