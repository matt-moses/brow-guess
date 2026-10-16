// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_DECK_KEY } from '../../src/app';
import { APP_NAME, FEEDBACK_MS } from '../../src/config';
import { decks } from '../../src/decks';
import type { StorageLike } from '../../src/deps';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.useRealTimers();
});

async function playThreeAndFinish(): Promise<string[]> {
  for (const p of [50, -50, 50]) {
    flow.tilt(p);
    flow.tilt(0);
    await flow.advance(FEEDBACK_MS);
  }
  await flow.advance(61_000);
  expect(flow.screen()).toBe('results');
  return [...document.querySelectorAll('.result-word')].map((n) => n.textContent ?? '');
}

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('results buttons', () => {
  it('Play again reuses the deck with a new shuffle and the full gesture path; Choose deck → home', async () => {
    flow = createFlow();
    await flow.toRound(2);
    const deckId = flow.app.state().deckId;
    expect(deckId).toBe(decks[2]?.id);
    const firstRun = await playThreeAndFinish();
    expect(firstRun).toHaveLength(3);
    for (const w of firstRun) expect(decks[2]?.words).toContain(w);

    flow.button('Play again').click();
    expect(flow.dev.requestPermission).toHaveBeenCalledTimes(2);
    expect(flow.dev.fullscreen.requestFullscreen).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.dev.wakeLock.active).toBe(1);
    expect(flow.screen()).toBe('ready');
    expect(flow.app.state().deckId).toBe(deckId);
    await flow.holdNeutral(1100);
    await flow.advance(3050);
    expect(flow.screen()).toBe('round');
    const secondRun = await playThreeAndFinish();
    for (const w of secondRun) expect(decks[2]?.words).toContain(w);
    expect(secondRun).not.toEqual(firstRun);

    flow.button('Choose deck').click();
    expect(flow.screen()).toBe('home');
  });

  it('results are readable: score heading, ✓ rows green-classed, ✗ rows dimmed-classed', async () => {
    flow = createFlow();
    await flow.toRound();
    await playThreeAndFinish();
    expect(flow.$('.results-score')?.textContent).toMatch(/^2 correct$/);
    const rows = [...document.querySelectorAll<HTMLElement>('.result')];
    expect(rows.map((r) => r.className)).toEqual([
      'result correct',
      'result pass',
      'result correct',
    ]);
    expect(rows[1]?.getAttribute('aria-label')).toMatch(/: passed$/);
  });
});

describe('home', () => {
  it('title and heading come from APP_NAME', () => {
    flow = createFlow();
    expect(document.title).toBe(APP_NAME);
    expect(flow.$('h1')?.textContent).toBe(APP_NAME);
  });

  it('every deck card is a focusable button with an accessible name', () => {
    flow = createFlow();
    const cards = [...flow.root.querySelectorAll<HTMLElement>('.deck-card')];
    expect(cards).toHaveLength(decks.length);
    cards.forEach((card, i) => {
      const deck = decks[i]!;
      expect(card.tagName).toBe('BUTTON');
      expect(card.getAttribute('type')).toBe('button');
      expect(card.getAttribute('aria-label')).toBe(`Play ${deck.title}: ${deck.description}`);
      expect(card.tabIndex).toBe(0);
      expect((card as HTMLButtonElement).disabled).toBe(false);
      expect(card.style.getPropertyValue('--deck-color')).toBe(deck.color);
      card.focus();
      expect(document.activeElement).toBe(card);
    });
  });

  it('remembers the last deck, marks it, and focuses it first', async () => {
    const storage = memoryStorage();
    flow = createFlow({ app: { storage } });
    expect(flow.root.querySelector('.deck-card.is-last')).toBeNull();
    await flow.startGame(3);
    expect(storage.data.get(LAST_DECK_KEY)).toBe(decks[3]?.id);
    flow.button('Quit round').click();
    expect(flow.screen()).toBe('home');
    const marked = flow.root.querySelector<HTMLElement>('.deck-card.is-last');
    expect(marked?.dataset.deck).toBe(decks[3]?.id);
    expect(document.activeElement).toBe(marked);
  });

  it('survives a throwing storage', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    flow = createFlow({ app: { storage } });
    expect(flow.screen()).toBe('home');
    flow.root.querySelector<HTMLButtonElement>('.deck-card')?.click();
    expect(flow.dev.requestPermission).toHaveBeenCalled();
  });
});
