// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_MS } from '../../src/config';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.useRealTimers();
});

describe('answer gating', () => {
  it('shows no next word while the phone is still tilted, even after FEEDBACK_MS (AC-2)', async () => {
    flow = createFlow();
    await flow.toRound();
    const first = flow.word();

    flow.tilt(50);
    await flow.advance(FEEDBACK_MS + 400);
    expect(flow.feedback().visible).toBe(true);
    expect(flow.feedback().text).toBe('Correct!');
    expect(flow.word()).toBe(first);

    flow.tilt(0);
    await flow.advance(100);
    expect(flow.feedback().visible).toBe(false);
    expect(flow.word()).not.toBe(first);
  });

  it('waits for FEEDBACK_MS even if the phone returns to neutral at once', async () => {
    flow = createFlow();
    await flow.toRound();
    const first = flow.word();
    flow.tilt(-50);
    flow.tilt(0);
    await flow.advance(FEEDBACK_MS - 100);
    expect(flow.feedback().visible).toBe(true);
    await flow.advance(100);
    expect(flow.word()).not.toBe(first);
  });

  it('jitter around the threshold registers exactly one answer', async () => {
    flow = createFlow();
    await flow.toRound();
    flow.tilt(null); // drive samples by hand
    for (let i = 0; i < 40; i++) {
      flow.dev.dispatchPose(i % 2 === 0 ? 34 : 36);
      await vi.advanceTimersByTimeAsync(25);
    }
    flow.tilt(0);
    await flow.advance(FEEDBACK_MS);
    await flow.advance(61_000);
    expect(flow.screen()).toBe('results');
    const rows = document.querySelectorAll('.results-list .result');
    expect(rows).toHaveLength(1);
    expect(flow.$('.score-num')?.textContent).toBe('1');
  });
});
