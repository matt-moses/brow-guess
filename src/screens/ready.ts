import { READY_HOLD_MS, SENSOR_TIMEOUT_MS } from '../config.ts';
import type { AppDeps } from '../deps.ts';
import { isUprightLandscape, landscapeSide } from '../game/normalize.ts';
import type { Screen } from '../router.ts';
import { el } from '../ui/dom.ts';
import { createScope } from '../ui/scope.ts';
import { quitButton } from './quit.ts';

export interface ReadyProps {
  /** Upright landscape held for READY_HOLD_MS. */
  onReady: () => void;
  /** No valid orientation event within SENSOR_TIMEOUT_MS (FR-16). */
  onNoSensor: () => void;
  onQuit: () => void;
}

/**
 * "Place on forehead": shows a rotate overlay in portrait; advances once the
 * phone has been upright in landscape for READY_HOLD_MS. Also the sensor
 * watchdog.
 */
export const readyScreen: Screen<ReadyProps, AppDeps> = {
  name: 'ready',
  mount(root, props, deps) {
    const scope = createScope(deps.raf, deps.cancelRaf);
    const overlay = el(
      'div',
      { class: 'rotate-overlay', attrs: { role: 'status', 'data-portrait': 'false' } },
      el('span', { class: 'rotate-icon', text: '📱↻', attrs: { 'aria-hidden': 'true' } }),
      el('p', { text: 'Rotate your device to landscape' }),
    );
    const hint = el('p', { class: 'ready-hint', text: 'Hold it up, screen facing out…' });
    root.append(
      el(
        'main',
        { class: 'screen screen-ready' },
        quitButton(() => props.onQuit()),
        el('h1', { class: 'ready-title', text: 'Place on forehead' }),
        hint,
        overlay,
      ),
    );

    const updatePortrait = (): boolean => {
      const portrait = landscapeSide(deps.device.getScreenAngle()) === null;
      overlay.dataset.portrait = String(portrait);
      return portrait;
    };
    updatePortrait();

    let sawSensor = false;
    let holdStart: number | null = null;
    let done = false;
    const finish = (fn: () => void): void => {
      if (done) return;
      done = true;
      scope.dispose();
      fn();
    };

    scope.add(
      deps.device.subscribeOrientation(
        (sample, t) => {
          if (done) return;
          if (sample.beta === null || sample.gamma === null) return;
          sawSensor = true;
          const portrait = updatePortrait();
          if (portrait || !isUprightLandscape(sample, deps.device.getScreenAngle())) {
            holdStart = null;
            hint.textContent = portrait ? 'Rotate to landscape' : 'Hold it up, screen facing out…';
            return;
          }
          hint.textContent = 'Hold still…';
          holdStart ??= t;
          if (t - holdStart >= READY_HOLD_MS) finish(props.onReady);
        },
        { now: deps.now },
      ),
    );
    scope.timeout(() => {
      if (!sawSensor) finish(props.onNoSensor);
    }, SENSOR_TIMEOUT_MS);

    const orientation = (globalThis as { screen?: { orientation?: EventTarget } }).screen
      ?.orientation;
    if (orientation && typeof orientation.addEventListener === 'function') {
      scope.listen(orientation, 'change', updatePortrait);
    }
    scope.listen(window, 'resize', updatePortrait);

    return () => scope.dispose();
  },
};
