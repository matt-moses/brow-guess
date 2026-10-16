import { button } from '../ui/dom.ts';

/** Top-left Quit button shared by the in-game screens. */
export function quitButton(onQuit: () => void): HTMLButtonElement {
  const b = button('✕', 'quit-btn', { 'aria-label': 'Quit round' });
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onQuit();
  });
  return b;
}
