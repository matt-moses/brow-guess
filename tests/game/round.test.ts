import { describe, expect, it } from 'vitest';
import { ROUND_SECONDS } from '../../src/config';
import { createRound } from '../../src/game/round';
import { mulberry32 } from '../../src/game/shuffle';

function fakeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (ms: number) => {
      t = ms;
    },
  };
}

const WORDS = ['cat', 'dog', 'owl', 'yak', 'emu'];

describe('createRound', () => {
  it('defaults to ROUND_SECONDS and does nothing before start', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    expect(r.remainingMs()).toBe(ROUND_SECONDS * 1000);
    expect(r.elapsedMs()).toBe(0);
    expect(r.current()).toBeNull();
    expect(r.isOver()).toBe(false);
    expect(r.endReason()).toBeNull();
    expect(r.answer('correct')).toBe(false);
    r.pause();
    expect(r.isPaused()).toBe(false);
    clock.advance(10_000);
    expect(r.remainingMs()).toBe(60_000);
    expect(r.results()).toEqual({ score: 0, entries: [] });
  });

  it('shuffles all words at start with no repeats', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now, rng: mulberry32(3) });
    r.start();
    const seen: string[] = [];
    while (!r.isOver()) {
      seen.push(r.current() as string);
      r.answer('correct');
    }
    expect(seen).toHaveLength(WORDS.length);
    expect([...seen].sort()).toEqual([...WORDS].sort());
    expect(r.endReason()).toBe('exhausted');
  });

  it('is deterministic with a seeded rng and de-duplicates input words', () => {
    const order = (seed: number, words: string[]) => {
      const r = createRound({ words, now: fakeClock().now, rng: mulberry32(seed) });
      r.start();
      const out: string[] = [];
      while (!r.isOver()) {
        out.push(r.current() as string);
        r.answer('correct');
      }
      return out;
    };
    expect(order(9, WORDS)).toEqual(order(9, WORDS));
    expect(order(9, ['a', 'a', 'b'])).toHaveLength(2);
  });

  it('start() twice is a no-op', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now, rng: mulberry32(1) });
    r.start();
    const first = r.current();
    clock.advance(5000);
    r.start();
    expect(r.current()).toBe(first);
    expect(r.elapsedMs()).toBe(5000);
  });

  it('scores correct answers and records ordered results', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now, rng: mulberry32(5) });
    r.start();
    const expected: { word: string; outcome: 'correct' | 'pass' }[] = [];
    for (const outcome of ['correct', 'pass', 'correct', 'correct'] as const) {
      expected.push({ word: r.current() as string, outcome });
      expect(r.answer(outcome)).toBe(true);
    }
    const res = r.results();
    expect(res.score).toBe(3);
    expect(res.entries).toEqual(expected);
    // results() returns copies.
    res.entries.length = 0;
    expect(r.results().entries).toHaveLength(4);
  });

  it('keeps accurate time with an irregular clock (dropped frames)', () => {
    const clock = fakeClock(50_000);
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    for (const dt of [16, 17, 500, 3, 2000, 16, 7448]) clock.advance(dt);
    expect(r.elapsedMs()).toBe(10_000);
    expect(r.remainingMs()).toBe(50_000);
    clock.advance(45_000); // one huge jump
    expect(r.remainingMs()).toBe(5000);
    expect(r.isOver()).toBe(false);
    clock.advance(30_000); // overshoot clamps
    expect(r.remainingMs()).toBe(0);
    expect(r.elapsedMs()).toBe(60_000);
    expect(r.isOver()).toBe(true);
  });

  it('isOver at exactly 60 s, not 1 ms before', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    clock.advance(59_999);
    expect(r.isOver()).toBe(false);
    expect(r.remainingMs()).toBe(1);
    clock.advance(1);
    expect(r.isOver()).toBe(true);
    expect(r.endReason()).toBe('time');
    expect(r.current()).toBeNull();
    expect(r.remainingMs()).toBe(0);
  });

  it('honours a custom roundMs', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now, roundMs: 5000 });
    r.start();
    clock.advance(5000);
    expect(r.endReason()).toBe('time');
  });

  it('pause excludes elapsed time; resume continues', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    clock.advance(20_000);
    r.pause();
    expect(r.isPaused()).toBe(true);
    const word = r.current();
    expect(r.answer('correct')).toBe(false); // no answers while paused
    expect(r.current()).toBe(word);
    clock.advance(120_000); // long background period
    expect(r.remainingMs()).toBe(40_000);
    expect(r.isOver()).toBe(false);
    r.pause(); // double pause is harmless
    clock.advance(5000);
    r.resume();
    expect(r.isPaused()).toBe(false);
    expect(r.remainingMs()).toBe(40_000);
    clock.advance(10_000);
    expect(r.remainingMs()).toBe(30_000);
    r.resume(); // resume when not paused is a no-op
    // Second pause cycle accumulates correctly.
    r.pause();
    clock.advance(7000);
    r.resume();
    clock.advance(30_000);
    expect(r.isOver()).toBe(true);
    expect(r.endReason()).toBe('time');
  });

  it('cannot pause after the round is over', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    clock.advance(60_000);
    r.pause();
    expect(r.isPaused()).toBe(false);
  });

  it('on exhaustion, reshuffles passed words into the queue (one retry each)', () => {
    const clock = fakeClock();
    const words = ['a', 'b', 'c', 'd'];
    const r = createRound({ words, now: clock.now, rng: mulberry32(11) });
    r.start();
    const firstLap: string[] = [];
    // First lap: pass the 1st and 3rd words shown, answer the rest correct.
    const outcomes = ['pass', 'correct', 'pass', 'correct'] as const;
    const passed: string[] = [];
    for (const o of outcomes) {
      const w = r.current() as string;
      firstLap.push(w);
      if (o === 'pass') passed.push(w);
      r.answer(o);
    }
    expect([...firstLap].sort()).toEqual(words);
    expect(r.isOver()).toBe(false);
    // Second lap: exactly the passed words, in some order.
    const retry: string[] = [];
    while (!r.isOver()) {
      retry.push(r.current() as string);
      r.answer('pass'); // passing again does not earn another retry
    }
    expect([...retry].sort()).toEqual([...passed].sort());
    expect(r.endReason()).toBe('exhausted');
    expect(r.results().entries).toHaveLength(6);
    expect(r.results().score).toBe(2);
  });

  it('a retried word answered correct is never shown again', () => {
    const r = createRound({ words: ['x', 'y'], now: fakeClock().now, rng: mulberry32(2) });
    r.start();
    r.answer('pass');
    r.answer('pass');
    r.answer('correct');
    r.answer('correct');
    expect(r.isOver()).toBe(true);
    const res = r.results();
    expect(res.score).toBe(2);
    const corrects = res.entries.filter((e) => e.outcome === 'correct').map((e) => e.word);
    expect(new Set(corrects).size).toBe(corrects.length);
  });

  it('exhaustion with all correct ends early and freezes the clock', () => {
    const clock = fakeClock();
    const r = createRound({ words: ['a', 'b'], now: clock.now });
    r.start();
    clock.advance(1000);
    r.answer('correct');
    clock.advance(1500);
    r.answer('correct');
    expect(r.isOver()).toBe(true);
    expect(r.endReason()).toBe('exhausted');
    expect(r.current()).toBeNull();
    clock.advance(100_000);
    expect(r.elapsedMs()).toBe(2500);
    expect(r.remainingMs()).toBe(57_500);
    expect(r.endReason()).toBe('exhausted');
  });

  it('an empty word list is exhausted immediately on start', () => {
    const r = createRound({ words: [], now: fakeClock().now });
    r.start();
    expect(r.isOver()).toBe(true);
    expect(r.endReason()).toBe('exhausted');
    expect(r.current()).toBeNull();
  });

  it('answer() after the round is over is a no-op', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    r.answer('correct');
    clock.advance(60_000);
    expect(r.answer('correct')).toBe(false);
    expect(r.answer('pass')).toBe(false);
    expect(r.results()).toMatchObject({ score: 1 });
    expect(r.results().entries).toHaveLength(1);

    const r2 = createRound({ words: ['solo'], now: clock.now });
    r2.start();
    r2.answer('correct');
    expect(r2.answer('correct')).toBe(false);
    expect(r2.results().score).toBe(1);
  });

  it('time-out is detected by answer() even without a prior query', () => {
    const clock = fakeClock();
    const r = createRound({ words: WORDS, now: clock.now });
    r.start();
    clock.advance(61_000);
    expect(r.answer('correct')).toBe(false);
    expect(r.endReason()).toBe('time');
  });
});
