import type { LandscapeSide, OrientationSample } from '../../src/game/normalize';

const DEG = Math.PI / 180;

/**
 * Build a raw deviceorientation sample (as a W3C-conforming browser would
 * report it: beta in [-180, 180), gamma in [-90, 90)) from a physical pose.
 *
 * Pose: phone in landscape on the forehead, screen facing outward.
 *  - `pitchDeg`: rotation about the screen's long horizontal axis;
 *    positive = screen turns to face the floor, negative = toward the ceiling.
 *  - `rollDeg`: rotation about the screen normal (long axis dipping off horizontal).
 *  - `side`: landscape-primary (device top edge to the viewer's left, device
 *    +x up) or landscape-secondary (device top edge right, device +x down).
 *
 * Steps: compute world-up in device coordinates from the screen basis
 * (screen-up u, screen-right r, normal n = +z), then invert
 * up = [-cosβ·sinγ, sinβ, cosβ·cosγ] under the W3C range constraints.
 */
export function poseSample(
  pitchDeg: number,
  side: LandscapeSide,
  rollDeg = 0,
  alpha = 123,
): OrientationSample {
  const p = pitchDeg * DEG;
  const r = rollDeg * DEG;
  // Screen basis in device coordinates.
  const u = side === 'primary' ? [1, 0, 0] : [-1, 0, 0];
  const right = side === 'primary' ? [0, -1, 0] : [0, 1, 0];
  const n = [0, 0, 1];
  // World-up in the screen basis: tilt-down rotates the normal toward the floor.
  const cu = Math.cos(p) * Math.cos(r);
  const cr = Math.cos(p) * Math.sin(r);
  const cn = -Math.sin(p);
  const up = [0, 1, 2].map((i) => cu * u[i]! + cr * right[i]! + cn * n[i]!) as [
    number,
    number,
    number,
  ];
  const [x, y, z] = up;
  // cos(gamma) >= 0 in the W3C range, so sign(cos beta) = sign(z).
  const sign = z < 0 ? -1 : 1;
  const cb = sign * Math.hypot(x, z);
  let beta = Math.atan2(y, cb) / DEG;
  let gamma = Math.atan2(-x / cb, z / cb) / DEG;
  if (gamma >= 90) {
    // Keep gamma in [-90, 90) (only reached at exact vertical): (β, γ) and
    // (180 − β, γ − 180) describe the same gravity vector.
    gamma -= 180;
    beta = 180 - beta;
  }
  if (beta >= 180) beta -= 360;
  if (beta < -180) beta += 360;
  return { alpha, beta, gamma };
}
