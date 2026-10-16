import type { AppDeps } from '../deps.ts';
import type { Screen } from '../router.ts';
import { el } from '../ui/dom.ts';
import { quitButton } from './quit.ts';

export interface PausedProps {
  /** Called synchronously inside the tap gesture. */
  onResume: () => void;
  onQuit: () => void;
}

/** FR-10: "Paused — tap to resume". The whole screen is one button. */
export const pausedScreen: Screen<PausedProps, AppDeps> = {
  name: 'paused',
  mount(root, props) {
    const resume = el(
      'button',
      { class: 'paused-btn', attrs: { type: 'button' } },
      el('span', { class: 'paused-title', text: 'Paused — tap to resume' }),
    );
    resume.addEventListener('click', () => props.onResume());
    root.append(
      el(
        'main',
        { class: 'screen screen-paused' },
        quitButton(() => props.onQuit()),
        resume,
      ),
    );
    resume.focus();
  },
};
