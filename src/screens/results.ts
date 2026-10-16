import type { AppDeps } from '../deps.ts';
import type { RoundResults } from '../game/round.ts';
import type { Screen } from '../router.ts';
import { button, el } from '../ui/dom.ts';

export interface ResultsProps {
  deckTitle: string;
  results: RoundResults;
  /** Called synchronously inside the click gesture. */
  onPlayAgain: () => void;
  onChooseDeck: () => void;
}

export const resultsScreen: Screen<ResultsProps, AppDeps> = {
  name: 'results',
  mount(root, props) {
    const { score, entries } = props.results;
    const list = el('ol', { class: 'results-list', attrs: { 'aria-label': 'Words this round' } });
    for (const { word, outcome } of entries) {
      const ok = outcome === 'correct';
      list.append(
        el(
          'li',
          {
            class: ok ? 'result correct' : 'result pass',
            attrs: {
              'data-outcome': outcome,
              'aria-label': `${word}: ${ok ? 'correct' : 'passed'}`,
            },
          },
          el('span', {
            class: 'result-mark',
            text: ok ? '✓' : '✗',
            attrs: { 'aria-hidden': 'true' },
          }),
          el('span', { class: 'result-word', text: word }),
        ),
      );
    }
    if (entries.length === 0)
      list.append(el('li', { class: 'result empty', text: 'No words answered' }));

    const again = button('Play again', 'btn btn-primary');
    const choose = button('Choose deck', 'btn');
    again.addEventListener('click', () => props.onPlayAgain());
    choose.addEventListener('click', () => props.onChooseDeck());

    root.append(
      el(
        'main',
        { class: 'screen screen-results' },
        el('p', { class: 'results-deck', text: props.deckTitle }),
        el(
          'h1',
          { class: 'results-score' },
          el('span', { class: 'score-num', text: String(score) }),
          el('span', { class: 'score-label', text: ' correct' }),
        ),
        list,
        el('div', { class: 'actions' }, again, choose),
      ),
    );
    again.focus();
  },
};
