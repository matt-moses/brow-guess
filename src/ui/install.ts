/**
 * "Install app" control for the share footer. Chrome and Edge fire
 * `beforeinstallprompt` once the PWA is installable; we keep that event so a
 * player who missed the browser's own prompt can bring it back with a tap.
 * iOS has no such event, so there we show the Add to Home Screen steps instead.
 */
import { button, el } from './dom.ts';

/** Chromium-only event, not in lib.dom. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function changed(): void {
  for (const l of listeners) l();
}

/** Call once at startup, before the first screen renders, so the event is never missed. */
export function initInstall(win: Window = window): void {
  win.addEventListener('beforeinstallprompt', (e) => {
    // No preventDefault: the browser still shows its own prompt the first time.
    deferred = e as BeforeInstallPromptEvent;
    changed();
  });
  win.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    changed();
  });
}

/** True when running as the installed app rather than in a browser tab. */
function runningInstalled(): boolean {
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  if (typeof matchMedia !== 'function') return false;
  if (matchMedia('(display-mode: standalone)').matches) return true;
  // The manifest asks for fullscreen, but a round's Fullscreen API call also matches this.
  return matchMedia('(display-mode: fullscreen)').matches && !document.fullscreenElement;
}

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch). */
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

async function promptInstall(): Promise<void> {
  const e = deferred;
  if (!e) return;
  // Each event can prompt only once; Chrome fires a fresh one later if still installable.
  deferred = null;
  changed();
  await e.prompt();
}

/** Install button (or iOS hint) for the footer; hidden when there is nothing to offer. */
export function installControl(): HTMLElement {
  const btn = button('Install app', 'btn btn-small');
  btn.addEventListener('click', () => void promptInstall());
  const hint = el('p', {
    class: 'install-hint',
    text: 'To install, tap Share, then Add to Home Screen.',
  });
  const wrap = el('div', { class: 'install' }, btn, hint);

  const render = (): void => {
    const skip = installed || runningInstalled();
    btn.hidden = skip || deferred === null;
    hint.hidden = skip || !isIos();
    wrap.hidden = btn.hidden && hint.hidden;
  };
  const listener = (): void => {
    // Screens rebuild the footer, so drop listeners whose control has left the page.
    if (!wrap.isConnected) listeners.delete(listener);
    else render();
  };
  listeners.add(listener);
  render();
  return wrap;
}

/** Test hook: forget any captured event and listeners. */
export function resetInstall(): void {
  deferred = null;
  installed = false;
  listeners.clear();
}
