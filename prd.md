# PRD: Forehead Frenzy — Web Party Guessing Game

## 1. Summary

Forehead Frenzy is a party guessing game that runs on a phone's browser. One player holds the phone to their forehead. The rest of the group sees a word on the screen and gives clues. The player tilts the phone **down** when they guess correctly and **up** to pass. A round lasts 60 seconds and ends on a results screen.

The game is a static, installable, offline-capable PWA. It is built with vanilla TypeScript and Vite and deployed to **GitHub Pages** by GitHub Actions.

It is inspired by "Heads Up!" but uses **original name, branding, and deck content**. It uses no Warner Bros. trademarks, assets, or word lists.

## 2. Goals

- Play a full round on a phone browser with nothing to download. This must work in Android Chrome and iOS Safari.
- Make tilt controls reliable: no double-counting, and no accidental triggers while the phone is placed on the forehead.
- Let players install it to the home screen and play offline after the first visit.
- Deploy automatically to GitHub Pages on every push to `main`.

## 3. Non-Goals (MVP)

- Native Android/iOS apps or a Play Store listing (TWA wrapping is deferred)
- Custom or user-created decks, and deck import
- Video recording of rounds
- Team or multi-round scoring, leaderboards, accounts, or any backend
- Tap-to-answer fallback and a settings screen (round length, sensitivity). These are deferred, but the code should keep constants configurable.
- Analytics and tracking
- Localization (English only)

## 4. Users & Context

- Groups of 2–10 people at parties or on trips, often on poor connections. This is the reason the game must work offline.
- The phone is held in **landscape**, screen facing outward, against the forehead of the guesser.
- The players who give clues read the screen from about 1–2 m away. Text must be very large and high-contrast.

## 5. User Flow

1. **Home / Deck picker**: A grid of deck cards, each showing its title, emoji/icon, and short description.
2. **Tap a deck**, which counts as a user gesture. In that handler the app:
   - On iOS, calls `DeviceOrientationEvent.requestPermission()`. If permission is denied, it shows an explanation screen (§7.4).
   - Requests Fullscreen. This is best-effort; Fullscreen is unsupported on iPhone Safari.
   - Attempts `screen.orientation.lock('landscape')`. This is best-effort.
   - Requests a Screen Wake Lock (§7.3).
3. **"Place on forehead" screen**: Prompts the player to rotate the phone to landscape and raise it to their forehead.
   - If the device is in portrait, it shows a "rotate your device" overlay.
   - The countdown starts after the device has been in landscape and held roughly upright for about 1 s.
4. **Countdown**: 3‑2‑1, with a beep on each tick and a haptic pulse. The neutral orientation is calibrated during the countdown.
5. **Round** (60 s):
   - Shows one word at a time, very large and centered, with the timer in a corner.
   - **Tilt down** marks the word *Correct*: the screen flashes green with a "Correct!" overlay, plus a sound and a short vibration.
   - **Tilt up** marks the word *Pass*: the screen flashes orange with a "Pass" overlay, plus a different sound and vibration.
   - The overlay lasts about 600 ms. Then the next word appears once the phone has returned to neutral.
   - In the final 10 s, the timer ticks audibly each second.
   - If the deck runs out before time is up, the app reshuffles the passed words. If there are none, the round ends early.
6. **Time's up**: A buzzer sounds, then the app releases the wake lock, exits fullscreen, and shows the results.
7. **Results screen**:
   - Shows the score (number correct).
   - Lists every word in order, marked ✓ or ✗/pass. Correct words appear in green and passed words are dimmed.
   - Buttons: **Play again** (same deck, new shuffle) and **Choose deck**.

A **Quit** button or gesture is available during the round, for example a tap in the top-left corner with a confirmation. It returns to the deck picker.

## 6. Functional Requirements

### 6.1 Decks

- **FR-1**: Ship about 8 original decks as bundled JSON. Each deck has about 60 unique entries.
  - Suggested decks: Animals; Food & Drink; Act It Out (charades actions); Sports; Jobs; Famous Places & Landmarks; Around the House; Kids' Mix.
  - Content must be original. It must not include real living-celebrity decks or brand or WB-derived lists.
- **FR-2**: The deck schema is:
  ```json
  { "id": "animals", "title": "Animals", "emoji": "🦁", "description": "...", "color": "#hex", "words": ["..."] }
  ```
  The schema is validated in unit tests: unique ids, no duplicate words within a deck, and at least 40 words per deck.
- **FR-3**: Words are shuffled with Fisher–Yates at round start, and no word repeats within a round.

### 6.2 Tilt Detection

- **FR-4**: Use `deviceorientation` events. Normalize to a single "pitch toward/away from face" value using the current `screen.orientation.angle`. In landscape this is mostly `gamma`, with its sign depending on landscape-primary or landscape-secondary.
- **FR-5**: Calibrate a neutral angle at the end of the countdown.
- **FR-6**: Detection is a state machine: `NEUTRAL → TRIGGERED(correct|pass) → COOLDOWN → NEUTRAL`.
  - A trigger fires when the deviation from neutral exceeds **±35°**. These are default thresholds stored as constants.
  - The detector re-arms only after the phone returns within **±15°** of neutral (hysteresis) **and** a minimum cooldown of about 500 ms has passed.
  - Tilting down (screen toward the floor) counts as *correct*. Tilting up (screen toward the ceiling) counts as *pass*.
- **FR-7**: The detector is a pure, DOM-free module (input: angle samples plus timestamps; output: events) so it can be unit-tested.

### 6.3 Timer

- **FR-8**: The round length is 60 s. It is a constant, structured for a future setting.
- **FR-9**: Compute the timer from `performance.now()` deltas, not by counting intervals, so it stays accurate when frames drop.
- **FR-10**: If the page is hidden (`visibilitychange`), pause the round and show a "Paused — tap to resume" overlay. Resuming re-runs the countdown and recalibration.

### 6.4 Device APIs

- **FR-11 Wake Lock**: Call `navigator.wakeLock.request('screen')` during the round. Re-acquire the lock on `visibilitychange` if the round is active. Degrade silently where unsupported.
- **FR-12 Fullscreen and orientation lock**: Best-effort, wrapped in try/catch, with feature detection and no hard failures.
- **FR-13 Haptics**: Use `navigator.vibrate` where available. It is a no-op on iOS.
- **FR-14 Audio**: Generate short sound effects with the Web Audio API: tick, correct, pass, and buzzer. This avoids audio asset licensing.
  - Create or resume the AudioContext inside the deck-tap gesture to satisfy autoplay rules.

### 6.5 Permissions & Unsupported Devices

- **FR-15**: If `DeviceOrientationEvent.requestPermission` exists (iOS 13+), call it from the deck-tap handler. If it returns `denied`, show instructions for re-enabling motion access. On iOS this means reloading the page; on older versions, Settings → Safari → Motion & Orientation Access.
- **FR-16**: If no orientation events arrive within about 1.5 s of starting, show a "Motion sensors not available — play on a phone" message. Desktop browsers are an example.

### 6.6 PWA

- **FR-17**: Use `vite-plugin-pwa` to generate:
  - **Manifest**: name "Forehead Frenzy", `display: fullscreen` (`standalone` fallback), `orientation: landscape`, theme and background colors, and icons at 192, 512, and maskable sizes.
  - **Service worker** (Workbox `generateSW`): precaches all built assets, including deck JSON (or decks bundled into JS), so the game is fully playable offline after the first load.
- **FR-18**: The manifest `start_url` and `scope` must respect the GitHub Pages base path.
- **FR-19**: Show a small "Update available — reload" toast when a new service worker is waiting. Use the `prompt` registerType.

### 6.7 Branding & UI

- **FR-20**: The app name "Forehead Frenzy" is defined in a single config constant.
- **FR-21**: Bold, high-contrast visuals. The word text uses a large display font: system font stack or a self-hosted font. No CDN fonts, so offline play works.
  - Text auto-fits so long entries ("Brushing your teeth") stay on screen at the largest possible size.
- **FR-22**: Original icon and simple logo, made as SVG and generated to PNG sizes.
- **FR-23**: Accessibility:
  - Deck picker buttons are reachable by keyboard and have labels.
  - Results are readable at normal phone distance.
  - Respect `prefers-reduced-motion` for the flash animations.

## 7. Technical Design Constraints

### 7.1 Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Build/dev | Vite |
| UI | Vanilla TS + DOM: a small screen/router module, with no framework |
| Styling | Plain CSS (custom properties for theming) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Unit tests | Vitest (jsdom where needed) |
| E2E smoke | Playwright, run **in CI only**: it is heavy on the aarch64 Pi dev host |
| Lint/format | ESLint (typescript-eslint) + Prettier |
| Node | LTS (≥ 20), pinned via `.nvmrc` / `engines` |
| Hosting | GitHub Pages (project site) via GitHub Actions |

### 7.2 Proposed Module Layout (indicative)

```
src/
  main.ts            # bootstrap, router
  config.ts          # APP_NAME, ROUND_SECONDS, tilt thresholds
  screens/           # home, ready, countdown, round, results, permission, unsupported
  game/
    tilt.ts          # pure tilt state machine
    round.ts         # round state: queue, results, timer logic
    shuffle.ts
  device/
    orientation.ts   # event wiring, normalization, iOS permission
    wakelock.ts
    fullscreen.ts
    audio.ts         # Web Audio synth SFX
    haptics.ts
  decks/*.json
public/icons/...
tests/ (unit) , e2e/ (Playwright)
```

### 7.3 Base Path

- The repo is `matt-moses/headsup`, so the production URL is `https://matt-moses.github.io/headsup/` and `base` resolves to `/headsup/`.
- Set Vite `base` from an env var, `BASE_PATH`, defaulting to `/`, rather than hard-coding it. This keeps a later repo rename painless.
- The Pages workflow sets `BASE_PATH=/${{ github.event.repository.name }}/`.
- All asset, manifest, and service-worker URLs derive from `import.meta.env.BASE_URL`.

### 7.4 Routing

- Use in-memory screen state, or hash routing at most. Avoid History-API paths so there are no 404s on GitHub Pages refresh.

### 7.5 Security / Privacy

- No network calls beyond loading the site's own assets.
- No cookies, analytics, or storage of personal data.
- `localStorage` is optional, used only for the last-picked deck and wrapped in try/catch.

## 8. CI/CD

GitHub Actions workflow `.github/workflows/deploy.yml`:

- **Triggers**: push to `main`, pull requests (checks only), and `workflow_dispatch`.
- **Job `check`**: `npm ci` → `npm run lint` → `npm run format:check` → `npm run typecheck` → `npm test` (Vitest) → `npm run build` → Playwright smoke test (`npx playwright install --with-deps chromium`) against `vite preview`.
- **Job `deploy`**: runs on `main` only and needs `check`. It uses `actions/configure-pages`, `actions/upload-pages-artifact` (`dist/`), and `actions/deploy-pages`. It needs the `pages: write` and `id-token: write` permissions.
- Remote: `git@github.com:matt-moses/headsup.git` (currently private, see §11).
- Pages must be set to "GitHub Actions" source in the repo settings. This is a one-time manual step and will be documented in the README.

### Playwright smoke test scope

- Emulates a mobile landscape viewport.
- Stubs or dispatches synthetic `deviceorientation` events (and stubs `requestPermission`).
- Flow: pick deck → countdown → simulate tilt down → simulate tilt up → fast-forward the clock (`page.clock`) to end the round → assert the results show 1 correct and 1 pass.

## 9. Testing Requirements

- **Unit (Vitest)**:
  - Tilt state machine: thresholds, hysteresis, cooldown, and no double-fire on jitter.
  - Normalization for landscape-primary vs. landscape-secondary.
  - Shuffle has no repeats.
  - Round logic: scoring, the deck-exhaustion path, and pause/resume.
  - Deck schema validation across all bundled decks.
- **E2E (Playwright, CI)**: the smoke flow above.
- **Manual QA checklist** (README):
  - Android Chrome (browser and installed PWA)
  - iOS Safari (browser and Add to Home Screen): permission prompt, then the denied path
  - Offline play after first load (airplane mode)
  - Screen stays awake through a full round
  - Both landscape orientations

## 10. Acceptance Criteria

1. Visiting the Pages URL on Android Chrome and iOS Safari lets a user pick a deck, grant motion permission where required, and play a full 60 s round with tilt controls.
2. Tilt down and tilt up register exactly once per gesture, and the next word appears only after the phone returns to neutral.
3. The screen does not sleep during a round where Wake Lock is supported.
4. The results screen shows the correct score and the ordered word list. Play again and Choose deck both work.
5. After one online visit, the app installs to the home screen and plays fully offline.
6. Every push to `main` passes lint, format, typecheck, unit, build, and e2e checks, then deploys to GitHub Pages automatically. PRs run the checks without deploying.
7. No "Heads Up!" or Warner Bros. names, assets, or content appear anywhere in the repo or app.
8. A README covers local dev (`npm run dev -- --host` for testing on a phone over LAN), the motion-sensor HTTPS caveat, the Pages setup, and the manual QA checklist.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Testing on a phone over LAN needs HTTPS for motion sensors on iOS | Document `@vitejs/plugin-basic-ssl` or a tunnel option for dev. Production Pages is HTTPS. |
| iOS can't lock orientation or go fullscreen in Safari | "Rotate device" overlay. Recommend Add to Home Screen. Read orientation from `screen.orientation`/`matchMedia`. |
| Sensor axis conventions differ across devices | Normalization isolated in one module, calibration at round start, thresholds in config. |
| Playwright is too heavy for the Pi | Run it only in CI. Locally, unit tests are the main loop. |
| Repo `matt-moses/headsup` is private | GitHub Pages on a private repo needs a paid plan (Pro/Team/Enterprise). On Free, the repo must be made public before Pages will deploy. The published site is publicly reachable either way, unless the account is Enterprise Cloud with private Pages. |
| Repo/URL slug "headsup" echoes the WB trademark | Fine for development. Consider renaming the repo to `forehead-frenzy` before any public launch. `BASE_PATH` means the rename needs no code changes. |
| Stale service worker serves an old version | Prompt-style update toast (FR-19). |

## 12. Open Items (deferred, not blocking MVP)

- Tap-to-answer fallback and settings (round length, sensitivity)
- Custom decks and JSON import
- TWA/Play Store packaging of the same PWA
- Team mode and multi-round scoring
