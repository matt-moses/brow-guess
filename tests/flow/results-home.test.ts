// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_DECK_KEY } from '../../src/app';
import { APP_NAME, FEEDBACK_MS, SHARE_URL } from '../../src/config';
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

describe('results share footer', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('sits last on the screen with a QR code for the live site', async () => {
    flow = createFlow();
    await flow.toRound();
    await playThreeAndFinish();
    const main = flow.$('.screen-results');
    expect(main?.lastElementChild?.className).toBe('share-footer');
    const qr = flow.$<HTMLImageElement>('.share-qr');
    expect(qr?.getAttribute('src')).toBeTruthy();
    expect(qr?.alt).toContain(SHARE_URL);
  });

  it('opens the native share sheet when there is one', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    flow = createFlow();
    await flow.toRound();
    await playThreeAndFinish();
    flow.button('Share link').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: SHARE_URL }));
  });

  it('copies the link when there is no share sheet', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    flow = createFlow();
    await flow.toRound();
    await playThreeAndFinish();
    const btn = flow.button('Share link');
    btn.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
    expect(btn.textContent).toBe('Link copied');
  });
});

describe('home', () => {
  it('title and heading come from APP_NAME', () => {
    flow = createFlow();
    expect(document.title).toBe(APP_NAME);
    expect(flow.$('h1')?.textContent).toBe(APP_NAME);
  });

  it('ends with the share footer, below the deck grid', () => {
    flow = createFlow();
    const main = flow.$('.screen-home');
    expect(main?.lastElementChild?.className).toBe('share-footer');
    expect(flow.$<HTMLImageElement>('.share-qr')?.alt).toContain(SHARE_URL);
    expect(flow.button('Share link')).toBeTruthy();
  });

  it('tapping the QR code enlarges it; Close, backdrop tap and Escape dismiss it', () => {
    flow = createFlow();
    const qr = flow.button('Enlarge QR code');
    const open = (): HTMLElement => {
      qr.click();
      const dialog = document.querySelector<HTMLElement>('.qr-dialog');
      expect(dialog?.getAttribute('aria-modal')).toBe('true');
      expect(dialog?.querySelector<HTMLImageElement>('.qr-large')?.alt).toContain(SHARE_URL);
      return dialog!;
    };
    const isClosed = (): void => {
      expect(document.querySelector('.qr-dialog')).toBeNull();
      expect(document.activeElement).toBe(qr);
    };

    open();
    expect(document.activeElement).toBe(flow.button('Close'));
    flow.button('Close').click();
    isClosed();

    open();
    document.querySelector<HTMLElement>('.dialog-backdrop')!.click();
    isClosed();

    const dialog = open();
    dialog.querySelector<HTMLImageElement>('.qr-large')!.click();
    expect(document.querySelector('.qr-dialog')).not.toBeNull();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    isClosed();
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
