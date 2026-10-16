# Brow Guess: real-device QA sheet

Fill in on real phones before calling a release done. Mark each row ✅ or ❌ and add notes (device model, OS/browser version, anything odd). Rows that don't apply to a platform: write N/A.

Tester: ____ Date: ____ Build/commit: ____

Automated coverage for the same criteria: `npm run acceptance` (see README). This sheet covers what only a human with a phone can confirm.

## Android Chrome (browser)

Device / OS / browser: ____

| Check                                                                                      | Result (✅/❌) | Notes |
| ------------------------------------------------------------------------------------------ | -------------- | ----- |
| Loads at <https://matt-moses.github.io/brow-guess/>                                        |                |       |
| Motion permission prompt appears on first deck tap (iOS; N/A on Android)                   |                |       |
| Denied path: "Motion access needed" instructions shown; after re-enabling, reload recovers |                |       |
| Rotate overlay shown in portrait                                                           |                |       |
| Countdown starts after ~1 s held upright on forehead                                       |                |       |
| Tilt down = correct, registers once                                                        |                |       |
| Tilt up = pass, registers once                                                             |                |       |
| No double count on small jitter / head movement                                            |                |       |
| Next word appears only after returning to neutral                                          |                |       |
| Final 10 s ticks + buzzer at time up                                                       |                |       |
| Haptics on correct/pass (Android; iOS has no vibration API, expect none)                   |                |       |
| Sounds play (iOS: silent switch mutes web audio, note switch position)                     |                |       |
| Screen stays awake for the full 60 s round                                                 |                |       |
| Both landscape orientations (rotate 180°): down still correct, up still pass               |                |       |
| App switch pauses; returning resumes with a countdown                                      |                |       |
| Quit asks for confirmation                                                                 |                |       |
| Results show score + ordered words; Play again and Choose deck work                        |                |       |
| Install to home screen (Install app / Add to Home Screen)                                  |                |       |
| Airplane mode: offline play after first online visit                                       |                |       |
| Update toast appears after a new deploy (reopen app once after deploy)                     |                |       |
| Long words fit on screen without clipping                                                  |                |       |

## Android installed PWA

Device / OS / browser: ____

| Check                                                                                      | Result (✅/❌) | Notes |
| ------------------------------------------------------------------------------------------ | -------------- | ----- |
| Loads at <https://matt-moses.github.io/brow-guess/>                                        |                |       |
| Motion permission prompt appears on first deck tap (iOS; N/A on Android)                   |                |       |
| Denied path: "Motion access needed" instructions shown; after re-enabling, reload recovers |                |       |
| Rotate overlay shown in portrait                                                           |                |       |
| Countdown starts after ~1 s held upright on forehead                                       |                |       |
| Tilt down = correct, registers once                                                        |                |       |
| Tilt up = pass, registers once                                                             |                |       |
| No double count on small jitter / head movement                                            |                |       |
| Next word appears only after returning to neutral                                          |                |       |
| Final 10 s ticks + buzzer at time up                                                       |                |       |
| Haptics on correct/pass (Android; iOS has no vibration API, expect none)                   |                |       |
| Sounds play (iOS: silent switch mutes web audio, note switch position)                     |                |       |
| Screen stays awake for the full 60 s round                                                 |                |       |
| Both landscape orientations (rotate 180°): down still correct, up still pass               |                |       |
| App switch pauses; returning resumes with a countdown                                      |                |       |
| Quit asks for confirmation                                                                 |                |       |
| Results show score + ordered words; Play again and Choose deck work                        |                |       |
| Install to home screen (Install app / Add to Home Screen)                                  |                |       |
| Airplane mode: offline play after first online visit                                       |                |       |
| Update toast appears after a new deploy (reopen app once after deploy)                     |                |       |
| Long words fit on screen without clipping                                                  |                |       |

## iOS Safari (browser)

Device / OS / browser: ____

| Check                                                                                      | Result (✅/❌) | Notes |
| ------------------------------------------------------------------------------------------ | -------------- | ----- |
| Loads at <https://matt-moses.github.io/brow-guess/>                                        |                |       |
| Motion permission prompt appears on first deck tap (iOS; N/A on Android)                   |                |       |
| Denied path: "Motion access needed" instructions shown; after re-enabling, reload recovers |                |       |
| Rotate overlay shown in portrait                                                           |                |       |
| Countdown starts after ~1 s held upright on forehead                                       |                |       |
| Tilt down = correct, registers once                                                        |                |       |
| Tilt up = pass, registers once                                                             |                |       |
| No double count on small jitter / head movement                                            |                |       |
| Next word appears only after returning to neutral                                          |                |       |
| Final 10 s ticks + buzzer at time up                                                       |                |       |
| Haptics on correct/pass (Android; iOS has no vibration API, expect none)                   |                |       |
| Sounds play (iOS: silent switch mutes web audio, note switch position)                     |                |       |
| Screen stays awake for the full 60 s round                                                 |                |       |
| Both landscape orientations (rotate 180°): down still correct, up still pass               |                |       |
| App switch pauses; returning resumes with a countdown                                      |                |       |
| Quit asks for confirmation                                                                 |                |       |
| Results show score + ordered words; Play again and Choose deck work                        |                |       |
| Install to home screen (Install app / Add to Home Screen)                                  |                |       |
| Airplane mode: offline play after first online visit                                       |                |       |
| Update toast appears after a new deploy (reopen app once after deploy)                     |                |       |
| Long words fit on screen without clipping                                                  |                |       |

## iOS Home Screen app

Device / OS / browser: ____

| Check                                                                                      | Result (✅/❌) | Notes |
| ------------------------------------------------------------------------------------------ | -------------- | ----- |
| Loads at <https://matt-moses.github.io/brow-guess/>                                        |                |       |
| Motion permission prompt appears on first deck tap (iOS; N/A on Android)                   |                |       |
| Denied path: "Motion access needed" instructions shown; after re-enabling, reload recovers |                |       |
| Rotate overlay shown in portrait                                                           |                |       |
| Countdown starts after ~1 s held upright on forehead                                       |                |       |
| Tilt down = correct, registers once                                                        |                |       |
| Tilt up = pass, registers once                                                             |                |       |
| No double count on small jitter / head movement                                            |                |       |
| Next word appears only after returning to neutral                                          |                |       |
| Final 10 s ticks + buzzer at time up                                                       |                |       |
| Haptics on correct/pass (Android; iOS has no vibration API, expect none)                   |                |       |
| Sounds play (iOS: silent switch mutes web audio, note switch position)                     |                |       |
| Screen stays awake for the full 60 s round                                                 |                |       |
| Both landscape orientations (rotate 180°): down still correct, up still pass               |                |       |
| App switch pauses; returning resumes with a countdown                                      |                |       |
| Quit asks for confirmation                                                                 |                |       |
| Results show score + ordered words; Play again and Choose deck work                        |                |       |
| Install to home screen (Install app / Add to Home Screen)                                  |                |       |
| Airplane mode: offline play after first online visit                                       |                |       |
| Update toast appears after a new deploy (reopen app once after deploy)                     |                |       |
| Long words fit on screen without clipping                                                  |                |       |

## Tuning

Tilt sensitivity lives in `src/config.ts`:

- `TILT_TRIGGER_DEG` (default 35): how far (degrees from neutral) the phone must tilt down or up to fire correct/pass. Raise it if small head movements trigger answers; lower it if deliberate tilts are missed.
- `TILT_REARM_DEG` (default 15): the phone must come back within this many degrees of neutral before the next tilt can fire (and before the next word appears). Lower it if words advance before the phone is really back on the forehead; raise it if players must hold too precisely still.
- `TILT_COOLDOWN_MS` (default 500): minimum time after a fire before the detector may re-arm. Raise it if one gesture ever counts twice.

Keep `TILT_REARM_DEG` well below `TILT_TRIGGER_DEG` (hysteresis). After changing them, run `npm run verify` (the tilt unit tests encode the defaults' behaviour) and re-check the tilt rows above.

## Dev on a phone over LAN

To test unreleased changes on a phone, see README → **Local development** (`npm run dev -- --host`) and **Motion sensors need HTTPS on iOS** (self-signed certificate or tunnel options). The deployed Pages site is always HTTPS.
