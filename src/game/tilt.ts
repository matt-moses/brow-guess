import { TILT_COOLDOWN_MS, TILT_REARM_DEG, TILT_TRIGGER_DEG } from '../config';

/** Detector thresholds. Defaults come from `src/config.ts`. */
export interface TiltConfig {
  /** Deviation from neutral (degrees) that must be strictly exceeded to fire. */
  triggerDeg: number;
  /** Deviation from neutral (degrees) that must be strictly undercut to re-arm. */
  rearmDeg: number;
  /** Minimum ms between a trigger and the re-arm. */
  cooldownMs: number;
}

export type TiltOutcome = 'correct' | 'pass';

export type TiltEvent = { type: TiltOutcome; t: number } | { type: 'rearmed'; t: number };

/**
 * NEUTRAL: armed, waiting for a tilt.
 * TRIGGERED: fired; the phone is still outside the re-arm band.
 * COOLDOWN: back inside the re-arm band, waiting for the cooldown to elapse.
 */
export type TiltPhase = 'neutral' | 'triggered' | 'cooldown';

export interface TiltState {
  phase: TiltPhase;
  /** Direction of the last trigger while not neutral; `null` when neutral. */
  direction: TiltOutcome | null;
  /** Calibrated neutral pitch (degrees). */
  neutralDeg: number;
  /** Timestamp of the last trigger while not neutral; `null` when neutral. */
  triggeredAt: number | null;
}

export interface TiltDetector {
  /**
   * Feed one pitch sample (degrees, positive = screen toward floor; see
   * `normalizePitch`) at time `tMs`. Returns an event when the state machine
   * fires or re-arms, otherwise `null`. Non-finite samples are ignored.
   */
  push(pitchDeg: number, tMs: number): TiltEvent | null;
  /** Set the neutral pitch that deviations are measured from (FR-5). */
  calibrate(neutralDeg: number): void;
  /** Back to NEUTRAL with neutral = 0. */
  reset(): void;
  state(): TiltState;
}

/**
 * Tilt state machine (FR-6/7): NEUTRAL → TRIGGERED(correct|pass) → COOLDOWN → NEUTRAL.
 * Fires once when pitch − neutral > trigger (correct) or < −trigger (pass).
 * Re-arms (emitting `rearmed`) only when |pitch − neutral| < rearm AND
 * t − triggeredAt ≥ cooldown.
 */
export function createTiltDetector(cfg: Partial<TiltConfig> = {}): TiltDetector {
  const triggerDeg = cfg.triggerDeg ?? TILT_TRIGGER_DEG;
  const rearmDeg = cfg.rearmDeg ?? TILT_REARM_DEG;
  const cooldownMs = cfg.cooldownMs ?? TILT_COOLDOWN_MS;

  let phase: TiltPhase = 'neutral';
  let direction: TiltOutcome | null = null;
  let triggeredAt: number | null = null;
  let neutralDeg = 0;

  function push(pitchDeg: number, tMs: number): TiltEvent | null {
    if (!Number.isFinite(pitchDeg) || !Number.isFinite(tMs)) return null;
    const delta = pitchDeg - neutralDeg;

    if (phase === 'neutral') {
      if (delta > triggerDeg || delta < -triggerDeg) {
        direction = delta > 0 ? 'correct' : 'pass';
        phase = 'triggered';
        triggeredAt = tMs;
        return { type: direction, t: tMs };
      }
      return null;
    }

    if (Math.abs(delta) >= rearmDeg) {
      phase = 'triggered';
      return null;
    }
    if (tMs - (triggeredAt as number) >= cooldownMs) {
      phase = 'neutral';
      direction = null;
      triggeredAt = null;
      return { type: 'rearmed', t: tMs };
    }
    phase = 'cooldown';
    return null;
  }

  return {
    push,
    calibrate(n: number) {
      if (Number.isFinite(n)) neutralDeg = n;
    },
    reset() {
      phase = 'neutral';
      direction = null;
      triggeredAt = null;
      neutralDeg = 0;
    },
    state: () => ({ phase, direction, neutralDeg, triggeredAt }),
  };
}
