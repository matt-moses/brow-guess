import { FEEDBACK_MS, FINAL_TICK_SECONDS } from '../config.ts';
import type { AppDeps } from '../deps.ts';
import { HAPTIC } from '../device/haptics.ts';
import type { Outcome, Round } from '../game/round.ts';
import type { TiltDetector } from '../game/tilt.ts';
import type { Screen } from '../router.ts';
import { fitText, type FitMeasure } from '../ui/autofit.ts';
import { el } from '../ui/dom.ts';
import { createScope } from '../ui/scope.ts';
import { quitButton } from './quit.ts';

export interface RoundProps {
  /** Started (and resumed) round. */
  round: Round;
  /** Reset and calibrated detector. */
  detector: TiltDetector;
  /** The round is over (time or exhaustion). */
  onOver: () => void;
  onQuit: () => void;
  /** Autofit measurement override (tests). */
  measure?: FitMeasure;
}

/** Format remaining ms as m:ss, rounding up to whole seconds. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const LABEL: Record<Outcome, string> = { correct: 'Correct!', pass: 'Pass' };
const FIT = { min: 24, max: 480 };

export const roundScreen: Screen<RoundProps, AppDeps> = {
  name: 'round',
  mount(root, props, deps) {
    const { round, detector } = props;
    const { device } = deps;
    const scope = createScope(deps.raf, deps.cancelRaf);

    const word = el('div', { class: 'word', attrs: { 'aria-live': 'polite' } });
    const wordBox = el('div', { class: 'word-box' }, word);
    const timer = el('div', {
      class: 'timer',
      attrs: { role: 'timer', 'aria-label': 'Time left' },
    });
    const feedback = el('div', {
      class: 'feedback',
      attrs: { 'data-outcome': '', 'aria-live': 'assertive', hidden: '' },
    });
    const screen = el(
      'main',
      { class: 'screen screen-round' },
      quitButton(() => props.onQuit()),
      timer,
      wordBox,
      feedback,
    );
    root.append(screen);

    const fit = (): void => {
      fitText(word, { ...FIT, measure: props.measure });
    };
    const showWord = (): void => {
      word.textContent = round.current() ?? '';
      fit();
    };
    showWord();
    scope.listen(window, 'resize', fit);

    /** Pending feedback: next word waits for both the timer and a re-arm (AC-2). */
    let pending: { timerDone: boolean; rearmed: boolean } | null = null;
    let over = false;

    const finish = (): void => {
      if (over) return;
      over = true;
      scope.dispose();
      props.onOver();
    };

    const settle = (): void => {
      if (!pending || !pending.timerDone || !pending.rearmed) return;
      pending = null;
      feedback.hidden = true;
      feedback.dataset.outcome = '';
      screen.dataset.feedback = '';
      if (round.isOver()) finish();
      else showWord();
    };

    const answer = (outcome: Outcome): void => {
      if (!round.answer(outcome)) return;
      pending = { timerDone: false, rearmed: false };
      feedback.textContent = LABEL[outcome];
      feedback.dataset.outcome = outcome;
      feedback.hidden = false;
      screen.dataset.feedback = outcome;
      device.playSound(outcome);
      device.pulse(outcome === 'correct' ? HAPTIC.correct : HAPTIC.pass);
      scope.timeout(() => {
        if (!pending) return;
        pending.timerDone = true;
        // Exhausted: no need to wait for neutral before showing results.
        if (round.isOver()) pending.rearmed = true;
        settle();
      }, FEEDBACK_MS);
    };

    scope.add(
      device.subscribePitch(
        (pitch, t) => {
          if (over || pitch === null) return;
          const ev = detector.push(pitch, t);
          if (!ev || round.isPaused() || round.isOver()) return;
          if (ev.type === 'rearmed') {
            if (pending) {
              pending.rearmed = true;
              settle();
            }
          } else if (!pending) {
            answer(ev.type);
          }
        },
        { now: deps.now, getAngle: device.getScreenAngle },
      ),
    );

    let lastTick: number | null = null;
    const render = (): void => {
      const remaining = round.remainingMs();
      timer.textContent = formatClock(remaining);
      const secs = Math.ceil(remaining / 1000);
      timer.classList.toggle('is-final', secs <= FINAL_TICK_SECONDS);
      if (!round.isPaused() && secs >= 1 && secs <= FINAL_TICK_SECONDS && secs !== lastTick) {
        lastTick = secs;
        device.playSound('tick');
      }
    };
    render();
    scope.loop(() => {
      render();
      // Time's up ends immediately; exhaustion waits for the feedback to finish.
      if (round.isOver() && (round.endReason() === 'time' || !pending)) {
        finish();
        return false;
      }
      return true;
    });

    return () => scope.dispose();
  },
};
