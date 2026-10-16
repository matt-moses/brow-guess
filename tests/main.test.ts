// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders the app name into #app', async () => {
    await import('../src/main.ts');
    expect(document.querySelector('#app h1')?.textContent).toBe('Forehead Frenzy');
  });
});
