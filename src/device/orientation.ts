/**
 * Device-orientation adapter (FR-4, FR-15, FR-16).
 *
 * Every function feature-detects, never throws, and reads browser globals
 * lazily at call time (never at import time), so tests can install stubs per
 * test (see tests/helpers/fakeDevice.ts).
 */
import { SENSOR_TIMEOUT_MS } from '../config';
import { normalizePitch, type OrientationSample } from '../game/normalize';

export type { OrientationSample };

export type MotionPermission = 'granted' | 'denied' | 'not-required';

/** Callback for raw samples. `tMs` is a monotonic timestamp (performance.now() base). */
export type OrientationListener = (sample: OrientationSample, tMs: number) => void;

/** Callback for normalized pitch (degrees; + = toward floor/correct, - = toward ceiling/pass). */
export type PitchListener = (pitch: number | null, tMs: number, sample: OrientationSample) => void;

export interface SubscribeOptions {
  /** Clock used when the event timestamp is unusable. Defaults to performance.now(). */
  now?: () => number;
}

export interface SubscribePitchOptions extends SubscribeOptions {
  /** Current screen angle; read on every event. Defaults to getScreenAngle(). */
  getAngle?: () => number;
}

interface PermissionCapableCtor {
  requestPermission?: () => Promise<string> | string;
}

type Unsubscribe = () => void;
const noop: Unsubscribe = () => {};

function defaultNow(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch {
    // fall through
  }
  return Date.now();
}

function finiteOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function getWindow(): Window | undefined {
  return typeof window !== 'undefined' ? window : undefined;
}

/**
 * Ask for motion-sensor access (iOS 13+). Returns 'not-required' where the
 * browser has no permission gate.
 *
 * IMPORTANT: call this FIRST in the user-gesture handler (deck tap), before
 * any `await`. iOS only shows the prompt when `requestPermission()` runs inside
 * the gesture; this function invokes it synchronously before returning.
 * Rejections and thrown errors map to 'denied'.
 */
export function requestMotionPermission(): Promise<MotionPermission> {
  let pending: Promise<string> | string;
  try {
    const ctor = (globalThis as { DeviceOrientationEvent?: PermissionCapableCtor })
      .DeviceOrientationEvent;
    const request = ctor?.requestPermission;
    if (typeof request !== 'function') return Promise.resolve('not-required');
    pending = request.call(ctor);
  } catch {
    return Promise.resolve('denied');
  }
  return Promise.resolve(pending).then(
    (result): MotionPermission => (result === 'granted' ? 'granted' : 'denied'),
    (): MotionPermission => 'denied',
  );
}

/** Normalize an angle into [0, 360) (so legacy -90 becomes 270). */
function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

/**
 * Current screen orientation angle in degrees, in [0, 360): 90 is
 * landscape-primary, 270 landscape-secondary, 0/180 portrait. Uses
 * `screen.orientation.angle`, then legacy `window.orientation`, then
 * `matchMedia('(orientation: landscape)')` (assumed 90), else 0.
 */
export function getScreenAngle(): number {
  try {
    const g = globalThis as {
      screen?: { orientation?: { angle?: unknown } };
      orientation?: unknown;
      matchMedia?: (query: string) => { matches: boolean };
    };
    const angle = g.screen?.orientation?.angle;
    if (typeof angle === 'number' && Number.isFinite(angle)) return normalizeAngle(angle);
    const legacy = g.orientation;
    if (typeof legacy === 'number' && Number.isFinite(legacy)) return normalizeAngle(legacy);
    if (typeof g.matchMedia === 'function') {
      return g.matchMedia('(orientation: landscape)').matches ? 90 : 0;
    }
  } catch {
    // fall through
  }
  return 0;
}

/**
 * Pick a timestamp on the performance.now() base. Real browsers give
 * `event.timeStamp` on that base; jsdom uses epoch ms, and fake timers do not
 * move it, so anything not close to `now()` falls back to `now()`.
 */
function eventTime(e: Event, now: () => number): number {
  const t = now();
  const ts = e.timeStamp;
  if (typeof ts === 'number' && Number.isFinite(ts) && ts > 0 && ts <= t + 1 && t - ts < 1000) {
    return ts;
  }
  return t;
}

/**
 * Subscribe to raw `deviceorientation` samples (e.g. for the ready screen's
 * isUprightLandscape check). Returns an unsubscribe function (idempotent).
 */
export function subscribeOrientation(
  cb: OrientationListener,
  opts: SubscribeOptions = {},
): Unsubscribe {
  const win = getWindow();
  if (!win || typeof win.addEventListener !== 'function') return noop;
  const now = opts.now ?? defaultNow;
  const handler = (e: Event): void => {
    const ev = e as Partial<DeviceOrientationEvent> & Event;
    const sample: OrientationSample = {
      alpha: finiteOrNull(ev.alpha),
      beta: finiteOrNull(ev.beta),
      gamma: finiteOrNull(ev.gamma),
    };
    cb(sample, eventTime(e, now));
  };
  try {
    win.addEventListener('deviceorientation', handler);
  } catch {
    return noop;
  }
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    try {
      win.removeEventListener('deviceorientation', handler);
    } catch {
      // ignore
    }
  };
}

/**
 * Subscribe to normalized forehead-pose pitch. Each event is normalized with
 * the screen angle current at that moment (so rotating 90 -> 270 flips the
 * sign correctly). Pitch is null in portrait or when beta/gamma are missing.
 */
export function subscribePitch(cb: PitchListener, opts: SubscribePitchOptions = {}): Unsubscribe {
  const getAngle = opts.getAngle ?? getScreenAngle;
  return subscribeOrientation((sample, tMs) => {
    cb(normalizePitch(sample, getAngle()), tMs, sample);
  }, opts);
}

/**
 * Resolve true on the first `deviceorientation` event carrying non-null
 * beta and gamma, or false after `timeoutMs` (FR-16). Events with null
 * readings (desktop Chrome fires one) do not count. The listener and timer are
 * cleaned up either way.
 */
export function watchForSensor(timeoutMs: number = SENSOR_TIMEOUT_MS): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false;
    let unsubscribe: Unsubscribe = noop;
    const finish = (result: boolean): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(result);
    };
    unsubscribe = subscribeOrientation((sample) => {
      if (sample.beta !== null && sample.gamma !== null) finish(true);
    });
    // Events are async, so finish() can only run after `timer` is assigned.
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}
