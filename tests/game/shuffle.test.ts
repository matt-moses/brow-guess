import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle } from '../../src/game/shuffle';

describe('shuffle', () => {
  const input = Array.from({ length: 20 }, (_, i) => `w${i}`);

  it('returns a permutation of the input over 1,000 seeded runs', () => {
    const rng = mulberry32(12345);
    const sorted = [...input].sort();
    let changed = 0;
    for (let run = 0; run < 1000; run++) {
      const out = shuffle(input, rng);
      expect(out).toHaveLength(input.length);
      expect(new Set(out).size).toBe(input.length);
      expect([...out].sort()).toEqual(sorted);
      if (out.join() !== input.join()) changed++;
    }
    expect(changed).toBeGreaterThan(990);
  });

  it('does not mutate its input', () => {
    const copy = [...input];
    const frozen = Object.freeze([...input]);
    shuffle(input, mulberry32(1));
    expect(input).toEqual(copy);
    expect(() => shuffle(frozen, mulberry32(1))).not.toThrow();
  });

  it('returns a new array even for trivial inputs', () => {
    const empty: string[] = [];
    expect(shuffle(empty)).not.toBe(empty);
    expect(shuffle(empty)).toEqual([]);
    expect(shuffle(['a'])).toEqual(['a']);
  });

  it('is deterministic for a given seed', () => {
    expect(shuffle(input, mulberry32(42))).toEqual(shuffle(input, mulberry32(42)));
    expect(shuffle(input, mulberry32(42))).not.toEqual(shuffle(input, mulberry32(43)));
  });

  it('defaults to Math.random', () => {
    const out = shuffle(input);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it('is roughly uniform (each item lands in position 0 about equally often)', () => {
    const rng = mulberry32(7);
    const counts = new Map<string, number>();
    const items = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 8000; i++) {
      const first = shuffle(items, rng)[0] as string;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    for (const it of items) expect(counts.get(it)).toBeGreaterThan(1700);
  });
});

describe('mulberry32', () => {
  it('produces values in [0, 1) deterministically', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
