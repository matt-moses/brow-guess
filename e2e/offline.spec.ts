import { expect, test } from '@playwright/test';

/**
 * AC-5: after one online visit the service worker serves the app offline.
 * Runs against the production build (vite preview), where the SW registers.
 */
test('loads and starts a deck offline after the first visit', async ({ page, context }) => {
  // Headless Chromium exposes requestPermission and denies it; grant it like a phone would.
  await page.addInitScript(() => {
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: () => Promise.resolve('granted'),
    });
  });
  await page.goto('./');
  await expect(page.locator('.deck-card').first()).toBeVisible();

  // Wait for the worker to install and activate (precache complete).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // The first visit isn't controlled (no clientsClaim); reload until it is.
  await expect
    .poll(
      async () => {
        const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
        if (!controlled) await page.reload();
        return controlled;
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();

  const decks = page.locator('.deck-card');
  await expect(decks.first()).toBeVisible();
  expect(await decks.count()).toBeGreaterThan(1);

  await decks.first().click();
  await expect(page.locator('.screen-ready')).toBeVisible();
});
