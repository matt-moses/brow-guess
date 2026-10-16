import { describe, expect, it } from 'vitest';
import * as config from '../src/config.ts';

describe('config', () => {
  it('names the app', () => {
    expect(config.APP_NAME).toBe('Brow Guess');
  });

  it('has positive numeric tunables', () => {
    const numeric = Object.entries(config).filter(([, v]) => typeof v === 'number');
    expect(numeric.length).toBeGreaterThanOrEqual(10);
    for (const [name, value] of numeric) {
      expect(value, name).toBeGreaterThan(0);
      expect(Number.isFinite(value), name).toBe(true);
    }
  });

  it('keeps tilt hysteresis sane', () => {
    expect(config.TILT_REARM_DEG).toBeLessThan(config.TILT_TRIGGER_DEG);
    expect(config.TILT_TRIGGER_DEG).toBeLessThan(90);
    expect(config.UPRIGHT_TOLERANCE_DEG).toBeLessThan(90);
  });

  it('keeps timings consistent', () => {
    expect(config.FINAL_TICK_SECONDS).toBeLessThan(config.ROUND_SECONDS);
    expect(config.FEEDBACK_MS).toBeLessThan(config.ROUND_SECONDS * 1000);
    expect(Number.isInteger(config.COUNTDOWN_FROM)).toBe(true);
  });
});
