// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  lockLandscape,
  unlockOrientation,
} from '../../src/device/fullscreen';
import { installFakeDevice, type FakeDevice } from '../helpers/fakeDevice';

let dev: FakeDevice | undefined;
afterEach(() => {
  dev?.uninstall();
  dev = undefined;
});

describe('fullscreen', () => {
  it('enters and exits fullscreen on the document element', async () => {
    dev = installFakeDevice();
    const p = enterFullscreen();
    // Invoked synchronously so the gesture activation is kept.
    expect(dev.fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
    await p;
    expect(dev.fullscreen.element).toBe(document.documentElement);
    expect(isFullscreen()).toBe(true);
    await exitFullscreen();
    expect(dev.fullscreen.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(isFullscreen()).toBe(false);
  });

  it('enters fullscreen on a given element', async () => {
    dev = installFakeDevice();
    const el = document.createElement('div');
    await enterFullscreen(el);
    expect(dev.fullscreen.element).toBe(el);
  });

  it('exit is a no-op when not fullscreen', async () => {
    dev = installFakeDevice();
    await exitFullscreen();
    expect(dev.fullscreen.exitFullscreen).not.toHaveBeenCalled();
  });

  it('uses webkit-prefixed APIs as a fallback', async () => {
    dev = installFakeDevice({ fullscreen: 'webkit' });
    await enterFullscreen();
    expect(dev.fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(isFullscreen()).toBe(true);
    await exitFullscreen();
    expect(dev.fullscreen.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(isFullscreen()).toBe(false);
  });

  it('swallows rejections', async () => {
    dev = installFakeDevice({ fullscreen: 'reject', orientationLock: 'reject' });
    await expect(enterFullscreen()).resolves.toBeUndefined();
    await expect(lockLandscape()).resolves.toBeUndefined();
    await expect(unlockOrientation()).resolves.toBeUndefined();
    expect(dev.fullscreen.lock).toHaveBeenCalledWith('landscape');
    expect(dev.fullscreen.unlock).toHaveBeenCalled();
  });

  it('swallows exit rejections', async () => {
    dev = installFakeDevice({ fullscreen: 'reject' });
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.body,
    });
    await expect(exitFullscreen()).resolves.toBeUndefined();
    expect(dev.fullscreen.exitFullscreen).toHaveBeenCalled();
  });

  it('is fine when the APIs are missing', async () => {
    dev = installFakeDevice({ fullscreen: 'absent', screenOrientation: false });
    await expect(enterFullscreen()).resolves.toBeUndefined();
    await expect(exitFullscreen()).resolves.toBeUndefined();
    await expect(lockLandscape()).resolves.toBeUndefined();
    await expect(unlockOrientation()).resolves.toBeUndefined();
    expect(isFullscreen()).toBe(false);
  });

  it('is fine when orientation exists without lock/unlock', async () => {
    dev = installFakeDevice({ orientationLock: 'absent' });
    await expect(lockLandscape()).resolves.toBeUndefined();
    await expect(unlockOrientation()).resolves.toBeUndefined();
  });

  it('locks and unlocks landscape', async () => {
    dev = installFakeDevice();
    await lockLandscape();
    await unlockOrientation();
    expect(dev.fullscreen.lock).toHaveBeenCalledWith('landscape');
    expect(dev.fullscreen.unlock).toHaveBeenCalledTimes(1);
  });
});
