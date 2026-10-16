// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Hooks = { onNeedRefresh?: () => void; onOfflineReady?: () => void };
const updateSW = vi.fn<(reload?: boolean) => Promise<void>>(() => Promise.resolve());
const registerSW = vi.fn<(hooks: Hooks) => typeof updateSW>(() => updateSW);

vi.mock('virtual:pwa-register', () => ({ registerSW }));

describe('registerPwa', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    registerSW.mockClear();
    updateSW.mockClear();
  });

  it('registers the worker and wires the update toast to updateSW(true)', async () => {
    const { registerPwa } = await import('../src/pwa');
    await registerPwa();
    expect(registerSW).toHaveBeenCalledTimes(1);
    const hooks = registerSW.mock.calls[0]![0];

    hooks.onNeedRefresh!();
    const reload = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Reload',
    )!;
    reload.click();
    expect(updateSW).toHaveBeenCalledWith(true);

    hooks.onOfflineReady!();
    expect(document.body.textContent).toContain('Ready to play offline');
  });
});
