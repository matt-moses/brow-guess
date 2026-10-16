import { expect, test, type Page } from '@playwright/test';
import { COUNTDOWN_FROM, FEEDBACK_MS, READY_HOLD_MS, TILT_COOLDOWN_MS } from '../src/config.ts';

/**
 * Full-round smoke test (PRD §8, AC-1): pick a deck → hold → countdown →
 * tilt down (correct) → tilt up (pass) → time up → results.
 *
 * Time is driven by page.clock (fakes Date, performance.now, timers and rAF).
 * Synthetic deviceorientation events get their timeStamp pinned to the faked
 * performance.now(), so the app never mixes the real event clock with the fake
 * one (src/device/orientation.ts prefers event.timeStamp when it looks sane).
 */

declare global {
  interface Window {
    /** Dispatch a deviceorientation event for a forehead pose at `pitchDeg`. */
    __pose?: (pitchDeg: number) => void;
  }
}

const SAMPLE_MS = 50;

async function installDeviceStubs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // iOS-style permission gate, always granted.
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: () => Promise.resolve('granted'),
    });

    // Landscape-primary (angle 90); lock/unlock succeed.
    const proto = ScreenOrientation.prototype;
    Object.defineProperty(proto, 'angle', { configurable: true, get: () => 90 });
    Object.defineProperty(proto, 'type', { configurable: true, get: () => 'landscape-primary' });
    Object.defineProperty(proto, 'lock', { configurable: true, value: () => Promise.resolve() });
    Object.defineProperty(proto, 'unlock', { configurable: true, value: () => {} });

    // Port of tests/game/pose.ts (landscape-primary, no roll): world-up in
    // device coordinates, inverted to W3C beta/gamma.
    const DEG = Math.PI / 180;
    window.__pose = (pitchDeg: number): void => {
      const p = pitchDeg * DEG;
      const x = Math.cos(p); // screen-up = device +x
      const y = 0;
      const z = -Math.sin(p); // tilt-down turns the normal toward the floor
      const sign = z < 0 ? -1 : 1;
      const cb = sign * Math.hypot(x, z);
      let beta = Math.atan2(y, cb) / DEG;
      let gamma = Math.atan2(-x / cb, z / cb) / DEG;
      if (gamma >= 90) {
        gamma -= 180;
        beta = 180 - beta;
      }
      if (beta >= 180) beta -= 360;
      if (beta < -180) beta += 360;
      const event = new DeviceOrientationEvent('deviceorientation', {
        alpha: 123,
        beta,
        gamma,
        absolute: false,
      });
      // Keep event time on the (faked) performance.now() base.
      Object.defineProperty(event, 'timeStamp', { value: performance.now() });
      window.dispatchEvent(event);
    };
  });
}

/** Stream pose samples every SAMPLE_MS of fake time for `ms`. */
async function hold(page: Page, pitchDeg: number, ms: number): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += SAMPLE_MS) {
    await page.evaluate((p) => window.__pose?.(p), pitchDeg);
    await page.clock.runFor(SAMPLE_MS);
  }
}

test('plays a full round: one correct, one pass, results', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  await installDeviceStubs(page);
  await page.clock.install();
  await page.goto('./');

  const firstDeck = page.locator('.deck-card').first();
  await expect(firstDeck).toBeVisible();
  await firstDeck.click();

  // Ready: hold upright until the hold completes.
  await expect(page.locator('.screen-ready')).toBeVisible();
  await hold(page, 0, READY_HOLD_MS + 4 * SAMPLE_MS);
  await expect(page.locator('.screen-countdown')).toBeVisible();

  // Countdown (also calibrates neutral from these samples).
  await hold(page, 0, COUNTDOWN_FROM * 1000 + 2 * SAMPLE_MS);
  await expect(page.locator('.screen-round')).toBeVisible();

  const word = page.locator('.screen-round .word');
  const feedback = page.locator('.screen-round .feedback');
  const first = (await word.textContent()) ?? '';
  expect(first).not.toBe('');

  // Tilt down → correct.
  await hold(page, 50, 200);
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveText('Correct!');
  // Back to neutral: re-arm (after cooldown) + feedback timer → next word.
  await hold(page, 0, Math.max(FEEDBACK_MS, TILT_COOLDOWN_MS) + 200);
  await expect(feedback).toBeHidden();
  await expect(word).not.toHaveText(first);
  const second = (await word.textContent()) ?? '';
  expect(second).not.toBe('');

  // Tilt up → pass.
  await hold(page, -50, 200);
  await expect(feedback).toHaveText('Pass');
  await hold(page, 0, Math.max(FEEDBACK_MS, TILT_COOLDOWN_MS) + 200);

  // Run out the clock.
  await page.clock.runFor(61_000);

  await expect(page.locator('.screen-results')).toBeVisible();
  await expect(page.locator('.results-score .score-num')).toHaveText('1');
  const rows = page.locator('.results-list .result');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-outcome', 'correct');
  await expect(rows.nth(0).locator('.result-mark')).toHaveText('✓');
  await expect(rows.nth(0).locator('.result-word')).toHaveText(first);
  await expect(rows.nth(1)).toHaveAttribute('data-outcome', 'pass');
  await expect(rows.nth(1).locator('.result-mark')).toHaveText('✗');
  await expect(rows.nth(1).locator('.result-word')).toHaveText(second);

  expect(errors).toEqual([]);
});
