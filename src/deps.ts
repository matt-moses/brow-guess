/**
 * Injectable dependencies for the app controller and screens. Every field has
 * a real default (see defaultDeps); tests replace the clock, RNG, RAF, storage,
 * confirm dialog, decks, or individual device adapters.
 */
import { ROUND_SECONDS } from './config.ts';
import { decks as bundledDecks, type Deck } from './decks/index.ts';
import { playSound, unlockAudio, type SoundName } from './device/audio.ts';
import {
  enterFullscreen,
  exitFullscreen,
  lockLandscape,
  unlockOrientation,
} from './device/fullscreen.ts';
import { pulse, type HapticPattern } from './device/haptics.ts';
import {
  getScreenAngle,
  requestMotionPermission,
  subscribeOrientation,
  subscribePitch,
  type MotionPermission,
  type OrientationListener,
  type PitchListener,
  type SubscribeOptions,
  type SubscribePitchOptions,
} from './device/orientation.ts';
import { createWakeLock, type WakeLockController } from './device/wakelock.ts';
import type { Rng } from './game/shuffle.ts';
import { inPageConfirm } from './ui/confirm.ts';

export interface DeviceDeps {
  requestMotionPermission: () => Promise<MotionPermission>;
  subscribeOrientation: (cb: OrientationListener, opts?: SubscribeOptions) => () => void;
  subscribePitch: (cb: PitchListener, opts?: SubscribePitchOptions) => () => void;
  getScreenAngle: () => number;
  unlockAudio: () => void;
  playSound: (name: SoundName) => void;
  pulse: (pattern: HapticPattern) => void;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  lockLandscape: () => Promise<void>;
  unlockOrientation: () => Promise<void>;
  wakeLock: WakeLockController;
}

/** The subset of Storage the app uses (last-picked deck only, PRD §7.5). */
export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/** Ask the player to confirm; resolves true to proceed. */
export type ConfirmFn = (
  message: string,
  opts: { confirmLabel: string; cancelLabel: string },
) => Promise<boolean>;

export interface AppDeps {
  /** Monotonic clock in ms. The only time source for the round and tilt detector. */
  now: () => number;
  rng: Rng;
  raf: (cb: FrameRequestCallback) => number;
  cancelRaf: (id: number) => void;
  device: DeviceDeps;
  storage: StorageLike | null;
  confirm: ConfirmFn;
  decks: readonly Deck[];
  roundMs: number;
}

export type AppDepsInput = Partial<Omit<AppDeps, 'device'>> & { device?: Partial<DeviceDeps> };

function defaultStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function defaultNow(): number {
  return performance.now();
}

export function defaultDevice(): DeviceDeps {
  return {
    requestMotionPermission,
    subscribeOrientation,
    subscribePitch,
    getScreenAngle,
    unlockAudio,
    playSound,
    pulse,
    enterFullscreen: () => enterFullscreen(),
    exitFullscreen,
    lockLandscape,
    unlockOrientation,
    wakeLock: createWakeLock(),
  };
}

/** Fill in real implementations for anything not supplied. */
export function resolveDeps(input: AppDepsInput = {}): AppDeps {
  return {
    now: input.now ?? defaultNow,
    rng: input.rng ?? Math.random,
    raf: input.raf ?? ((cb) => window.requestAnimationFrame(cb)),
    cancelRaf: input.cancelRaf ?? ((id) => window.cancelAnimationFrame(id)),
    device: { ...defaultDevice(), ...input.device },
    storage: input.storage === undefined ? defaultStorage() : input.storage,
    confirm: input.confirm ?? inPageConfirm,
    decks: input.decks ?? bundledDecks,
    roundMs: input.roundMs ?? ROUND_SECONDS * 1000,
  };
}
