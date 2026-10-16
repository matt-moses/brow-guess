// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNTDOWN_FROM, FEEDBACK_MS } from '../../src/config';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('pause on visibilitychange (FR-10)', () => {
  it('pauses mid-round, freezes the timer, and resumes via a fresh countdown with time preserved', async () => {
    flow = createFlow();
    await flow.toRound();
    await flow.advance(10_000);
    const before = flow.app.state().remainingMs ?? 0;
    expect(before).toBeGreaterThan(49_000);
    expect(before).toBeLessThanOrEqual(50_000);

    flow.dev.setVisibility('hidden');
    expect(flow.screen()).toBe('paused');
    expect(flow.root.textContent).toContain('Paused — tap to resume');
    const atPause = flow.app.state().remainingMs;

    await flow.advance(20_000);
    expect(flow.app.state().remainingMs).toBe(atPause);
    expect(flow.screen()).toBe('paused');

    flow.dev.setVisibility('visible');
    expect(flow.screen()).toBe('paused');
    flow.tilt(20); // the player now holds the phone 20° lower
    flow.$<HTMLButtonElement>('.paused-btn')?.click();
    expect(flow.screen()).toBe('countdown');
    await flow.advance(COUNTDOWN_FROM * 1000 - 100);
    expect(flow.app.state().remainingMs).toBe(atPause);
    await flow.advance(150);
    expect(flow.screen()).toBe('round');
    const after = flow.app.state().remainingMs ?? 0;
    expect(atPause! - after).toBeLessThan(200);

    // Recalibrated to ~20°: +30° from there (50°) no longer fires, +40° (60°) does.
    const word = flow.word();
    flow.tilt(50);
    await flow.advance(100);
    expect(flow.feedback().visible).toBe(false);
    flow.tilt(60);
    expect(flow.feedback().text).toBe('Correct!');
    flow.tilt(20);
    await flow.advance(FEEDBACK_MS);
    expect(flow.word()).not.toBe(word);
  });

  it('hiding during the countdown pauses too and restarts the countdown', async () => {
    flow = createFlow();
    await flow.startGame(0);
    await flow.holdNeutral(1100);
    expect(flow.screen()).toBe('countdown');
    await flow.advance(1000);
    flow.dev.setVisibility('hidden');
    expect(flow.screen()).toBe('paused');
    expect(flow.app.state().remainingMs).toBeNull();
    flow.dev.setVisibility('visible');
    flow.$<HTMLButtonElement>('.paused-btn')?.click();
    expect(flow.$('.countdown-num')?.textContent).toBe(String(COUNTDOWN_FROM));
    await flow.advance(COUNTDOWN_FROM * 1000 + 50);
    expect(flow.screen()).toBe('round');
    expect(flow.timer()).toMatch(/^(1:00|0:59)$/);
  });

  it('wake lock is re-acquired after the page becomes visible again', async () => {
    flow = createFlow();
    await flow.toRound();
    flow.dev.setVisibility('hidden');
    expect(flow.dev.wakeLock.active).toBe(0);
    flow.dev.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.dev.wakeLock.active).toBe(1);
  });
});

type Reg = { target: EventTarget; type: string; fn: unknown };

describe('quit', () => {
  it('Quit → confirm returns home and leaves no listeners, timers, or RAF behind', async () => {
    flow = createFlow();
    const active: Reg[] = [];
    const targets: EventTarget[] = [window, document, screen.orientation];
    const spies = targets.map((target) => {
      const origAdd = target.addEventListener.bind(target);
      const origRemove = target.removeEventListener.bind(target);
      const add = vi
        .spyOn(target, 'addEventListener')
        .mockImplementation(
          (type: string, fn: EventListenerOrEventListenerObject | null, opts?: unknown) => {
            active.push({ target, type, fn });
            origAdd(type, fn, opts as AddEventListenerOptions);
          },
        );
      const remove = vi
        .spyOn(target, 'removeEventListener')
        .mockImplementation(
          (type: string, fn: EventListenerOrEventListenerObject | null, opts?: unknown) => {
            const i = active.findIndex(
              (r) => r.target === target && r.type === type && r.fn === fn,
            );
            if (i >= 0) active.splice(i, 1);
            origRemove(type, fn, opts as EventListenerOptions);
          },
        );
      return { add, remove };
    });
    const globalTargets = (): Reg[] => active;
    expect(globalTargets()).toHaveLength(0);

    await flow.toRound();
    const during = globalTargets();
    expect(during.map((r) => r.type)).toEqual(
      expect.arrayContaining(['deviceorientation', 'visibilitychange', 'resize']),
    );
    expect(vi.getTimerCount()).toBeGreaterThan(0); // RAF loop is running

    flow.button('Quit round').click();
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toMatch(/Quit this round\?/);
    // Round is paused while the dialog is open.
    const frozen = flow.app.state().remainingMs;
    await flow.advance(2000);
    expect(flow.app.state().remainingMs).toBe(frozen);

    flow.button('Quit').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.screen()).toBe('home');
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(globalTargets()).toEqual([]);
    const adds = spies.reduce((n, s) => n + s.add.mock.calls.length, 0);
    const removes = spies.reduce((n, s) => n + s.remove.mock.calls.length, 0);
    expect(adds).toBeGreaterThan(0);
    expect(removes).toBe(adds);
    expect(vi.getTimerCount()).toBe(0);
    expect(flow.dev.wakeLock.active).toBe(0);
    expect(flow.dev.fullscreen.element).toBeNull();

    // Further sensor events and time do nothing.
    await flow.advance(5000);
    expect(flow.screen()).toBe('home');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancelling the confirm resumes the same round', async () => {
    flow = createFlow();
    await flow.toRound();
    const word = flow.word();
    flow.button('Quit round').click();
    await flow.advance(1000);
    const frozen = flow.app.state().remainingMs ?? 0;
    flow.button('Keep playing').click();
    await flow.advance(1000);
    expect(flow.screen()).toBe('round');
    expect(flow.word()).toBe(word);
    const now = flow.app.state().remainingMs ?? 0;
    expect(frozen - now).toBeGreaterThanOrEqual(900);
    expect(frozen - now).toBeLessThanOrEqual(1100);
  });

  it('uses an injected confirm and ignores tilts while it is pending', async () => {
    let answer: (v: boolean) => void = () => {};
    const confirm = vi.fn(() => new Promise<boolean>((r) => (answer = r)));
    flow = createFlow({ app: { confirm } });
    await flow.toRound();
    flow.button('Quit round').click();
    expect(confirm).toHaveBeenCalledTimes(1);
    flow.tilt(50);
    expect(flow.feedback().visible).toBe(false);
    answer(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.screen()).toBe('home');
    expect(vi.getTimerCount()).toBe(0);
  });
});
