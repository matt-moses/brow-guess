// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SENSOR_TIMEOUT_MS } from '../../src/config';
import {
  getScreenAngle,
  requestMotionPermission,
  subscribeOrientation,
  subscribePitch,
  watchForSensor,
} from '../../src/device/orientation';
import { installFakeDevice, type FakeDevice } from '../helpers/fakeDevice';

let dev: FakeDevice;

beforeEach(() => {
  dev = installFakeDevice();
});
afterEach(() => {
  dev.uninstall();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('requestMotionPermission', () => {
  it('returns granted when the user grants', async () => {
    dev.setPermission('granted');
    await expect(requestMotionPermission()).resolves.toBe('granted');
  });

  it('returns denied when the user denies', async () => {
    dev.setPermission('denied');
    await expect(requestMotionPermission()).resolves.toBe('denied');
  });

  it('maps a thrown error to denied', async () => {
    dev.setPermission('throw');
    await expect(requestMotionPermission()).resolves.toBe('denied');
  });

  it('maps a rejected promise to denied', async () => {
    dev.setPermission('reject');
    await expect(requestMotionPermission()).resolves.toBe('denied');
  });

  it('returns not-required when requestPermission is absent', async () => {
    dev.setPermission('absent');
    await expect(requestMotionPermission()).resolves.toBe('not-required');
  });

  it('returns not-required when DeviceOrientationEvent is missing entirely', async () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    await expect(requestMotionPermission()).resolves.toBe('not-required');
  });

  it('invokes requestPermission synchronously (inside the gesture)', async () => {
    dev.setPermission('granted');
    const p = requestMotionPermission();
    // No await yet: the browser API must already have been called.
    expect(dev.requestPermission).toHaveBeenCalledTimes(1);
    await expect(p).resolves.toBe('granted');
  });
});

describe('getScreenAngle', () => {
  it('reads screen.orientation.angle', () => {
    dev.setAngle(270);
    expect(getScreenAngle()).toBe(270);
    dev.setAngle(90);
    expect(getScreenAngle()).toBe(90);
  });

  it('falls back to window.orientation and normalizes -90 to 270', () => {
    dev.uninstall();
    dev = installFakeDevice({ screenOrientation: false });
    vi.stubGlobal('orientation', -90);
    expect(getScreenAngle()).toBe(270);
    vi.stubGlobal('orientation', 90);
    expect(getScreenAngle()).toBe(90);
  });

  it('falls back to matchMedia landscape (90) or portrait (0)', () => {
    dev.uninstall();
    dev = installFakeDevice({ screenOrientation: false });
    let landscape = true;
    const mm = vi.fn(() => ({ matches: landscape }));
    vi.stubGlobal('matchMedia', mm);
    expect(getScreenAngle()).toBe(90);
    expect(mm).toHaveBeenCalledWith('(orientation: landscape)');
    landscape = false;
    expect(getScreenAngle()).toBe(0);
  });

  it('returns 0 when nothing is available and never throws', () => {
    dev.uninstall();
    dev = installFakeDevice({ screenOrientation: false });
    expect(getScreenAngle()).toBe(0);
    vi.stubGlobal('matchMedia', () => {
      throw new Error('boom');
    });
    expect(getScreenAngle()).toBe(0);
  });
});

describe('subscribeOrientation', () => {
  it('delivers raw samples with a timestamp, nulling missing fields', () => {
    const cb = vi.fn();
    const off = subscribeOrientation(cb, { now: () => 42 });
    dev.dispatchOrientation({ alpha: 10, beta: 20, gamma: 30 });
    expect(cb).toHaveBeenLastCalledWith({ alpha: 10, beta: 20, gamma: 30 }, 42);
    dev.dispatchOrientation({ beta: 5 });
    expect(cb).toHaveBeenLastCalledWith({ alpha: null, beta: 5, gamma: null }, 42);
    off();
    off(); // idempotent
    dev.dispatchOrientation({ beta: 1, gamma: 1 });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('uses performance.now() by default (follows fake timers)', () => {
    vi.useFakeTimers();
    const times: number[] = [];
    const off = subscribeOrientation((_s, t) => times.push(t));
    dev.dispatchOrientation({ beta: 1, gamma: 1 });
    vi.advanceTimersByTime(250);
    dev.dispatchOrientation({ beta: 1, gamma: 1 });
    off();
    expect(times[1]! - times[0]!).toBeCloseTo(250, 0);
  });
});

describe('subscribePitch', () => {
  it('delivers the normalized pitch for a dispatched event', () => {
    const cb = vi.fn();
    const off = subscribePitch(cb);
    const sample = dev.dispatchPose(40, 'primary');
    expect(cb).toHaveBeenCalledTimes(1);
    const [pitch, tMs, raw] = cb.mock.calls[0] as [number, number, unknown];
    expect(pitch).toBeCloseTo(40, 6);
    expect(typeof tMs).toBe('number');
    expect(raw).toEqual(sample);
    off();
  });

  it('flips sign when the angle stub changes from 90 to 270', () => {
    // The same physical rotation of the device (gamma -60 -> -50) reads as a
    // pitch change of opposite sign on the two landscape sides.
    const pitches: (number | null)[] = [];
    const off = subscribePitch((p) => pitches.push(p));
    const a = { alpha: 0, beta: 0, gamma: -60 };
    const b = { alpha: 0, beta: 0, gamma: -50 };
    dev.setAngle(90);
    dev.dispatchOrientation(a);
    dev.dispatchOrientation(b);
    dev.setAngle(270);
    dev.dispatchOrientation(a);
    dev.dispatchOrientation(b);
    off();
    const [p90a, p90b, p270a, p270b] = pitches as number[];
    expect(p90b! - p90a!).toBeCloseTo(-10, 6);
    expect(p270b! - p270a!).toBeCloseTo(10, 6);
  });

  it('reads a tilt-down pose as positive on either side when the angle matches', () => {
    const pitches: (number | null)[] = [];
    const off = subscribePitch((p) => pitches.push(p));
    dev.setAngle(90);
    dev.dispatchPose(40, 'primary');
    dev.setAngle(270);
    dev.dispatchPose(40, 'secondary');
    off();
    expect(pitches[0]!).toBeCloseTo(40, 6);
    expect(pitches[1]!).toBeCloseTo(40, 6);
  });

  it('reports null in portrait', () => {
    const cb = vi.fn();
    const off = subscribePitch(cb);
    dev.setAngle(0);
    dev.dispatchOrientation({ alpha: 0, beta: 90, gamma: 0 });
    off();
    expect(cb.mock.calls[0]![0]).toBeNull();
  });

  it('honours an injected getAngle', () => {
    const cb = vi.fn();
    const off = subscribePitch(cb, { getAngle: () => 270 });
    dev.dispatchPose(-30, 'secondary');
    off();
    expect(cb.mock.calls[0]![0]).toBeCloseTo(-30, 6);
  });

  it('stops delivery after unsubscribe', () => {
    const cb = vi.fn();
    const off = subscribePitch(cb);
    dev.dispatchPose(10);
    off();
    dev.dispatchPose(20);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('watchForSensor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('resolves false after the timeout when no event arrives', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    let settled: boolean | undefined;
    void watchForSensor(1000).then((v) => (settled = v));
    await vi.advanceTimersByTimeAsync(999);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith('deviceorientation', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('defaults to SENSOR_TIMEOUT_MS', async () => {
    let settled: boolean | undefined;
    void watchForSensor().then((v) => (settled = v));
    await vi.advanceTimersByTimeAsync(SENSOR_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(false);
  });

  it('resolves true when a real event arrives first, and clears the timer', async () => {
    const p = watchForSensor(1000);
    await vi.advanceTimersByTimeAsync(200);
    dev.dispatchOrientation({ alpha: 0, beta: 10, gamma: 20 });
    await expect(p).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not count an all-null event (desktop Chrome)', async () => {
    let settled: boolean | undefined;
    void watchForSensor(1000).then((v) => (settled = v));
    dev.dispatchOrientation({ alpha: null, beta: null, gamma: null });
    dev.dispatchOrientation({ beta: 10 }); // gamma still null
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);
  });

  it('ignores later events after resolving', async () => {
    const p = watchForSensor(1000);
    dev.dispatchOrientation({ beta: 1, gamma: 1 });
    dev.dispatchOrientation({ beta: 2, gamma: 2 });
    await expect(p).resolves.toBe(true);
  });
});
