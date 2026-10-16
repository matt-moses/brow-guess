import { APP_NAME } from '../config.ts';
import type { Deck } from '../decks/index.ts';
import type { AppDeps } from '../deps.ts';
import type { Screen } from '../router.ts';
import { el } from '../ui/dom.ts';
import { shareFooter } from '../ui/share.ts';

export interface HomeProps {
  decks: readonly Deck[];
  lastDeckId: string | null;
  /** Called synchronously inside the click gesture. */
  onPick: (deck: Deck) => void;
}

export const homeScreen: Screen<HomeProps, AppDeps> = {
  name: 'home',
  mount(root, props) {
    const grid = el('div', { class: 'deck-grid' });
    let focusTarget: HTMLButtonElement | null = null;
    for (const deck of props.decks) {
      const isLast = deck.id === props.lastDeckId;
      const card = el(
        'button',
        {
          class: isLast ? 'deck-card is-last' : 'deck-card',
          attrs: {
            type: 'button',
            'aria-label': `Play ${deck.title}: ${deck.description}`,
            'data-deck': deck.id,
          },
        },
        el('span', { class: 'deck-emoji', text: deck.emoji, attrs: { 'aria-hidden': 'true' } }),
        el('span', { class: 'deck-title', text: deck.title }),
        el('span', { class: 'deck-desc', text: deck.description }),
        isLast ? el('span', { class: 'deck-badge', text: 'Last played' }) : null,
      );
      card.style.setProperty('--deck-color', deck.color);
      card.addEventListener('click', () => props.onPick(deck));
      if (isLast) focusTarget = card;
      grid.append(card);
    }
    root.append(
      el(
        'main',
        { class: 'screen screen-home' },
        el('h1', { class: 'app-title', text: APP_NAME }),
        el('p', {
          class: 'tagline',
          text: 'Pick a deck, hold the phone to your forehead, and guess!',
        }),
        grid,
        shareFooter(),
      ),
    );
    focusTarget?.focus();
  },
};
