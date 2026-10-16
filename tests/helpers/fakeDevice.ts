/**
 * Fake phone hardware for jsdom tests (Phase 3 device adapters; reused by
 * Phase 4 screen/flow tests).
 *
 * Usage:
 *   // @vitest-environment jsdom
 *   let dev: FakeDevice;
 *   beforeEach(() => { dev = installFakeDevice({ permission: 'granted' }); });
 *   afterEach(() => dev.uninstall());
 *
 * install replaces, for the duration of the test, with restorable stubs:
 *   - window.DeviceOrientationEvent: a fresh minimal class (Event + alpha/beta/
 *     gamma/absolute) whose static requestPermission follows `setPermission`.
 *   - screen.orientation: an EventTarget with `angle`, `type`, and `lock` /
 *     `unlock` spies; `setAngle` updates it and dispatches 'change'.
 *   - navigator.wakeLock: `request` spy returning fake sentinels; hiding the
 *     page releases active sentinels like a real browser.
 *   - navigator.vibrate: a vi.fn returning true.
 *   - window.AudioContext (or webkitAudioContext): a recording fake.
 *   - Element.prototype.requestFullscreen, document.exitFullscreen,
 *     document.fullscreenElement (or the webkit-prefixed variants).
 *   - document.visibilityState / document.hidden, driven by `setVisibility`.
 * uninstall() restores every original property (in reverse order).
 *
 * Each feature takes a mode via options: 'ok' (default), 'reject' (the API
 * exists but its promise rejects), 'absent' (the API is missing), and for
 * fullscreen/audio also 'webkit' (only the prefixed API exists).
 */
import { vi, type Mock } from 'vitest';
import type { LandscapeSide, OrientationSample } from '../../src/game/normalize';
import { poseSample } from '../game/pose';

export type PermissionMode = 'granted' | 'denied' | 'throw' | 'reject' | 'absent';
export type ApiMode = 'ok' | 'reject' | 'absent';
export type PrefixableMode = ApiMode | 'webkit';
export type Visibility = 'visible' | 'hidden';

export interface FakeDeviceOptions {
  /** DeviceOrientationEvent.requestPermission behaviour. Default 'absent' (Android-like). */
  permission?: PermissionMode;
  /** Initial screen.orientation.angle. Default 90 (landscape-primary). */
  angle?: number;
  /** Whether screen.orientation exists. Default true. */
  screenOrientation?: boolean;
  /** screen.orientation.lock behaviour. Default 'ok'. */
  orientationLock?: ApiMode;
  /** navigator.wakeLock behaviour. Default 'ok'. */
  wakeLock?: ApiMode;
  /** navigator.vibrate presence. Default 'ok' ('reject' makes it throw). */
  vibrate?: ApiMode;
  /** AudioContext availability. Default 'ok'. */
  audio?: 'ok' | 'absent' | 'webkit';
  /** Initial AudioContext.state for new contexts. Default 'suspended'. */
  audioState?: AudioContextState;
  /** Fullscreen API behaviour. Default 'ok'. */
  fullscreen?: PrefixableMode;
  /** Initial document visibility. Default 'visible'. */
  visibility?: Visibility;
}

/** Minimal DeviceOrientationEvent for jsdom. */
export interface FakeDeviceOrientationEventInit extends EventInit {
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean;
}

export interface FakeSentinel extends EventTarget {
  readonly type: 'screen';
  released: boolean;
  release: Mock<() => Promise<void>>;
}

export interface FakeOscillator {
  type: string;
  frequency: FakeParam;
  connect: Mock;
  start: Mock;
  stop: Mock;
}

export interface FakeGain {
  gain: FakeParam;
  connect: Mock;
}

export interface FakeParam {
  value: number;
  setValueAtTime: Mock;
  linearRampToValueAtTime: Mock;
  exponentialRampToValueAtTime: Mock;
}

export interface FakeAudioContextInstance {
  state: AudioContextState;
  currentTime: number;
  destination: object;
  resume: Mock<() => Promise<void>>;
  close: Mock<() => Promise<void>>;
  createOscillator: Mock<() => FakeOscillator>;
  createGain: Mock<() => FakeGain>;
}

export interface FakeScreenOrientation extends EventTarget {
  angle: number;
  type: string;
  lock: Mock<(o: string) => Promise<void>>;
  unlock: Mock<() => void>;
}

export interface FakeDevice {
  /** Change DeviceOrientationEvent.requestPermission behaviour. */
  setPermission(mode: PermissionMode): void;
  /** Spy for requestPermission (re-created by setPermission; undefined when absent). */
  readonly requestPermission: Mock<() => Promise<string>> | undefined;
  /** Set screen.orientation.angle (and type) and dispatch 'change' on it. */
  setAngle(angle: number): void;
  /** The fake screen.orientation, or undefined when disabled. */
  readonly screenOrientation: FakeScreenOrientation | undefined;
  /** Dispatch a deviceorientation event on window. Missing fields are null. */
  dispatchOrientation(sample?: Partial<OrientationSample>): Event;
  /**
   * Dispatch the raw sample a real phone would report for a physical forehead
   * pose (see tests/game/pose.ts). `side` defaults to the side implied by the
   * current angle (270 = secondary, else primary). Does not change the angle.
   */
  dispatchPose(pitchDeg: number, side?: LandscapeSide, rollDeg?: number): OrientationSample;
  /** Set document.visibilityState/hidden and dispatch visibilitychange. Hiding releases wake locks. */
  setVisibility(state: Visibility): void;
  wakeLock: {
    /** navigator.wakeLock.request spy (undefined when absent). */
    readonly request: Mock<(type: string) => Promise<FakeSentinel>> | undefined;
    /** Number of request() calls. */
    readonly requests: number;
    /** Number of sentinel releases (by code or by hiding the page). */
    readonly releases: number;
    /** Number of currently unreleased sentinels. */
    readonly active: number;
    readonly sentinels: readonly FakeSentinel[];
  };
  /** navigator.vibrate spy (undefined when absent). */
  readonly vibrate: Mock<(p: number | number[]) => boolean> | undefined;
  audioContext: {
    /** Every AudioContext constructed. */
    readonly instances: readonly FakeAudioContextInstance[];
    /** Most recently constructed context. */
    readonly current: FakeAudioContextInstance | undefined;
    readonly oscillators: readonly FakeOscillator[];
    readonly gains: readonly FakeGain[];
    /** Total resume() calls across contexts. */
    readonly resumeCalls: number;
  };
  fullscreen: {
    /** requestFullscreen (or webkitRequestFullscreen) spy; undefined when absent. */
    readonly requestFullscreen: Mock | undefined;
    /** exitFullscreen (or webkitExitFullscreen) spy; undefined when absent. */
    readonly exitFullscreen: Mock | undefined;
    /** screen.orientation.lock / unlock spies. */
    readonly lock: Mock | undefined;
    readonly unlock: Mock | undefined;
    /** Current fullscreen element. */
    readonly element: Element | null;
  };
  /** Restore all stubbed globals. Safe to call twice. */
  uninstall(): void;
}

type Restore = () => void;

export function installFakeDevice(opts: FakeDeviceOptions = {}): FakeDevice {
  const restores: Restore[] = [];
  const stubbed = new Set<string>();
  let ids = 0;
  const objIds = new WeakMap<object, number>();

  /** Define `key` on `obj` (as an own property), remembering the original once. */
  function stub(obj: object, key: string, desc: PropertyDescriptor): void {
    let id = objIds.get(obj);
    if (id === undefined) {
      id = ++ids;
      objIds.set(obj, id);
    }
    const tag = `${id}:${key}`;
    if (!stubbed.has(tag)) {
      stubbed.add(tag);
      const original = Object.getOwnPropertyDescriptor(obj, key);
      restores.push(() => {
        if (original) Object.defineProperty(obj, key, original);
        else Reflect.deleteProperty(obj, key);
      });
    }
    Object.defineProperty(obj, key, { configurable: true, enumerable: true, ...desc });
  }
  const stubValue = (obj: object, key: string, value: unknown): void =>
    stub(obj, key, { value, writable: true });

  // --- DeviceOrientationEvent + permission -------------------------------
  class FakeDeviceOrientationEvent extends Event {
    readonly alpha: number | null;
    readonly beta: number | null;
    readonly gamma: number | null;
    readonly absolute: boolean;
    constructor(type: string, init: FakeDeviceOrientationEventInit = {}) {
      super(type, init);
      this.alpha = init.alpha ?? null;
      this.beta = init.beta ?? null;
      this.gamma = init.gamma ?? null;
      this.absolute = init.absolute ?? false;
    }
  }
  stubValue(window, 'DeviceOrientationEvent', FakeDeviceOrientationEvent);

  let requestPermission: Mock<() => Promise<string>> | undefined;
  function setPermission(mode: PermissionMode): void {
    if (mode === 'absent') {
      requestPermission = undefined;
      Reflect.deleteProperty(FakeDeviceOrientationEvent, 'requestPermission');
      return;
    }
    requestPermission = vi.fn((): Promise<string> => {
      if (mode === 'throw') throw new Error('requestPermission threw');
      if (mode === 'reject') return Promise.reject(new Error('NotAllowedError'));
      return Promise.resolve(mode);
    });
    Object.defineProperty(FakeDeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      writable: true,
      value: requestPermission,
    });
  }
  setPermission(opts.permission ?? 'absent');

  // --- screen.orientation --------------------------------------------------
  let screenOrientation: FakeScreenOrientation | undefined;
  const typeFor = (a: number): string => {
    const n = ((Math.round(a) % 360) + 360) % 360;
    if (n === 90) return 'landscape-primary';
    if (n === 270) return 'landscape-secondary';
    if (n === 180) return 'portrait-secondary';
    return 'portrait-primary';
  };
  if (opts.screenOrientation !== false) {
    const lockMode = opts.orientationLock ?? 'ok';
    const so = new EventTarget() as FakeScreenOrientation;
    so.angle = opts.angle ?? 90;
    so.type = typeFor(so.angle);
    if (lockMode !== 'absent') {
      so.lock = vi.fn((): Promise<void> =>
        lockMode === 'reject' ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve(),
      );
      so.unlock = vi.fn((): void => {
        if (lockMode === 'reject') throw new Error('unlock failed');
      });
    }
    screenOrientation = so;
  }
  stubValue(window.screen, 'orientation', screenOrientation);

  function setAngle(angle: number): void {
    if (!screenOrientation) return;
    screenOrientation.angle = angle;
    screenOrientation.type = typeFor(angle);
    screenOrientation.dispatchEvent(new Event('change'));
  }

  // --- visibility -----------------------------------------------------------
  let visibility: Visibility = opts.visibility ?? 'visible';
  stub(document, 'visibilityState', { get: () => visibility });
  stub(document, 'hidden', { get: () => visibility === 'hidden' });

  // --- wake lock ------------------------------------------------------------
  const sentinels: FakeSentinel[] = [];
  let wlRequests = 0;
  let wlReleases = 0;
  let wlRequest: Mock<(type: string) => Promise<FakeSentinel>> | undefined;
  const wlMode = opts.wakeLock ?? 'ok';
  const releaseSentinel = (s: FakeSentinel): void => {
    if (s.released) return;
    s.released = true;
    wlReleases++;
    s.dispatchEvent(new Event('release'));
  };
  if (wlMode !== 'absent') {
    wlRequest = vi.fn((): Promise<FakeSentinel> => {
      wlRequests++;
      if (wlMode === 'reject') return Promise.reject(new Error('NotAllowedError'));
      const s = new EventTarget() as FakeSentinel;
      Object.defineProperty(s, 'type', { value: 'screen' });
      s.released = false;
      s.release = vi.fn((): Promise<void> => {
        releaseSentinel(s);
        return Promise.resolve();
      });
      sentinels.push(s);
      return Promise.resolve(s);
    });
    stubValue(navigator, 'wakeLock', { request: wlRequest });
  } else {
    stubValue(navigator, 'wakeLock', undefined);
  }

  function setVisibility(state: Visibility): void {
    visibility = state;
    if (state === 'hidden') sentinels.forEach(releaseSentinel);
    document.dispatchEvent(new Event('visibilitychange'));
  }

  // --- vibrate --------------------------------------------------------------
  const vibMode = opts.vibrate ?? 'ok';
  const vibrate =
    vibMode === 'absent'
      ? undefined
      : vi.fn<(p: number | number[]) => boolean>(() => {
          if (vibMode === 'reject') throw new Error('vibrate blocked');
          return true;
        });
  stubValue(navigator, 'vibrate', vibrate);

  // --- audio ----------------------------------------------------------------
  const audioInstances: FakeAudioContextInstance[] = [];
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  let resumeCalls = 0;
  const makeParam = (value = 0): FakeParam => ({
    value,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const initialAudioState = opts.audioState ?? 'suspended';
  class FakeAudioContext implements FakeAudioContextInstance {
    state: AudioContextState = initialAudioState;
    currentTime = 0;
    destination = {};
    resume = vi.fn((): Promise<void> => {
      resumeCalls++;
      this.state = 'running';
      return Promise.resolve();
    });
    close = vi.fn((): Promise<void> => {
      this.state = 'closed';
      return Promise.resolve();
    });
    createOscillator = vi.fn((): FakeOscillator => {
      const o: FakeOscillator = {
        type: 'sine',
        frequency: makeParam(440),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(o);
      return o;
    });
    createGain = vi.fn((): FakeGain => {
      const g: FakeGain = { gain: makeParam(1), connect: vi.fn() };
      gains.push(g);
      return g;
    });
    constructor() {
      audioInstances.push(this);
    }
  }
  const audioMode = opts.audio ?? 'ok';
  stubValue(window, 'AudioContext', audioMode === 'ok' ? FakeAudioContext : undefined);
  stubValue(window, 'webkitAudioContext', audioMode === 'webkit' ? FakeAudioContext : undefined);

  // --- fullscreen -----------------------------------------------------------
  const fsMode = opts.fullscreen ?? 'ok';
  let fsElement: Element | null = null;
  const setFsElement = (el: Element | null): void => {
    fsElement = el;
  };
  let requestFullscreen: Mock | undefined;
  let exitFullscreen: Mock | undefined;
  if (fsMode !== 'absent') {
    const prefix = fsMode === 'webkit';
    requestFullscreen = vi.fn(function (this: Element): Promise<void> {
      if (fsMode === 'reject') return Promise.reject(new Error('fullscreen denied'));
      setFsElement(this);
      document.dispatchEvent(new Event(prefix ? 'webkitfullscreenchange' : 'fullscreenchange'));
      return Promise.resolve();
    });
    exitFullscreen = vi.fn((): Promise<void> => {
      if (fsMode === 'reject') return Promise.reject(new Error('exit failed'));
      fsElement = null;
      document.dispatchEvent(new Event(prefix ? 'webkitfullscreenchange' : 'fullscreenchange'));
      return Promise.resolve();
    });
    const req = prefix ? 'webkitRequestFullscreen' : 'requestFullscreen';
    const exit = prefix ? 'webkitExitFullscreen' : 'exitFullscreen';
    const el = prefix ? 'webkitFullscreenElement' : 'fullscreenElement';
    stubValue(Element.prototype, req, requestFullscreen);
    stubValue(document, exit, exitFullscreen);
    stub(document, el, { get: () => fsElement });
  }

  // --- helpers --------------------------------------------------------------
  function dispatchOrientation(sample: Partial<OrientationSample> = {}): Event {
    const ev = new FakeDeviceOrientationEvent('deviceorientation', {
      alpha: sample.alpha ?? null,
      beta: sample.beta ?? null,
      gamma: sample.gamma ?? null,
    });
    window.dispatchEvent(ev);
    return ev;
  }

  function dispatchPose(pitchDeg: number, side?: LandscapeSide, rollDeg = 0): OrientationSample {
    const angle = screenOrientation?.angle ?? 90;
    const s = side ?? (((angle % 360) + 360) % 360 === 270 ? 'secondary' : 'primary');
    const sample = poseSample(pitchDeg, s, rollDeg);
    dispatchOrientation(sample);
    return sample;
  }

  let installed = true;
  function uninstall(): void {
    if (!installed) return;
    installed = false;
    while (restores.length) restores.pop()?.();
  }

  return {
    setPermission,
    get requestPermission() {
      return requestPermission;
    },
    setAngle,
    screenOrientation,
    dispatchOrientation,
    dispatchPose,
    setVisibility,
    wakeLock: {
      request: wlRequest,
      get requests() {
        return wlRequests;
      },
      get releases() {
        return wlReleases;
      },
      get active() {
        return sentinels.filter((s) => !s.released).length;
      },
      sentinels,
    },
    vibrate,
    audioContext: {
      instances: audioInstances,
      get current() {
        return audioInstances[audioInstances.length - 1];
      },
      oscillators,
      gains,
      get resumeCalls() {
        return resumeCalls;
      },
    },
    fullscreen: {
      requestFullscreen,
      exitFullscreen,
      lock: screenOrientation?.lock,
      unlock: screenOrientation?.unlock,
      get element() {
        return fsElement;
      },
    },
    uninstall,
  };
}
