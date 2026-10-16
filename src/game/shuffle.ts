/** Source of uniform random numbers in [0, 1), e.g. `Math.random`. */
export type Rng = () => number;

/**
 * Fisher–Yates shuffle (FR-3). Returns a new array; the input is never mutated.
 * Every permutation is equally likely given a uniform `rng`.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Small, fast seeded PRNG (mulberry32). Deterministic for a given 32-bit seed;
 * returns values in [0, 1). Intended for tests and reproducible shuffles.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
