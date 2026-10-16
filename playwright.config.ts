import { defineConfig, devices } from '@playwright/test';

// Same sub-path the deploy workflow builds with (BASE_PATH=/<repo>/), so the
// tests exercise the real GitHub Pages layout. Build first: `npm run build`.
const basePath = process.env.BASE_PATH ?? '/brow-guess/';
const port = 4173;
const origin = `http://127.0.0.1:${port}`;

const pixel7 = devices['Pixel 7'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `${origin}${basePath}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-landscape',
      use: {
        ...pixel7,
        // Landscape: swap the portrait viewport/screen dimensions.
        viewport: { width: pixel7.viewport.height, height: pixel7.viewport.width },
        screen: { width: 915, height: 412 }, // Pixel 7 screen (412x915), landscape
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    // Serves the existing production build (dist/); CI builds it in an earlier step.
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${origin}${basePath}`,
    env: { BASE_PATH: basePath },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
