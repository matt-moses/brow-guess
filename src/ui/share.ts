/** Share footer (results and home screens): QR code for the live site plus a share button. */
import qrUrl from '../../assets/qr-live-site.svg?url';
import { APP_NAME, SHARE_URL } from '../config.ts';
import { button, el } from './dom.ts';

/** Share the app: the native share sheet where there is one, else copy the link. */
async function shareApp(btn: HTMLButtonElement): Promise<void> {
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: APP_NAME, text: `Play ${APP_NAME} with us!`, url: SHARE_URL });
      return;
    }
    await navigator.clipboard.writeText(SHARE_URL);
    btn.textContent = 'Link copied';
  } catch {
    // Share sheet dismissed, or no clipboard access: the QR code is still there.
  }
}

/** Full-screen QR code, easier to scan across a room. Close, backdrop tap or Escape dismisses. */
function showLargeQr(opener: HTMLElement): void {
  const close = button('Close', 'btn btn-primary');
  const dialog = el(
    'div',
    {
      class: 'dialog qr-dialog',
      attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'QR code' },
    },
    el('img', {
      class: 'qr-large',
      attrs: { src: qrUrl, alt: `QR code for ${SHARE_URL}`, width: '320', height: '320' },
    }),
    el('p', { class: 'dialog-msg', text: `Scan to play ${APP_NAME}` }),
    close,
  );
  const backdrop = el('div', { class: 'dialog-backdrop' }, dialog);
  const dismiss = (): void => {
    backdrop.remove();
    opener.focus();
  };
  close.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) dismiss();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dismiss();
  });
  document.body.append(backdrop);
  close.focus();
}

/** Unobtrusive footer so onlookers can scan or share the game. */
export function shareFooter(): HTMLElement {
  const share = button('Share link', 'btn btn-small');
  share.addEventListener('click', () => void shareApp(share));
  const qr = el(
    'button',
    { class: 'share-qr-btn', attrs: { type: 'button', 'aria-label': 'Enlarge QR code' } },
    el('img', {
      class: 'share-qr',
      attrs: { src: qrUrl, alt: `QR code for ${SHARE_URL}`, width: '96', height: '96' },
    }),
  );
  qr.addEventListener('click', () => showLargeQr(qr));
  return el(
    'footer',
    { class: 'share-footer' },
    qr,
    el('div', { class: 'share-text' }, el('p', { text: `Scan to play ${APP_NAME}` }), share),
  );
}
