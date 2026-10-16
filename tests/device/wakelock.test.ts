// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createWakeLock, wakeLock } from '../../src/device/wakelock';
import { installFakeDevice, type FakeDevice } from '../helpers/fakeDevice';

let dev: FakeDevice | undefined;
afterEach(() => {
  dev?.uninstall();
  dev = undefined;
});

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('wake lock', () => {
  it('acquire requests a screen lock', async () => {
    dev = installFakeDevice();
    const wl = createWakeLock();
    await wl.acquire();
    expect(dev.wakeLock.request).toHaveBeenCalledWith('screen');
    expect(dev.wakeLock.active).toBe(1);
    expect(wl.isHeld()).toBe(true);
    // A second acquire while held does not request again.
    await wl.acquire();
    expect(dev.wakeLock.requests).toBe(1);
    wl.dispose();
  });

  it('re-acquires when the page becomes visible again', async () => {
    dev = installFakeDevice();
    const wl = createWakeLock();
    await wl.acquire();
    dev.setVisibility('hidden');
    expect(wl.isHeld()).toBe(false);
    expect(dev.wakeLock.requests).toBe(1);
    dev.setVisibility('visible');
    await flush();
    expect(dev.wakeLock.requests).toBe(2);
    expect(wl.isHeld()).toBe(true);
    wl.dispose();
  });

  it('release prevents re-acquire', async () => {
    dev = installFakeDevice();
    const wl = createWakeLock();
    await wl.acquire();
    await wl.release();
    expect(dev.wakeLock.releases).toBe(1);
    expect(wl.isHeld()).toBe(false);
    dev.setVisibility('hidden');
    dev.setVisibility('visible');
    await flush();
    expect(dev.wakeLock.requests).toBe(1);
    wl.dispose();
  });

  it('releases a lock that arrives after release() was called', async () => {
    dev = installFakeDevice();
    const wl = createWakeLock();
    const p = wl.acquire();
    const r = wl.release();
    await Promise.all([p, r]);
    expect(dev.wakeLock.active).toBe(0);
    expect(wl.isHeld()).toBe(false);
  });

  it('dispose releases and stops listening', async () => {
    dev = installFakeDevice();
    const wl = createWakeLock();
    await wl.acquire();
    wl.dispose();
    await flush();
    expect(dev.wakeLock.active).toBe(0);
    dev.setVisibility('visible');
    await flush();
    expect(dev.wakeLock.requests).toBe(1);
  });

  it('is silent when the API is missing', async () => {
    dev = installFakeDevice({ wakeLock: 'absent' });
    const wl = createWakeLock();
    await expect(wl.acquire()).resolves.toBeUndefined();
    expect(wl.isHeld()).toBe(false);
    await expect(wl.release()).resolves.toBeUndefined();
    expect(() => wl.dispose()).not.toThrow();
  });

  it('is silent when the request rejects', async () => {
    dev = installFakeDevice({ wakeLock: 'reject' });
    const wl = createWakeLock();
    await expect(wl.acquire()).resolves.toBeUndefined();
    expect(dev.wakeLock.requests).toBe(1);
    expect(wl.isHeld()).toBe(false);
    wl.dispose();
  });

  it('exports a shared singleton', async () => {
    dev = installFakeDevice();
    await wakeLock.acquire();
    expect(wakeLock.isHeld()).toBe(true);
    await wakeLock.release();
    expect(wakeLock.isHeld()).toBe(false);
    wakeLock.dispose();
  });
});
