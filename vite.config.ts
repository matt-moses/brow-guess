import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR } from './src/config.ts';

// GitHub Pages serves from /<repo>/; the deploy workflow sets BASE_PATH (PRD §7.3).
const base = process.env.BASE_PATH ?? '/';

/** Replaces %APP_NAME% etc. in index.html so the name lives in one constant (FR-20). */
function htmlConstants(values: Record<string, string>): Plugin {
  return {
    name: 'brow-guess:html-constants',
    transformIndexHtml(html) {
      return html.replace(/%(APP_[A-Z_]+|THEME_COLOR)%/g, (match, key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`index.html: unknown placeholder ${match}`);
        return value;
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    htmlConstants({ APP_NAME, APP_DESCRIPTION, THEME_COLOR }),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      // src/pwa.ts registers the worker itself (production only) so it can show the update toast.
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      // public/ files are already matched by globPatterns; don't add them twice.
      includeManifestIcons: false,
      manifest: {
        id: base,
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        lang: 'en',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The plugin adds the manifest to the precache itself.
        globIgnores: ['manifest.webmanifest'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    // Pure logic runs in node; DOM tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Playwright specs (e2e/) run via `npm run test:e2e`, never under Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
