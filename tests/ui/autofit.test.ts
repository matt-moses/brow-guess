// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { domMeasure, fitText, type FitMeasure } from '../../src/ui/autofit';

/** Fake layout: a 800×300 box, glyphs 0.6em wide, 1.1em line height, no wrapping. */
const measure: FitMeasure = (el, size) => {
  const chars = el.textContent?.length ?? 0;
  return chars * size * 0.6 <= 800 && size * 1.1 <= 300;
};

function make(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  return el;
}

describe('fitText', () => {
  it('gives a long entry a smaller size than a short one', () => {
    const short = fitText(make('Cat'), { min: 12, max: 400, measure });
    const long = fitText(make('Brushing your teeth'), { min: 12, max: 400, measure });
    expect(long).toBeLessThan(short);
  });

  it('finds the largest fitting size and applies it', () => {
    const el = make('Brushing your teeth'); // 19 chars → 800 / (19 × 0.6) ≈ 70.2
    const size = fitText(el, { min: 12, max: 400, measure });
    expect(size).toBe(70);
    expect(el.style.fontSize).toBe('70px');
  });

  it('caps at max for tiny text (height-bound → 272)', () => {
    expect(fitText(make('A'), { min: 12, max: 400, measure })).toBe(272);
    expect(fitText(make('A'), { min: 12, max: 100, measure })).toBe(100);
  });

  it('always stays within [min, max]', () => {
    const texts = ['', 'X', 'Ox', 'Elephant', 'Brushing your teeth', 'W'.repeat(200)];
    for (const t of texts) {
      for (const [min, max] of [
        [10, 50],
        [24, 480],
        [40, 40],
        [60, 30],
      ] as const) {
        const s = fitText(make(t), { min, max, measure });
        expect(s).toBeGreaterThanOrEqual(Math.min(min, max));
        expect(s).toBeLessThanOrEqual(Math.max(min, max));
      }
    }
  });

  it('returns min when nothing fits', () => {
    expect(fitText(make('W'.repeat(500)), { min: 12, max: 400, measure })).toBe(12);
  });

  it('default DOM measure treats an unlaid-out box as fitting (jsdom)', () => {
    const box = document.createElement('div');
    const el = make('Hello');
    box.append(el);
    expect(domMeasure(el, 50)).toBe(true);
    expect(fitText(el, { min: 10, max: 90 })).toBe(90);
  });
});
