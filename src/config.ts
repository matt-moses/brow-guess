/** Central tunables. Game logic takes these via injected config so tests can override them. */

export const APP_NAME = 'Brow Guess' as const;

/** Round length in seconds. */
export const ROUND_SECONDS = 60;

/** Pitch delta from neutral (degrees) that fires a correct/pass. */
export const TILT_TRIGGER_DEG = 35;
/** Pitch delta from neutral (degrees) under which the detector may re-arm. */
export const TILT_REARM_DEG = 15;
/** Minimum time after a trigger before re-arming is allowed. */
export const TILT_COOLDOWN_MS = 500;

/** How long the correct/pass feedback flash is shown. */
export const FEEDBACK_MS = 600;
/** How long the phone must be held upright before the countdown starts. */
export const READY_HOLD_MS = 1000;
/** Time to wait for a first orientation event before falling back to tap controls. */
export const SENSOR_TIMEOUT_MS = 1500;

/** Seconds remaining at which the per-second tick sound starts. */
export const FINAL_TICK_SECONDS = 10;
/** Pre-round countdown start value. */
export const COUNTDOWN_FROM = 3;

/** Max deviation (degrees) from upright-landscape accepted by isUprightLandscape. */
export const UPRIGHT_TOLERANCE_DEG = 30;
