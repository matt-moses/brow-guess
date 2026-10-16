/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves from /<repo>/; the deploy workflow sets BASE_PATH (PRD §7.3).
  base: process.env.BASE_PATH ?? '/',
  test: {
    // Pure logic runs in node; DOM tests opt in with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
