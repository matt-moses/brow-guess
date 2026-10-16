import { COUNTDOWN_FROM } from '../config.ts';
import type { AppDeps } from '../deps.ts';
import { HAPTIC } from '../device/haptics.ts';
import type { Screen } from '../router.ts';
import { el } from '../ui/dom.ts';
import { createScope } from '../ui/scope.ts';

/** Pitch samples from this final window of the countdown set the neutral angle. */
export const CALIBRATION_WINDOW_MS = 500;

export interface CountdownProps {
  /** Called at the end with the calibrated neutral pitch (0 if no samples). */
  onDone: (neutralDeg: number) => void;
}

/** COUNTDOWN_FROM..1 with a beep and pulse per tick; calibrates neutral (FR-5). */
export const countdownScreen: Screen<CountdownProps, AppDeps> = {
  name: 'countdown',
  mount(root, props, deps) {
    const scope = createScope(deps.raf, deps.cancelRaf);
    const num = el('div', { class: 'countdown-num', attrs: { 'aria-live': 'assertive' } });
    root.append(
      el(
        'main',
        { class: 'screen screen-countdown' },
        el('p', { class: 'countdown-label', text: 'Get ready' }),
        num,
      ),
    );

    const samples: { pitch: number; t: number }[] = [];
    scope.add(
      deps.device.subscribePitch(
        (pitch, t) => {
          if (pitch !== null) samples.push({ pitch, t });
        },
        { now: deps.now, getAngle: deps.device.getScreenAngle },
      ),
    );

    const tick = (n: number): void => {
      if (n <= 0) {
        const end = deps.now();
        const recent = samples.filter((s) => s.t >= end - CALIBRATION_WINDOW_MS);
        const neutral = recent.length
          ? recent.reduce((sum, s) => sum + s.pitch, 0) / recent.length
          : 0;
        scope.dispose();
        props.onDone(neutral);
        return;
      }
      num.textContent = String(n);
      num.classList.remove('pop');
      void num.offsetWidth; // restart the CSS animation
      num.classList.add('pop');
      deps.device.playSound('countdown');
      deps.device.pulse(HAPTIC.tick);
      scope.timeout(() => tick(n - 1), 1000);
    };
    tick(COUNTDOWN_FROM);

    return () => scope.dispose();
  },
};
