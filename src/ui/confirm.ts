/**
 * In-page confirm dialog. window.confirm() is avoided because it exits (or is
 * blocked in) fullscreen on mobile browsers.
 */
import { button, el } from './dom.ts';

let seq = 0;

export function inPageConfirm(
  message: string,
  opts: { confirmLabel: string; cancelLabel: string },
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = `confirm-msg-${++seq}`;
    const ok = button(opts.confirmLabel, 'btn btn-danger');
    const cancel = button(opts.cancelLabel, 'btn btn-primary');
    const dialog = el(
      'div',
      {
        class: 'dialog',
        attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': id },
      },
      el('p', { class: 'dialog-msg', text: message, attrs: { id } }),
      el('div', { class: 'dialog-actions' }, cancel, ok),
    );
    const backdrop = el('div', { class: 'dialog-backdrop' }, dialog);
    const finish = (result: boolean): void => {
      backdrop.remove();
      resolve(result);
    };
    ok.addEventListener('click', () => finish(true));
    cancel.addEventListener('click', () => finish(false));
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(false);
    });
    document.body.append(backdrop);
    cancel.focus();
  });
}
