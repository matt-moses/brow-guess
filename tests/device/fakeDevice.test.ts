// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { installFakeDevice } from '../helpers/fakeDevice';

describe('fakeDevice', () => {
  it('restores every stubbed global on uninstall', () => {
    const originalDOE = window.DeviceOrientationEvent;
    const dev = installFakeDevice({ permission: 'granted' });
    expect(window.DeviceOrientationEvent).not.toBe(originalDOE);
    expect('wakeLock' in navigator && navigator.wakeLock).toBeTruthy();
    expect(document.visibilityState).toBe('visible');
    dev.setVisibility('hidden');
    expect(document.hidden).toBe(true);
    dev.uninstall();
    dev.uninstall(); // safe twice
    expect(window.DeviceOrientationEvent).toBe(originalDOE);
    expect(Object.getOwnPropertyDescriptor(navigator, 'wakeLock')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(navigator, 'vibrate')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(screen, 'orientation')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(document, 'visibilityState')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen')).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(window, 'AudioContext')).toBeUndefined();
  });

  it('setAngle dispatches change on screen.orientation', () => {
    const dev = installFakeDevice();
    const onChange = vi.fn();
    dev.screenOrientation!.addEventListener('change', onChange);
    dev.setAngle(270);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.orientation.angle).toBe(270);
    expect(screen.orientation.type).toBe('landscape-secondary');
    dev.setAngle(180);
    expect(screen.orientation.type).toBe('portrait-secondary');
    dev.setAngle(0);
    expect(screen.orientation.type).toBe('portrait-primary');
    dev.uninstall();
  });

  it('dispatchPose infers the side from the current angle', () => {
    const dev = installFakeDevice({ angle: 270 });
    const seen = vi.fn();
    window.addEventListener('deviceorientation', seen);
    const s = dev.dispatchPose(0);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(s.gamma).not.toBeNull();
    window.removeEventListener('deviceorientation', seen);
    dev.uninstall();
  });
});
