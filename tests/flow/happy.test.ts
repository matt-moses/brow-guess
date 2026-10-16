// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME, FEEDBACK_MS } from '../../src/config';
import { HAPTIC } from '../../src/device/haptics';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.useRealTimers();
});

function resultRows(): { word: string; mark: string; outcome: string }[] {
  return [...document.querySelectorAll<HTMLElement>('.results-list .result')].map((li) => ({
    word: li.querySelector('.result-word')?.textContent ?? '',
    mark: li.querySelector('.result-mark')?.textContent ?? '',
    outcome: li.dataset.outcome ?? '',
  }));
}

describe('happy path', () => {
  it('tap → hold → countdown → correct → next word → pass → time up → results', async () => {
    flow = createFlow();
    expect(document.title).toBe(APP_NAME);
    expect(flow.screen()).toBe('home');

    await flow.startGame(0);
    expect(flow.screen()).toBe('ready');
    await flow.holdNeutral(1100);
    expect(flow.screen()).toBe('countdown');
    expect(flow.$('.countdown-num')?.textContent).toBe('3');
    await flow.advance(3050);
    expect(flow.screen()).toBe('round');
    expect(flow.timer()).toMatch(/^(1:00|0:59)$/);

    const first = flow.word();
    expect(first).not.toBe('');

    flow.tilt(50);
    expect(flow.feedback()).toEqual({ visible: true, text: 'Correct!', outcome: 'correct' });
    expect(flow.dev.vibrate).toHaveBeenCalledWith(HAPTIC.correct);

    flow.tilt(0);
    await flow.advance(FEEDBACK_MS);
    expect(flow.feedback().visible).toBe(false);
    const second = flow.word();
    expect(second).not.toBe(first);
    expect(second).not.toBe('');

    flow.tilt(-50);
    expect(flow.feedback()).toEqual({ visible: true, text: 'Pass', outcome: 'pass' });
    expect(flow.dev.vibrate).toHaveBeenCalledWith([...HAPTIC.pass]);
    flow.tilt(0);

    await flow.advance(61_000);
    expect(flow.screen()).toBe('results');
    expect(flow.$('.score-num')?.textContent).toBe('1');
    expect(resultRows()).toEqual([
      { word: first, mark: '✓', outcome: 'correct' },
      { word: second, mark: '✗', outcome: 'pass' },
    ]);
    expect(flow.$('.result.correct')).not.toBeNull();
    expect(flow.$('.result.pass')).not.toBeNull();
  });

  it('acquires the wake lock at start and releases everything at time up', async () => {
    flow = createFlow();
    await flow.startGame(0);
    expect(flow.dev.wakeLock.requests).toBe(1);
    expect(flow.dev.wakeLock.active).toBe(1);
    expect(flow.dev.fullscreen.requestFullscreen).toHaveBeenCalled();
    expect(flow.dev.fullscreen.lock).toHaveBeenCalledWith('landscape');

    await flow.holdNeutral(1100);
    await flow.advance(3050);
    expect(flow.screen()).toBe('round');
    expect(flow.dev.wakeLock.active).toBe(1);

    await flow.advance(60_100);
    expect(flow.screen()).toBe('results');
    expect(flow.dev.wakeLock.active).toBe(0);
    expect(flow.dev.wakeLock.releases).toBe(1);
    expect(flow.dev.fullscreen.exitFullscreen).toHaveBeenCalled();
    expect(flow.dev.fullscreen.element).toBeNull();
    expect(flow.dev.fullscreen.unlock).toHaveBeenCalled();
    expect(flow.dev.vibrate).toHaveBeenCalledWith(HAPTIC.buzzer);
  });

  it('plays the tick once per second in the final 10 s, then the buzzer', async () => {
    const playSound = vi.fn();
    flow = createFlow({ app: { device: { playSound } } });
    await flow.toRound();
    const countdownBeeps = playSound.mock.calls.filter(([n]) => n === 'countdown').length;
    expect(countdownBeeps).toBe(3);

    await flow.advance(49_000);
    expect(playSound.mock.calls.filter(([n]) => n === 'tick')).toHaveLength(0);
    await flow.advance(12_000);
    expect(flow.screen()).toBe('results');
    expect(playSound.mock.calls.filter(([n]) => n === 'tick')).toHaveLength(10);
    expect(playSound).toHaveBeenLastCalledWith('buzzer');
  });

  it('requests motion permission synchronously, before any await in the tap handler', () => {
    flow = createFlow({ device: { permission: 'granted' } });
    const card = flow.root.querySelector<HTMLButtonElement>('.deck-card');
    card?.click();
    // No await yet: everything gesture-gated must already have been called.
    const req = flow.dev.requestPermission;
    expect(req).toHaveBeenCalledTimes(1);
    expect(flow.dev.audioContext.instances).toHaveLength(1);
    expect(flow.dev.audioContext.resumeCalls).toBe(1);
    expect(flow.dev.fullscreen.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(flow.dev.wakeLock.request).toHaveBeenCalledTimes(1);
    const first = req?.mock.invocationCallOrder[0] ?? Infinity;
    expect(first).toBeLessThan(
      flow.dev.fullscreen.requestFullscreen?.mock.invocationCallOrder[0] ?? -1,
    );
    expect(first).toBeLessThan(flow.dev.wakeLock.request?.mock.invocationCallOrder[0] ?? -1);
    expect(first).toBeLessThan(flow.dev.fullscreen.lock?.mock.invocationCallOrder[0] ?? -1);
  });

  it('ends early when the deck is exhausted', async () => {
    flow = createFlow({
      app: {
        decks: [
          {
            id: 'tiny',
            title: 'Tiny',
            emoji: '🧪',
            description: 'Two words',
            color: '#123456',
            words: ['Alpha', 'Beta'],
          },
        ],
      },
    });
    await flow.toRound();
    const a = flow.word();
    flow.tilt(50);
    flow.tilt(0);
    await flow.advance(FEEDBACK_MS);
    const b = flow.word();
    expect(new Set([a, b])).toEqual(new Set(['Alpha', 'Beta']));
    flow.tilt(50);
    expect(flow.feedback().text).toBe('Correct!');
    await flow.advance(FEEDBACK_MS);
    expect(flow.screen()).toBe('results');
    expect(flow.$('.score-num')?.textContent).toBe('2');
    expect(flow.dev.wakeLock.active).toBe(0);
  });
});
