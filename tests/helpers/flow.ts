/**
 * Flow-test harness (Phase 4): fake device + fake timers (setTimeout, RAF and
 * performance.now) + a seeded RNG, wrapped around a real createApp().
 *
 * Time only moves through advance(); while it moves, the harness keeps
 * "holding" the phone at the current pitch by dispatching a pose every
 * POSE_INTERVAL_MS, like a real ~20 Hz sensor stream.
 */
import { vi } from 'vitest';
import { createApp, type App, type AppOptions } from '../../src/app';
import { COUNTDOWN_FROM, READY_HOLD_MS } from '../../src/config';
import { _resetAudioForTests } from '../../src/device/audio';
import { mulberry32 } from '../../src/game/shuffle';
import { installFakeDevice, type FakeDevice, type FakeDeviceOptions } from './fakeDevice';

export const POSE_INTERVAL_MS = 50;

export interface Flow {
  app: App;
  dev: FakeDevice;
  root: HTMLElement;
  /** Set the held pitch and dispatch one pose right away (null = stop sending). */
  tilt(pitch: number | null): void;
  /** Advance fake time by `ms`, dispatching the held pose every POSE_INTERVAL_MS. */
  advance(ms: number): Promise<void>;
  /** tilt(0) then advance(ms). */
  holdNeutral(ms: number): Promise<void>;
  /** Click deck card `index` on the home screen and let the permission promise settle. */
  startGame(index?: number): Promise<void>;
  /** startGame + hold + countdown, ending on the round screen. */
  toRound(index?: number): Promise<void>;
  screen(): string | null;
  word(): string;
  feedback(): { visible: boolean; text: string; outcome: string };
  timer(): string;
  $<T extends Element = HTMLElement>(sel: string): T | null;
  /** Find a button by visible text or aria-label. */
  button(name: string): HTMLButtonElement;
  teardown(): void;
}

export interface FlowOptions {
  device?: FakeDeviceOptions;
  app?: AppOptions;
  seed?: number;
}

export function useFlowTimers(): void {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
}

export function createFlow(opts: FlowOptions = {}): Flow {
  _resetAudioForTests();
  const dev = installFakeDevice({ permission: 'granted', ...opts.device });
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
  const app = createApp(root, {
    now: () => performance.now(),
    rng: mulberry32(opts.seed ?? 42),
    ...opts.app,
  });

  let pitch: number | null = 0;
  const $ = <T extends Element = HTMLElement>(sel: string): T | null =>
    document.querySelector<T>(sel);

  const flow: Flow = {
    app,
    dev,
    root,
    tilt(p) {
      pitch = p;
      if (p !== null) dev.dispatchPose(p);
    },
    async advance(ms) {
      let left = ms;
      while (left > 0) {
        const step = Math.min(POSE_INTERVAL_MS, left);
        await vi.advanceTimersByTimeAsync(step);
        left -= step;
        if (pitch !== null) dev.dispatchPose(pitch);
      }
    },
    async holdNeutral(ms) {
      flow.tilt(0);
      await flow.advance(ms);
    },
    async startGame(index = 0) {
      const cards = root.querySelectorAll<HTMLButtonElement>('.deck-card');
      const card = cards[index];
      if (!card) throw new Error(`no deck card ${index}`);
      card.click();
      await vi.advanceTimersByTimeAsync(0);
    },
    async toRound(index = 0) {
      await flow.startGame(index);
      await flow.holdNeutral(READY_HOLD_MS + 100);
      await flow.advance(COUNTDOWN_FROM * 1000 + 50);
      if (flow.screen() !== 'round') throw new Error(`expected round, got ${flow.screen()}`);
    },
    screen: () => app.state().screen,
    word: () => $('.word')?.textContent ?? '',
    feedback() {
      const f = $('.feedback');
      return {
        visible: f !== null && !f.hidden,
        text: f?.textContent ?? '',
        outcome: f?.dataset.outcome ?? '',
      };
    },
    timer: () => $('.timer')?.textContent ?? '',
    $,
    button(name) {
      const all = [...document.querySelectorAll<HTMLButtonElement>('button')];
      const b = all.find(
        (x) => x.textContent?.trim() === name || x.getAttribute('aria-label') === name,
      );
      if (!b) throw new Error(`no button "${name}"`);
      return b;
    },
    teardown() {
      app.destroy();
      root.remove();
      document.body.replaceChildren();
      dev.uninstall();
    },
  };
  return flow;
}
