import { describe, expect, it } from 'vitest';
import {
  isUprightLandscape,
  landscapeSide,
  normalizePitch,
  upVector,
  type LandscapeSide,
} from '../../src/game/normalize';
import { poseSample } from './pose';

const sides: [LandscapeSide, number[]][] = [
  ['primary', [90, 450, -270]],
  ['secondary', [270, -90]],
];

describe('landscapeSide', () => {
  it.each([
    [90, 'primary'],
    [270, 'secondary'],
    [-90, 'secondary'],
    [450, 'primary'],
    [0, null],
    [180, null],
    [-180, null],
    [45, null],
    [Number.NaN, null],
  ] as const)('angle %s -> %s', (angle, expected) => {
    expect(landscapeSide(angle)).toBe(expected);
  });
});

describe('upVector', () => {
  it('flat on a table, screen up: up = +z', () => {
    const [x, y, z] = upVector(0, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });
  it('portrait upright: up = +y', () => {
    const [x, y, z] = upVector(90, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });
});

describe('normalizePitch', () => {
  it('returns null in portrait', () => {
    const s = poseSample(10, 'primary');
    expect(normalizePitch(s, 0)).toBeNull();
    expect(normalizePitch(s, 180)).toBeNull();
  });

  it('returns null when beta or gamma is missing / non-finite', () => {
    expect(normalizePitch({ alpha: 0, beta: null, gamma: 10 }, 90)).toBeNull();
    expect(normalizePitch({ alpha: 0, beta: 10, gamma: null }, 90)).toBeNull();
    expect(normalizePitch({ alpha: null, beta: Number.NaN, gamma: 0 }, 90)).toBeNull();
    expect(normalizePitch({ alpha: null, beta: 0, gamma: Infinity }, 270)).toBeNull();
  });

  it('ignores alpha', () => {
    const a = normalizePitch({ alpha: 0, beta: 5, gamma: -70 }, 90);
    const b = normalizePitch({ alpha: 270, beta: 5, gamma: -70 }, 90);
    const c = normalizePitch({ alpha: null, beta: 5, gamma: -70 }, 90);
    expect(a).toBeCloseTo(b as number, 10);
    expect(a).toBeCloseTo(c as number, 10);
  });

  // Hand-computed absolute poses (independent of the pose helper).
  it.each([
    // [beta, gamma, angle, expected pitch]
    [0, -90, 90, 0], // primary upright: up = +x
    [0, 90, 270, 0], // secondary upright: up = -x
    [0, -80, 90, -10], // primary, screen turned 10° toward the ceiling
    [0, 80, 270, -10], // secondary, mirrored sample, same physical pose
    [180, 80, 90, 10], // primary, past vertical: beta flipped, screen toward floor
    [180, -80, 270, 10], // secondary, mirrored
    [0, 0, 90, -90], // lying flat, screen up -> full "pass" direction
    [0, 0, 270, -90],
    [-180, 0, 90, 90], // lying flat, screen down -> full "correct" direction
  ])('beta=%s gamma=%s angle=%s -> %s', (beta, gamma, angle, expected) => {
    expect(normalizePitch({ alpha: 0, beta, gamma }, angle)).toBeCloseTo(expected, 6);
  });

  it('landscape-primary vs -secondary give opposite signs for the same device rotation', () => {
    // Rotating the device about its own y axis so that gamma increases by 10°
    // from the upright pose reads as tilt-up on primary but tilt-down on secondary.
    const primary = normalizePitch({ alpha: 0, beta: 0, gamma: -90 + 10 }, 90) as number;
    const secondary = normalizePitch({ alpha: 0, beta: 180, gamma: -90 + 10 }, 270) as number;
    expect(primary).toBeCloseTo(-10, 6);
    expect(secondary).toBeCloseTo(10, 6);
    expect(Math.sign(primary)).toBe(-Math.sign(secondary));

    // And gamma decreasing by 10° from the secondary upright pose (90 -> 80) is
    // tilt-up there, while the same delta near primary upright (-90 -> -100,
    // i.e. beta 180 / gamma 80) is tilt-down.
    expect(normalizePitch({ alpha: 0, beta: 0, gamma: 80 }, 270)).toBeCloseTo(-10, 6);
    expect(normalizePitch({ alpha: 0, beta: 180, gamma: 80 }, 90)).toBeCloseTo(10, 6);
  });

  for (const [side, angles] of sides) {
    for (const angle of angles) {
      it(`${side} (angle ${angle}): sweep -60..+60 is continuous, monotonic and recovers pitch`, () => {
        let prev: number | null = null;
        let prevGamma: number | null = null;
        let sawGammaWrap = false;
        for (let p = -60; p <= 60; p++) {
          const s = poseSample(p, side);
          const out = normalizePitch(s, angle);
          expect(out).not.toBeNull();
          expect(Math.abs((out as number) - p)).toBeLessThan(1);
          if (prev !== null) {
            expect(out as number).toBeGreaterThan(prev);
            expect((out as number) - prev).toBeLessThan(5);
          }
          if (prevGamma !== null && Math.abs((s.gamma as number) - prevGamma) > 90) {
            sawGammaWrap = true;
          }
          prev = out;
          prevGamma = s.gamma;
        }
        // Prove the sweep actually crossed the raw-gamma ±90 discontinuity.
        expect(sawGammaWrap).toBe(true);
      });
    }
  }

  it('is unaffected by moderate roll', () => {
    for (const side of ['primary', 'secondary'] as const) {
      const angle = side === 'primary' ? 90 : 270;
      for (const roll of [-20, 20]) {
        expect(normalizePitch(poseSample(25, side, roll), angle)).toBeCloseTo(25, 6);
        expect(normalizePitch(poseSample(-25, side, roll), angle)).toBeCloseTo(-25, 6);
      }
    }
  });

  it('a physically primary pose read as secondary is far from neutral (upside down)', () => {
    expect(Math.abs(normalizePitch(poseSample(0, 'primary'), 270) as number)).toBeCloseTo(180, 6);
  });
});

describe('isUprightLandscape', () => {
  it('accepts the forehead pose on both sides', () => {
    expect(isUprightLandscape(poseSample(0, 'primary'), 90)).toBe(true);
    expect(isUprightLandscape(poseSample(0, 'secondary'), 270)).toBe(true);
    expect(isUprightLandscape(poseSample(-29, 'primary', 10), 90)).toBe(true);
  });

  it('rejects portrait and missing data', () => {
    expect(isUprightLandscape(poseSample(0, 'primary'), 0)).toBe(false);
    expect(isUprightLandscape({ alpha: 0, beta: null, gamma: null }, 90)).toBe(false);
  });

  it('rejects pitch beyond tolerance (incl. lying flat)', () => {
    expect(isUprightLandscape(poseSample(31, 'primary'), 90)).toBe(false);
    expect(isUprightLandscape(poseSample(-31, 'secondary'), 270)).toBe(false);
    expect(isUprightLandscape({ alpha: 0, beta: 0, gamma: 0 }, 90)).toBe(false);
  });

  it('rejects a phone rolled toward portrait (long axis not horizontal)', () => {
    expect(isUprightLandscape(poseSample(0, 'primary', 45), 90)).toBe(false);
    expect(isUprightLandscape(poseSample(0, 'secondary', -45), 270)).toBe(false);
    expect(isUprightLandscape({ alpha: 0, beta: 90, gamma: 0 }, 90)).toBe(false);
  });

  it('honours a custom tolerance', () => {
    expect(isUprightLandscape(poseSample(15, 'primary'), 90, 10)).toBe(false);
    expect(isUprightLandscape(poseSample(15, 'primary'), 90, 20)).toBe(true);
  });
});
