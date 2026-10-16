import { describe, expect, it } from 'vitest';
import { simSample } from '../../src/dev/sim';
import { isUprightLandscape, normalizePitch } from '../../src/game/normalize';

describe('dev simulator pose', () => {
  it('produces samples that normalize back to the requested pitch at angle 90', () => {
    for (const p of [-60, -35, -10, 0, 10, 35, 60]) {
      expect(normalizePitch(simSample(p), 90)).toBeCloseTo(p, 6);
    }
  });

  it('neutral is upright landscape', () => {
    expect(isUprightLandscape(simSample(0), 90)).toBe(true);
  });
});
