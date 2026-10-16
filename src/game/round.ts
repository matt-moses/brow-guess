import { ROUND_SECONDS } from '../config';
import { shuffle, type Rng } from './shuffle';

export type Outcome = 'correct' | 'pass';
export type EndReason = 'time' | 'exhausted';

export interface RoundEntry {
  word: string;
  outcome: Outcome;
}

export interface RoundResults {
  /** Number of `correct` answers. */
  score: number;
  /** Every answer, in the order it was given. */
  entries: RoundEntry[];
}

export interface RoundOptions {
  words: readonly string[];
  /** Monotonic clock in ms (e.g. `performance.now`). The only time source. */
  now: () => number;
  /** Round length in ms. Defaults to ROUND_SECONDS * 1000. */
  roundMs?: number;
  /** RNG for shuffling. Defaults to Math.random. */
  rng?: Rng;
}

export interface Round {
  /** Shuffle the words and start the clock. No-op if already started. */
  start(): void;
  /**
   * Record an answer for the current word and advance. Returns `true` if
   * accepted; a no-op returning `false` before start, while paused, or once over.
   */
  answer(outcome: Outcome): boolean;
  /** Word on screen, or `null` before start / when over. */
  current(): string | null;
  /** Remaining ms in [0, roundMs]; frozen while paused and once over. */
  remainingMs(): number;
  /** Elapsed active (unpaused) ms in [0, roundMs]. */
  elapsedMs(): number;
  /** True when time has run out (elapsed ≥ roundMs) or the deck is exhausted. */
  isOver(): boolean;
  endReason(): EndReason | null;
  /** Freeze the clock (FR-10). No-op before start, when over, or already paused. */
  pause(): void;
  /** Continue the clock; paused time is excluded. No-op if not paused. */
  resume(): void;
  isPaused(): boolean;
  results(): RoundResults;
}

/**
 * Pure round logic (FR-3, FR-8..10). The timer is derived from `now()` deltas
 * only, so dropped frames or irregular sampling cannot skew it.
 *
 * Words are de-duplicated and shuffled at start. When the queue empties, the
 * words passed so far that have not yet been re-shown are reshuffled into the
 * queue (each passed word gets at most one retry). If there are none, the
 * round ends early with reason `'exhausted'`. No word can be answered correct
 * twice.
 */
export function createRound(opts: RoundOptions): Round {
  const { now, rng = Math.random } = opts;
  const roundMs = opts.roundMs ?? ROUND_SECONDS * 1000;
  const words = [...new Set(opts.words)];

  let started = false;
  let startedAt = 0;
  let pausedTotal = 0;
  let pausedAt: number | null = null;
  let ended: EndReason | null = null;
  /** Active elapsed ms frozen at the moment the round ended. */
  let endedElapsed = 0;

  let queue: string[] = [];
  let currentWord: string | null = null;
  const passedPending: string[] = [];
  const retried = new Set<string>();
  const entries: RoundEntry[] = [];

  function rawElapsed(): number {
    if (!started) return 0;
    const t = pausedAt ?? now();
    return Math.max(0, t - startedAt - pausedTotal);
  }

  function end(reason: EndReason, elapsed: number): void {
    ended = reason;
    endedElapsed = Math.min(elapsed, roundMs);
    currentWord = null;
    pausedAt = null;
  }

  /** Lazily detect time-out so every query sees a consistent state. */
  function checkTime(): void {
    if (started && ended === null) {
      const e = rawElapsed();
      if (e >= roundMs) end('time', e);
    }
  }

  function advance(): void {
    if (queue.length === 0 && passedPending.length > 0) {
      for (const w of passedPending) retried.add(w);
      queue = shuffle(passedPending, rng);
      passedPending.length = 0;
    }
    const next = queue.shift();
    if (next === undefined) {
      end('exhausted', rawElapsed());
    } else {
      currentWord = next;
    }
  }

  function elapsedMs(): number {
    checkTime();
    return ended !== null ? endedElapsed : Math.min(rawElapsed(), roundMs);
  }

  return {
    start() {
      if (started) return;
      started = true;
      startedAt = now();
      queue = shuffle(words, rng);
      advance();
    },
    answer(outcome) {
      checkTime();
      if (!started || ended !== null || pausedAt !== null) return false;
      // Started, not over: there is always a current word.
      const word = currentWord as string;
      entries.push({ word, outcome });
      if (outcome === 'pass' && !retried.has(word)) passedPending.push(word);
      advance();
      return true;
    },
    current() {
      checkTime();
      return currentWord;
    },
    remainingMs: () => roundMs - elapsedMs(),
    elapsedMs,
    isOver() {
      checkTime();
      return ended !== null;
    },
    endReason() {
      checkTime();
      return ended;
    },
    pause() {
      checkTime();
      if (!started || ended !== null || pausedAt !== null) return;
      pausedAt = now();
    },
    resume() {
      if (pausedAt === null) return;
      pausedTotal += now() - pausedAt;
      pausedAt = null;
    },
    isPaused: () => pausedAt !== null,
    results() {
      return {
        score: entries.filter((e) => e.outcome === 'correct').length,
        entries: entries.map((e) => ({ ...e })),
      };
    },
  };
}
