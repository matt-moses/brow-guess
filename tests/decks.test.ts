import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decks, getDeck } from '../src/decks/index.ts';
import type { Deck } from '../src/decks/types.ts';

const EXPECTED_IDS = [
  'animals',
  'food-drink',
  'act-it-out',
  'sports',
  'jobs',
  'places-landmarks',
  'around-the-house',
  'kids-mix',
  'harry-potter',
  'music',
  'science-space',
  'fairy-tales',
  'holidays',
  'things-that-go',
  'nature-weather',
  'inventions',
  'hobbies',
  'countries',
  'cybersecurity',
  'hacker',
];

const decksDir = fileURLToPath(new URL('../src/decks/', import.meta.url));
const jsonFiles = readdirSync(decksDir).filter((f) => f.endsWith('.json'));

const normalize = (w: string): string => w.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Family-safety guard: whole-word terms that must never appear in a deck
 * (alcohol, tobacco, drugs, weapons, violence, gambling, adult content).
 * Compound words such as "Butterbeer" are allowed; "Beer" on its own is not.
 */
const UNSAFE =
  /\b(beer|wine|vodka|whisk(e)?y|rum|tequila|cocktail|booze|drunk|hangover|cigarettes?|cigars?|vape|smoking|weed|drugs?|guns?|rifle|pistol|shotgun|grenade|bomb|kill(ing|er)?|murder|stab|suicide|casino|gambling|poker|sexy?|naked|nude|kiss(ing)?|strip(per)?|hell|damn)\b/i;

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe('deck collection', () => {
  it('contains exactly the expected decks in display order', () => {
    expect(decks.map((d) => d.id)).toEqual(EXPECTED_IDS);
  });

  it('has unique ids', () => {
    expect(new Set(decks.map((d) => d.id)).size).toBe(decks.length);
  });

  it('bundles every JSON file in src/decks', () => {
    expect(jsonFiles.map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('getDeck finds decks by id and returns undefined for unknown ids', () => {
    for (const deck of decks) expect(getDeck(deck.id)).toBe(deck);
    expect(getDeck('nope')).toBeUndefined();
  });
});

describe.each(decks.map((d) => [d.id, d] as [string, Deck]))('deck %s', (id, deck) => {
  it('id matches its filename', async () => {
    expect(jsonFiles).toContain(`${id}.json`);
    const raw = (await import(`../src/decks/${id}.json`)) as { default: Deck };
    expect(raw.default.id).toBe(id);
  });

  it('has every field present and well-typed', () => {
    expect(Object.keys(deck).sort()).toEqual(
      ['color', 'description', 'emoji', 'id', 'title', 'words'].sort(),
    );
    for (const key of ['id', 'title', 'emoji', 'description', 'color'] as const) {
      expect(typeof deck[key]).toBe('string');
      expect(deck[key].trim()).not.toBe('');
    }
    expect(Array.isArray(deck.words)).toBe(true);
    for (const w of deck.words) expect(typeof w).toBe('string');
  });

  it('has a #rrggbb color', () => {
    expect(deck.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('keeps white text legible on its colour (WCAG AA, 4.5:1)', () => {
    expect(1.05 / (luminance(deck.color) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it('is family safe', () => {
    const text = [deck.title, deck.description, ...deck.words];
    expect(text.filter((w) => UNSAFE.test(w))).toEqual([]);
  });

  it('has at least 40 words', () => {
    expect(deck.words.length).toBeGreaterThanOrEqual(40);
  });

  it('has no empty or whitespace-only entries', () => {
    expect(deck.words.filter((w) => w.trim() === '')).toEqual([]);
  });

  it('has no duplicate words (case- and whitespace-insensitive)', () => {
    const seen = new Set<string>();
    const dupes = deck.words.filter((w) => {
      const n = normalize(w);
      if (seen.has(n)) return true;
      seen.add(n);
      return false;
    });
    expect(dupes).toEqual([]);
  });

  it('keeps every entry at 28 characters or fewer', () => {
    expect(deck.words.filter((w) => w.length > 28)).toEqual([]);
  });
});
