// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '../src/config';

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('boots the app into #app with the home screen', async () => {
    await import('../src/main.ts');
    expect(document.title).toBe(APP_NAME);
    expect(document.querySelector('#app h1')?.textContent).toBe(APP_NAME);
    expect(document.querySelectorAll('#app .deck-card').length).toBeGreaterThan(0);
  });
});
