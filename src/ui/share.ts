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

/** Unobtrusive footer so onlookers can scan or share the game. */
export function shareFooter(): HTMLElement {
  const share = button('Share link', 'btn btn-small');
  share.addEventListener('click', () => void shareApp(share));
  return el(
    'footer',
    { class: 'share-footer' },
    el('img', {
      class: 'share-qr',
      attrs: { src: qrUrl, alt: `QR code for ${SHARE_URL}`, width: '96', height: '96' },
    }),
    el('div', { class: 'share-text' }, el('p', { text: `Scan to play ${APP_NAME}` }), share),
  );
}
