/**
 * Small corner toasts for service-worker events (FR-19). They live in one
 * polite live region on <body>, outside #app, so screen changes never wipe
 * them, and they sit in a bottom corner so they never cover the round word.
 */
import { button, el } from './dom.ts';

export const TOAST_REGION_ID = 'toasts';
/** How long the "ready offline" notice stays up. */
export const OFFLINE_TOAST_MS = 4000;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  actions?: ToastAction[];
  /** Auto-dismiss after this many ms; omit to keep it until dismissed. */
  timeoutMs?: number;
  /** Show a close (×) button. Defaults to true. */
  dismissible?: boolean;
}

export interface Toast {
  el: HTMLElement;
  dismiss(): void;
}

/** Signature of the `updateSW` function returned by `registerSW`. */
export type UpdateSW = (reloadPage?: boolean) => Promise<void>;

function region(doc: Document): HTMLElement {
  const existing = doc.getElementById(TOAST_REGION_ID);
  if (existing) return existing;
  const r = el('div', {
    class: 'toast-region',
    attrs: { id: TOAST_REGION_ID, role: 'status', 'aria-live': 'polite' },
  });
  doc.body.append(r);
  return r;
}

export function showToast(opts: ToastOptions, doc: Document = document): Toast {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const node = el(
    'div',
    { class: 'toast' },
    el('span', { class: 'toast-msg', text: opts.message }),
  );
  const dismiss = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    node.remove();
  };
  for (const action of opts.actions ?? []) {
    const b = button(action.label, 'toast-btn');
    b.addEventListener('click', () => {
      action.onClick();
      dismiss();
    });
    node.append(b);
  }
  if (opts.dismissible ?? true) {
    const close = button('×', 'toast-close', { 'aria-label': 'Dismiss' });
    close.addEventListener('click', dismiss);
    node.append(close);
  }
  if (opts.timeoutMs !== undefined) timer = setTimeout(dismiss, opts.timeoutMs);
  region(doc).append(node);
  return { el: node, dismiss };
}

/** "Update available" with a Reload button that activates the waiting worker. */
export function showUpdateToast(updateSW: UpdateSW, doc: Document = document): Toast {
  return showToast(
    {
      message: 'Update available',
      actions: [{ label: 'Reload', onClick: () => void updateSW(true) }],
    },
    doc,
  );
}

export function showOfflineReadyToast(doc: Document = document): Toast {
  return showToast({ message: 'Ready to play offline', timeoutMs: OFFLINE_TOAST_MS }, doc);
}
