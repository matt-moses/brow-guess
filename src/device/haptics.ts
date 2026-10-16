/** Haptics adapter (FR-13). A no-op where navigator.vibrate is missing (iOS). */

export type HapticPattern = number | readonly number[];

/** Named vibration patterns (ms). */
export const HAPTIC = {
  correct: 60,
  pass: [30, 40, 30],
  tick: 20,
  buzzer: 400,
} as const satisfies Record<string, HapticPattern>;

/** Vibrate with `pattern`. Never throws. */
export function pulse(pattern: HapticPattern): void {
  try {
    const nav = (globalThis as { navigator?: { vibrate?: (p: number | number[]) => boolean } })
      .navigator;
    if (!nav || typeof nav.vibrate !== 'function') return;
    nav.vibrate(typeof pattern === 'number' ? pattern : [...pattern]);
  } catch {
    // ignore
  }
}
