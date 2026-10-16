// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFLINE_TOAST_MS,
  TOAST_REGION_ID,
  showOfflineReadyToast,
  showToast,
  showUpdateToast,
} from '../../src/ui/toast';

function region(): HTMLElement | null {
  return document.getElementById(TOAST_REGION_ID);
}

describe('toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders into a single polite status region outside #app', () => {
    showToast({ message: 'one' });
    showToast({ message: 'two' });
    const regions = document.querySelectorAll(`#${TOAST_REGION_ID}`);
    expect(regions).toHaveLength(1);
    const r = region()!;
    expect(r.getAttribute('role')).toBe('status');
    expect(r.getAttribute('aria-live')).toBe('polite');
    expect(r.parentElement).toBe(document.body);
    expect(document.querySelector('#app')!.contains(r)).toBe(false);
    expect([...r.querySelectorAll('.toast-msg')].map((n) => n.textContent)).toEqual(['one', 'two']);
  });

  it('update toast: Reload calls updateSW(true) and removes the toast', () => {
    const updateSW = vi.fn(() => Promise.resolve());
    const t = showUpdateToast(updateSW);
    expect(t.el.querySelector('.toast-msg')!.textContent).toBe('Update available');
    const reload = [...t.el.querySelectorAll('button')].find((b) => b.textContent === 'Reload')!;
    expect(reload.type).toBe('button');
    reload.click();
    expect(updateSW).toHaveBeenCalledWith(true);
    expect(t.el.isConnected).toBe(false);
  });

  it('update toast: Dismiss closes without updating and stays until dismissed', () => {
    vi.useFakeTimers();
    const updateSW = vi.fn(() => Promise.resolve());
    const t = showUpdateToast(updateSW);
    vi.advanceTimersByTime(60_000);
    expect(t.el.isConnected).toBe(true);
    const close = t.el.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!;
    close.click();
    expect(updateSW).not.toHaveBeenCalled();
    expect(t.el.isConnected).toBe(false);
  });

  it('offline-ready toast auto-dismisses', () => {
    vi.useFakeTimers();
    const t = showOfflineReadyToast();
    expect(t.el.textContent).toContain('Ready to play offline');
    vi.advanceTimersByTime(OFFLINE_TOAST_MS - 1);
    expect(t.el.isConnected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(t.el.isConnected).toBe(false);
  });

  it('dismiss() is idempotent and clears its timer', () => {
    vi.useFakeTimers();
    const t = showToast({ message: 'x', timeoutMs: 1000, dismissible: false });
    expect(t.el.querySelector('button')).toBeNull();
    t.dismiss();
    t.dismiss();
    expect(vi.getTimerCount()).toBe(0);
  });
});
