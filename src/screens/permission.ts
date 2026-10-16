import type { AppDeps } from '../deps.ts';
import type { Screen } from '../router.ts';
import { button, el } from '../ui/dom.ts';

export interface PermissionProps {
  /** Called synchronously inside the click gesture (it re-requests permission). */
  onRetry: () => void;
  onBack: () => void;
}

export const permissionScreen: Screen<PermissionProps, AppDeps> = {
  name: 'permission',
  mount(root, props) {
    const retry = button('Try again', 'btn btn-primary');
    const back = button('Back', 'btn');
    retry.addEventListener('click', () => props.onRetry());
    back.addEventListener('click', () => props.onBack());
    root.append(
      el(
        'main',
        { class: 'screen screen-message' },
        el('h1', { text: 'Motion access needed' }),
        el('p', {
          text: 'The game reads your phone’s tilt to know when you guess or pass, and motion access was turned off.',
        }),
        el(
          'ol',
          { class: 'steps' },
          el('li', { text: 'Reload this page, tap a deck again, and choose Allow when asked.' }),
          el('li', {
            text: 'On older iOS versions: open Settings → Safari → Motion & Orientation Access, turn it on, then reload.',
          }),
        ),
        el('div', { class: 'actions' }, retry, back),
      ),
    );
    retry.focus();
  },
};
