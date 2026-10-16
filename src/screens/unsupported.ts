import type { AppDeps } from '../deps.ts';
import type { Screen } from '../router.ts';
import { button, el } from '../ui/dom.ts';

export interface UnsupportedProps {
  onBack: () => void;
}

export const unsupportedScreen: Screen<UnsupportedProps, AppDeps> = {
  name: 'unsupported',
  mount(root, props) {
    const back = button('Back', 'btn btn-primary');
    back.addEventListener('click', () => props.onBack());
    root.append(
      el(
        'main',
        { class: 'screen screen-message' },
        el('h1', { text: 'Motion sensors not available — play on a phone' }),
        el('p', {
          text: 'No tilt readings arrived from this device. Open the game on a phone or tablet with motion sensors.',
        }),
        el('div', { class: 'actions' }, back),
      ),
    );
    back.focus();
  },
};
