/** Central tunables. Game logic takes these via injected config so tests can override them. */

export const APP_NAME = 'Brow Guess' as const;

/** Public URL shared from the results screen; `assets/qr-live-site.svg` encodes it. */
export const SHARE_URL = 'https://matt-moses.github.io/brow-guess/';

/**
 * Cloudflare Web Analytics site token (public; it ends up in the page either way).
 * Empty disables analytics. The beacon only loads on the SHARE_URL host.
 */
export const CF_BEACON_TOKEN = '4abecfdb6db542939406baeb59862c62'; // gitleaks:allow (public token)
export const CF_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';

/** One-line pitch used by the web app manifest and the description meta tag. */
export const APP_DESCRIPTION =
  'A party word game: hold the phone to your forehead, tilt down when you get it, tilt up to pass.';

/** Matches --bg in style.css; used for the manifest theme/background and the theme-color meta. */
export const THEME_COLOR = '#0b0b12';

/** Round length in seconds. */
export const ROUND_SECONDS = 60;

/** Pitch delta from neutral (degrees) that fires a correct/pass. */
export const TILT_TRIGGER_DEG = 35;
/** Pitch delta from neutral (degrees) under which the detector may re-arm. */
export const TILT_REARM_DEG = 15;
/** Minimum time after a trigger before re-arming is allowed. */
export const TILT_COOLDOWN_MS = 500;

/**
 * If the detector still hasn't re-armed this long after the feedback flash,
 * but the phone is back inside the trigger band, recalibrate neutral to the
 * current pitch and continue (the guesser's resting angle drifted).
 */
export const REARM_GRACE_MS = 1500;
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
