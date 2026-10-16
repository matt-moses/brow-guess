import { describe, expect, it } from 'vitest';
import { TILT_COOLDOWN_MS, TILT_REARM_DEG, TILT_TRIGGER_DEG } from '../../src/config';
import { createTiltDetector, type TiltEvent } from '../../src/game/tilt';

/** Feed samples [pitch, t] and collect the non-null events. */
function feed(d: ReturnType<typeof createTiltDetector>, samples: [number, number][]): TiltEvent[] {
  const out: TiltEvent[] = [];
  for (const [p, t] of samples) {
    const e = d.push(p, t);
    if (e) out.push(e);
  }
  return out;
}

describe('createTiltDetector', () => {
  it('uses config defaults', () => {
    expect(TILT_TRIGGER_DEG).toBe(35);
    expect(TILT_REARM_DEG).toBe(15);
    expect(TILT_COOLDOWN_MS).toBe(500);
    const d = createTiltDetector();
    expect(d.state()).toEqual({
      phase: 'neutral',
      direction: null,
      neutralDeg: 0,
      triggeredAt: null,
    });
  });

  it('fires correct at 36° but not at 34° (and not at exactly 35°)', () => {
    const d = createTiltDetector();
    expect(d.push(34, 0)).toBeNull();
    expect(d.push(35, 10)).toBeNull();
    expect(d.push(36, 20)).toEqual({ type: 'correct', t: 20 });
    expect(d.state()).toMatchObject({ phase: 'triggered', direction: 'correct', triggeredAt: 20 });
  });

  it('fires pass when tilted the other way', () => {
    const d = createTiltDetector();
    expect(d.push(-34, 0)).toBeNull();
    expect(d.push(-36, 5)).toEqual({ type: 'pass', t: 5 });
    expect(d.state().direction).toBe('pass');
  });

  it('jitter around ±35° fires exactly once', () => {
    const d = createTiltDetector();
    const samples: [number, number][] = [];
    for (let i = 0; i < 40; i++) samples.push([i % 2 ? 36 : 34, i * 16]);
    const events = feed(d, samples);
    expect(events).toEqual([{ type: 'correct', t: 16 }]);

    const d2 = createTiltDetector();
    const neg = feed(
      d2,
      samples.map(([p, t]) => [-p, t]),
    );
    expect(neg).toEqual([{ type: 'pass', t: 16 }]);
  });

  it('does not re-arm at 20° (outside the hysteresis band), however long it waits', () => {
    const d = createTiltDetector();
    d.push(40, 0);
    expect(
      feed(d, [
        [20, 600],
        [20, 5000],
        [15, 6000],
        [-15, 6100],
      ]),
    ).toEqual([]);
    expect(d.state().phase).toBe('triggered');
    // Still triggered, so a second big tilt does not fire again.
    expect(d.push(60, 7000)).toBeNull();
  });

  it('does not re-arm before 500 ms, even when back at 0°', () => {
    const d = createTiltDetector();
    d.push(40, 1000);
    expect(d.push(0, 1100)).toBeNull();
    expect(d.state().phase).toBe('cooldown');
    expect(d.push(0, 1499)).toBeNull();
    expect(d.push(-40, 1499)).toBeNull(); // a pass tilt during cooldown is ignored
    expect(d.state().phase).toBe('triggered');
  });

  it('re-arms once both conditions are met and can fire again', () => {
    const d = createTiltDetector();
    expect(d.push(40, 1000)).toEqual({ type: 'correct', t: 1000 });
    expect(d.push(5, 1200)).toBeNull();
    expect(d.push(5, 1500)).toEqual({ type: 'rearmed', t: 1500 });
    expect(d.state()).toMatchObject({ phase: 'neutral', direction: null, triggeredAt: null });
    expect(d.push(-36, 1600)).toEqual({ type: 'pass', t: 1600 });
  });

  it('re-arms immediately on return if the cooldown already elapsed', () => {
    const d = createTiltDetector();
    d.push(-50, 0);
    expect(d.push(-30, 800)).toBeNull();
    expect(d.push(-14, 900)).toEqual({ type: 'rearmed', t: 900 });
  });

  it('respects the calibration offset', () => {
    const d = createTiltDetector();
    d.calibrate(10);
    expect(d.state().neutralDeg).toBe(10);
    expect(d.push(36, 0)).toBeNull();
    expect(d.push(45, 10)).toBeNull();
    expect(d.push(46, 20)).toEqual({ type: 'correct', t: 20 });
    // Re-arm band is relative to neutral too: 24 = Δ14 re-arms, 0 = Δ-10 would too.
    expect(d.push(26, 600)).toBeNull();
    expect(d.push(24, 610)).toEqual({ type: 'rearmed', t: 610 });
    expect(d.push(-24, 700)).toBeNull();
    expect(d.push(-26, 710)).toEqual({ type: 'pass', t: 710 });
  });

  it('takes thresholds from injected config', () => {
    const d = createTiltDetector({ triggerDeg: 20, rearmDeg: 5, cooldownMs: 100 });
    expect(d.push(21, 0)).toEqual({ type: 'correct', t: 0 });
    expect(d.push(6, 200)).toBeNull();
    expect(d.push(4, 90)).toBeNull(); // in band but only 90 ms
    expect(d.push(4, 100)).toEqual({ type: 'rearmed', t: 100 });

    // Partial overrides keep the other defaults.
    const p = createTiltDetector({ triggerDeg: 10 });
    expect(p.push(11, 0)).toEqual({ type: 'correct', t: 0 });
    expect(p.push(14, 1000)).toEqual({ type: 'rearmed', t: 1000 }); // default rearm 15
  });

  it('ignores non-finite samples and calibrations', () => {
    const d = createTiltDetector();
    expect(d.push(Number.NaN, 0)).toBeNull();
    expect(d.push(90, Number.NaN)).toBeNull();
    expect(d.state().phase).toBe('neutral');
    d.calibrate(Number.NaN);
    expect(d.state().neutralDeg).toBe(0);
  });

  it('reset returns to neutral and clears calibration', () => {
    const d = createTiltDetector();
    d.calibrate(5);
    d.push(50, 0);
    d.reset();
    expect(d.state()).toEqual({
      phase: 'neutral',
      direction: null,
      neutralDeg: 0,
      triggeredAt: null,
    });
    expect(d.push(36, 1)).toEqual({ type: 'correct', t: 1 });
  });
});
