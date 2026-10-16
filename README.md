# Brow Guess

A party word game for phones: hold the phone to your forehead, let your friends describe the word, tilt down when you get it, tilt up to pass.

**Play:** <https://matt-moses.github.io/brow-guess/>

<a href="https://matt-moses.github.io/brow-guess/"><img src="assets/qr-live-site.svg" alt="QR code linking to https://matt-moses.github.io/brow-guess/" width="180"></a>

Scan the code with a phone camera to open the game. It's handy for passing around at a party.

It is a static, installable web app (PWA) that works offline after the first visit. No accounts, no ads, no tracking.

## How to play

1. Open the link on your phone and pick a deck.
2. Allow motion access if your phone asks (iOS does).
3. Turn the phone sideways (landscape) and hold it on your forehead, screen facing your friends. Hold still until the countdown starts.
4. Your friends describe the word on screen without saying it.
   - **Tilt down** (screen toward the floor) when you guess it: correct.
   - **Tilt up** (screen toward the ceiling) to pass.
   - Bring the phone back to your forehead to get the next word.
5. When the 60-second timer runs out, hand the phone around to see the score and every word, then play again or choose another deck.

Tip: on iPhone, use **Share → Add to Home Screen** for a fullscreen, offline-ready app.

## Local development

Requires Node 22 (pinned in `.nvmrc`; `engines` allows >= 20).

```bash
nvm use            # or install Node 22 another way
npm ci
npm run dev        # http://localhost:5173/
```

To try it on a phone over your LAN, expose the dev server and open the printed network URL on the phone:

```bash
npm run dev -- --host
```

### Motion sensors need HTTPS on iOS

iOS Safari only delivers `deviceorientation` events (and only shows the motion permission prompt) on a secure origin. A plain `http://192.168.x.x:5173` URL works on Android Chrome for some setups but not on iOS. Options:

- **Self-signed HTTPS in Vite:** `npm i -D @vitejs/plugin-basic-ssl`, add `basicSsl()` to the `plugins` in `vite.config.ts` (locally, don't commit), then `npm run dev -- --host` and accept the certificate warning on the phone.
- **A tunnel:** run `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173` and open the HTTPS URL it prints.
- **Production:** GitHub Pages is always HTTPS, so the deployed site works everywhere.

### Desktop simulator (`?sim`)

Desktops have no orientation sensor. In dev mode only, open <http://localhost:5173/?sim> to load a simulator that pretends the phone is in landscape and streams orientation events: neutral by default, hold **Arrow Down** to tilt down (correct), hold **Arrow Up** to tilt up (pass). It is stripped from production builds.

## Scripts

| Script                 | What it does                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Vite dev server with hot reload (`-- --host` for LAN).                                              |
| `npm run build`        | Production build to `dist/` (honours `BASE_PATH`).                                                  |
| `npm run preview`      | Serve the production build locally.                                                                 |
| `npm run lint`         | ESLint (type-aware typescript-eslint).                                                              |
| `npm run format`       | Prettier, rewrite files.                                                                            |
| `npm run format:check` | Prettier, check only.                                                                               |
| `npm run typecheck`    | `tsc --noEmit` over app, tests, e2e and configs.                                                    |
| `npm test`             | Vitest unit and jsdom flow tests, once.                                                             |
| `npm run test:watch`   | Vitest in watch mode.                                                                               |
| `npm run coverage`     | Vitest with V8 coverage (`coverage/`).                                                              |
| `npm run test:e2e`     | Playwright smoke and offline specs against `vite preview` (CI; see below).                          |
| `npm run acceptance`   | Runs the automatable PRD acceptance checks and prints a PASS/FAIL/PENDING table.                    |
| `npm run verify`       | The local gate: lint, format check, typecheck, purity check, brand check, tests, build, dist check. |
| `npm run check:pure`   | Ensures game logic in `src/game/` stays DOM-free.                                                   |
| `npm run check:brand`  | Fails if third-party trademarked names appear in the repo.                                          |
| `npm run check:dist`   | Validates the build: base path, manifest fields, icons, service worker precache.                    |
| `npm run gen:icons`    | Rasterises the source artwork in `assets/` into `public/icons/`.                                    |

## Testing

- **Unit and flow tests (Vitest):** `npm test`. Game logic (tilt detection, normalization, round, shuffle) is pure and clock-injected; screens and the full game flow run in jsdom against fake device adapters. This is the main local loop.
- **End-to-end (Playwright):** runs in CI only by default (browsers are heavy on small dev machines). `e2e/smoke.spec.ts` plays a full round with synthetic orientation events and a fake clock; `e2e/offline.spec.ts` checks that the app loads and starts a deck offline after one visit. To run them locally:

  ```bash
  npx playwright install chromium
  BASE_PATH=/brow-guess/ npm run build
  npm run test:e2e
  ```

  The Playwright web server serves `dist/` under `BASE_PATH` (default `/brow-guess/`), so build with the same value.

## Deployment

GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`):

- Every push and pull request runs the `check` job: `npm ci`, lint, format check, typecheck, purity check, brand check, unit tests, build, dist check, and the Playwright specs.
- On `main` (push or manual run) the tested `dist/` is uploaded as the Pages artifact and the `deploy` job publishes it. Pull requests run the checks but never deploy.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

GitHub Pages on a private repository needs a paid GitHub plan; on GitHub Free the repository must be public (this one is).

**Lighthouse:** an optional `lighthouse` job (non-blocking, `continue-on-error`) audits the production build served by `vite preview` for performance, accessibility and best practices (Lighthouse 12 dropped the PWA category; installability is covered by `check-dist` and `e2e/offline.spec.ts`). Scores are printed in the job summary and the full HTML/JSON report is uploaded as the `lighthouse-report` artifact. Scores from the first CI run on `main` (2026-10-16, mobile): Performance 99, Accessibility 100, Best Practices 100.

**Base path:** Pages serves the site from `/<repo-name>/`. The workflow sets `BASE_PATH=/${{ github.event.repository.name }}/` for the build, so renaming the repository needs no code change. Locally `BASE_PATH` defaults to `/`.

## Project structure

```
index.html              App shell (name and theme come from src/config.ts)
src/
  main.ts               Entry: mounts the app, registers the service worker (prod only)
  app.ts                App controller: game session and screen flow
  config.ts             All tunables (round length, tilt thresholds, timings)
  deps.ts               Injectable dependencies (clock, RNG, device adapters)
  router.ts             Tiny screen router
  pwa.ts                Service-worker registration and update toast
  screens/              home, ready, countdown, round, results, paused, permission, unsupported
  game/                 Pure logic: tilt detector, pitch normalization, round, shuffle
  device/               Thin adapters: orientation, wake lock, fullscreen, audio, haptics
  decks/                Bundled word decks (JSON) and their schema
  ui/                   DOM helpers, text autofit, toasts, confirm dialog
  dev/sim.ts            Desktop sensor simulator (dev only)
assets/                 Icon source artwork
public/icons/           App icons and favicons (generated, committed)
tests/                  Vitest unit and jsdom flow tests
e2e/                    Playwright specs (CI)
scripts/                Purity, brand and dist checks; icon generator
.github/workflows/      Check and deploy workflow
```

## Manual QA checklist

Run on real devices before calling a release done. The full sheet with result columns per platform is in [docs/manual-qa.md](docs/manual-qa.md).

- [ ] Android Chrome, in the browser: pick a deck, play a full 60 s round with tilt controls, results are correct.
- [ ] Android Chrome, installed PWA (Install app / Add to Home screen): launches fullscreen in landscape and plays a full round.
- [ ] iOS Safari, in the browser: the motion permission prompt appears on the first deck tap; Allow lets you play a full round.
- [ ] iOS Safari, denied path: choosing Don't Allow shows the "Motion access needed" screen with recovery steps.
- [ ] iOS Add to Home Screen: launches from the icon, asks for motion permission, plays a full round.
- [ ] Offline after first load: visit once online, enable airplane mode, reopen the app; decks load and a round plays.
- [ ] Screen stays awake through a full round (no dimming or lock).
- [ ] Both landscape orientations (rotate the phone 180°): tilt down is still correct and tilt up is still pass.
- [ ] Tilt sensitivity feels right: deliberate tilts register once, small head movements don't (tune `TILT_TRIGGER_DEG` / `TILT_REARM_DEG` in `src/config.ts` if not).

## Privacy

The app makes no network calls of its own and has no analytics or tracking. After the first load everything is served from the service-worker cache. The only thing stored is the last deck you picked, in `localStorage` on your device. Motion data is used only on the device to detect tilts.

## Credits and license

All decks, words, icons, sounds and code are original to this project. Brow Guess is an independent game and is not affiliated with any other party game or its publishers.
