/**
 * Player settings (round length, sound, tilt sensitivity), stored as one JSON
 * object in localStorage. Loading is forgiving: a missing, corrupt or
 * out-of-range field falls back to its default, so old or hand-edited values
 * never break the game.
 */
import { ROUND_SECONDS, TILT_REARM_DEG, TILT_TRIGGER_DEG } from './config.ts';
import type { StorageLike } from './deps.ts';
import type { TiltConfig } from './game/tilt.ts';

export const SETTINGS_KEY = 'settings';

export const ROUND_SECONDS_OPTIONS = [30, 60, 90, 120] as const;
export const SENSITIVITIES = ['low', 'normal', 'high'] as const;

export type RoundSeconds = (typeof ROUND_SECONDS_OPTIONS)[number];
export type Sensitivity = (typeof SENSITIVITIES)[number];

export interface Settings {
  roundSeconds: RoundSeconds;
  sound: boolean;
  sensitivity: Sensitivity;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  roundSeconds: ROUND_SECONDS,
  sound: true,
  sensitivity: 'normal',
};

/** Tilt thresholds per sensitivity. Higher sensitivity = a smaller tilt fires. */
export const SENSITIVITY_TILT: Record<Sensitivity, Pick<TiltConfig, 'triggerDeg' | 'rearmDeg'>> = {
  low: { triggerDeg: 45, rearmDeg: 20 },
  normal: { triggerDeg: TILT_TRIGGER_DEG, rearmDeg: TILT_REARM_DEG },
  high: { triggerDeg: 25, rearmDeg: 10 },
};

function isRoundSeconds(v: unknown): v is RoundSeconds {
  return (ROUND_SECONDS_OPTIONS as readonly unknown[]).includes(v);
}

function isSensitivity(v: unknown): v is Sensitivity {
  return (SENSITIVITIES as readonly unknown[]).includes(v);
}

export function loadSettings(storage: StorageLike | null): Settings {
  let raw: unknown = null;
  try {
    raw = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
  } catch {
    // unreadable storage or bad JSON: defaults
  }
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    roundSeconds: isRoundSeconds(s.roundSeconds) ? s.roundSeconds : DEFAULT_SETTINGS.roundSeconds,
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    sensitivity: isSensitivity(s.sensitivity) ? s.sensitivity : DEFAULT_SETTINGS.sensitivity,
  };
}

export function saveSettings(storage: StorageLike | null, settings: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // private mode / quota: settings last for this session only
  }
}
