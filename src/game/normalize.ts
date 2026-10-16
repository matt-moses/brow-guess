import { UPRIGHT_TOLERANCE_DEG } from '../config';

/**
 * A raw `deviceorientation` reading (degrees). Fields are `null` when the
 * sensor has not reported them. `alpha` (compass heading) is accepted but
 * unused: rotation about the vertical axis does not change the gravity vector.
 */
export interface OrientationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

/** Which landscape orientation the screen is in, or `null` for portrait/unknown. */
export type LandscapeSide = 'primary' | 'secondary';

const DEG = Math.PI / 180;

/**
 * Map a screen orientation angle (`screen.orientation.angle`, or the legacy
 * -90/0/90/180 values) to a landscape side. 90 is landscape-primary, 270 (or
 * -90) is landscape-secondary; 0/180 (portrait) and non-right angles give `null`.
 */
export function landscapeSide(screenAngle: number): LandscapeSide | null {
  if (!Number.isFinite(screenAngle)) return null;
  const a = ((Math.round(screenAngle) % 360) + 360) % 360;
  if (a === 90) return 'primary';
  if (a === 270) return 'secondary';
  return null;
}

/**
 * The world "up" direction (opposite of gravity) expressed in device
 * coordinates, as a unit vector [x, y, z].
 *
 * Device frame (W3C DeviceOrientation): +x = right edge of the device in its
 * natural portrait pose, +y = top edge, +z = out of the screen toward the
 * viewer. The device-to-earth rotation is R = Rz(alpha) · Rx(beta) · Ry(gamma),
 * so up_device = Rᵀ · [0, 0, 1] = third row of R. Rz's third row is [0, 0, 1],
 * hence alpha drops out and
 *
 *   up_device = [ -cos(beta)·sin(gamma),  sin(beta),  cos(beta)·cos(gamma) ].
 */
export function upVector(beta: number, gamma: number): [number, number, number] {
  const b = beta * DEG;
  const g = gamma * DEG;
  return [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
}

/**
 * Normalize a raw orientation sample into a single forehead-pose pitch in
 * degrees (FR-4), or `null` if the screen is in portrait or beta/gamma are
 * missing.
 *
 * Reference pose (pitch = 0): the phone is held in landscape against the
 * guesser's forehead, screen facing outward toward the group, so the screen
 * normal is horizontal and the screen's "up" (the edge that is at the top of
 * the displayed content) points at the sky.
 *
 * Sign convention: pitch is the rotation about the screen's long (landscape
 * horizontal) axis.
 *   - Positive ("tilt down") = the screen rotates to face the floor -> correct.
 *     +90 means the screen faces straight down.
 *   - Negative ("tilt up") = the screen rotates to face the ceiling -> pass.
 *     -90 means the screen faces straight up (e.g. lying flat on a table).
 * The range is (-180, 180]; it is continuous through 0, unlike raw `gamma`,
 * which wraps from -90 to +90 (with beta jumping by 180) exactly at the
 * forehead pose.
 *
 * Math: with u = screen-up axis and n = screen normal (device +z), both in
 * device coordinates, pitch = atan2(-up·n, ±|up_in_screen_plane|), where the
 * horizontal term takes the sign of up·u (so it is continuous through 0 and
 * only flips when the phone is upside down). Using the full in-plane magnitude
 * rather than just up·u makes the pitch insensitive to roll (the long axis
 * dipping off horizontal). Landscape-primary (angle 90) has u = device +x;
 * landscape-secondary (angle 270 / -90) has u = device -x. So for the same
 * rotation of the device about its y axis (a change in gamma), the two sides
 * report pitch changes of opposite sign.
 */
export function normalizePitch(sample: OrientationSample, screenAngle: number): number | null {
  const side = landscapeSide(screenAngle);
  if (side === null) return null;
  const { beta, gamma } = sample;
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) {
    return null;
  }
  const [x, y, z] = upVector(beta, gamma);
  const upAlongScreenUp = side === 'primary' ? x : -x;
  const inPlane = Math.hypot(x, y);
  return Math.atan2(-z, upAlongScreenUp >= 0 ? inPlane : -inPlane) / DEG;
}

/**
 * True when the phone is held upright in landscape, close to the forehead pose
 * (used for the ready-hold check): the screen is landscape, |pitch| ≤
 * `toleranceDeg`, and the phone's long axis is within `toleranceDeg` of
 * horizontal (so a phone rolled toward portrait or lying flat is rejected).
 */
export function isUprightLandscape(
  sample: OrientationSample,
  screenAngle: number,
  toleranceDeg: number = UPRIGHT_TOLERANCE_DEG,
): boolean {
  const pitch = normalizePitch(sample, screenAngle);
  if (pitch === null) return false;
  // normalizePitch returned a number, so beta/gamma are finite numbers here.
  const [, y] = upVector(sample.beta as number, sample.gamma as number);
  const rollDeg = Math.asin(Math.max(-1, Math.min(1, y))) / DEG;
  return Math.abs(pitch) <= toleranceDeg && Math.abs(rollDeg) <= toleranceDeg;
}
