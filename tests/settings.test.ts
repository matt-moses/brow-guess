import { describe, expect, it } from 'vitest';
import { ROUND_SECONDS, TILT_REARM_DEG, TILT_TRIGGER_DEG } from '../src/config';
import type { StorageLike } from '../src/deps';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  SENSITIVITIES,
  SENSITIVITY_TILT,
  SETTINGS_KEY,
} from '../src/settings';

function memoryStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SETTINGS_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('settings', () => {
  it('defaults match config', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      roundSeconds: ROUND_SECONDS,
      sound: true,
      sensitivity: 'normal',
    });
    expect(SENSITIVITY_TILT.normal).toEqual({
      triggerDeg: TILT_TRIGGER_DEG,
      rearmDeg: TILT_REARM_DEG,
    });
  });

  it('keeps every sensitivity sane, and higher means a smaller tilt', () => {
    for (const s of SENSITIVITIES) {
      const { triggerDeg, rearmDeg } = SENSITIVITY_TILT[s];
      expect(rearmDeg, s).toBeLessThan(triggerDeg);
      expect(triggerDeg, s).toBeLessThan(90);
    }
    expect(SENSITIVITY_TILT.high.triggerDeg).toBeLessThan(SENSITIVITY_TILT.normal.triggerDeg);
    expect(SENSITIVITY_TILT.normal.triggerDeg).toBeLessThan(SENSITIVITY_TILT.low.triggerDeg);
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const s = { roundSeconds: 90, sound: false, sensitivity: 'high' } as const;
    saveSettings(storage, s);
    expect(loadSettings(storage)).toEqual(s);
  });

  it('falls back to defaults for missing storage, bad JSON and bad fields', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage('{not json'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage('42'))).toEqual(DEFAULT_SETTINGS);
    expect(
      loadSettings(memoryStorage('{"roundSeconds":45,"sound":"no","sensitivity":"max"}')),
    ).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memoryStorage('{"sound":false}'))).toEqual({
      ...DEFAULT_SETTINGS,
      sound: false,
    });
  });

  it('survives a throwing storage', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(storage, DEFAULT_SETTINGS)).not.toThrow();
  });
});
