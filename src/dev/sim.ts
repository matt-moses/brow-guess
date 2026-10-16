/**
 * Dev-only sensor simulator (`npm run dev`, then open `/?sim`). Stubs the
 * screen angle to 90 (landscape-primary) and dispatches synthetic
 * `deviceorientation` events at ~30 Hz: neutral by default, ArrowDown held =
 * tilt down (correct), ArrowUp held = tilt up (pass). Imported only from
 * main.ts under `import.meta.env.DEV`, so it never ships.
 */

const TILT_DEG = 60;
const INTERVAL_MS = 33;
const DEG = Math.PI / 180;

/**
 * Raw sample for a landscape-primary forehead pose at `pitchDeg` (no roll):
 * world-up in device coordinates is [cos p, 0, -sin p]; invert
 * up = [-cosβ·sinγ, sinβ, cosβ·cosγ] keeping γ in [-90, 90).
 */
export function simSample(pitchDeg: number): { alpha: number; beta: number; gamma: number } {
  const p = pitchDeg * DEG;
  const x = Math.cos(p);
  const z = -Math.sin(p);
  const cb = z < 0 ? -Math.hypot(x, z) : Math.hypot(x, z);
  let beta = Math.atan2(0, cb) / DEG;
  const gamma = Math.atan2(-x / cb, z / cb) / DEG;
  if (beta >= 180) beta -= 360;
  return { alpha: 0, beta, gamma };
}

export function installSim(): () => void {
  try {
    const o = screen.orientation as ScreenOrientation | undefined;
    if (o) Object.defineProperty(o, 'angle', { configurable: true, get: () => 90 });
    else Object.defineProperty(window, 'orientation', { configurable: true, get: () => 90 });
  } catch {
    // best effort
  }

  let pitch = 0;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (e.type === 'keyup') pitch = 0;
    else pitch = e.key === 'ArrowDown' ? TILT_DEG : -TILT_DEG;
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const timer = setInterval(() => {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', simSample(pitch)));
  }, INTERVAL_MS);

  const badge = document.createElement('div');
  badge.textContent = 'SIM: hold ↓ correct / ↑ pass';
  badge.style.cssText =
    'position:fixed;bottom:4px;right:4px;z-index:99;font:12px monospace;background:#000a;color:#fff;padding:2px 6px;border-radius:4px;pointer-events:none';
  document.body.append(badge);

  return () => {
    clearInterval(timer);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    badge.remove();
  };
}
