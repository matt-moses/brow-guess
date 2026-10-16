import type { Deck } from './types.ts';

export type { Deck } from './types.ts';

/** Display order for the deck picker. Every bundled deck must appear here. */
export const DECK_ORDER = [
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
] as const;

// Eager glob bundles the JSON into the JS chunk, so the service worker precaches it.
const modules = import.meta.glob<{ default: Deck }>('./*.json', { eager: true });

const byId = new Map<string, Deck>();
for (const mod of Object.values(modules)) {
  byId.set(mod.default.id, mod.default);
}

export const decks: readonly Deck[] = DECK_ORDER.map((id) => {
  const deck = byId.get(id);
  if (!deck) throw new Error(`Missing deck: ${id}`);
  return deck;
});

export function getDeck(id: string): Deck | undefined {
  return decks.find((d) => d.id === id);
}
