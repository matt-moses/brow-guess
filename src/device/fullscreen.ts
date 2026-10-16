/**
 * Fullscreen and orientation-lock adapter (FR-12). Best effort: every call
 * feature-detects (with webkit fallbacks), swallows errors, and never rejects.
 *
 * enterFullscreen() and lockLandscape() invoke the browser API synchronously
 * before their first await, so calling them inside a gesture handler keeps
 * the user activation.
 */

type MaybePromise = Promise<void> | void;

interface FsElement {
  requestFullscreen?: (options?: FullscreenOptions) => MaybePromise;
  webkitRequestFullscreen?: () => MaybePromise;
}

interface FsDocument {
  documentElement?: Element | null;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => MaybePromise;
  webkitExitFullscreen?: () => MaybePromise;
}

interface LockableOrientation {
  lock?: (orientation: string) => MaybePromise;
  unlock?: () => void;
}

function getDocument(): FsDocument | undefined {
  if (typeof document === 'undefined') return undefined;
  const doc: FsDocument = document;
  return doc;
}

function getScreenOrientation(): LockableOrientation | undefined {
  try {
    return (globalThis as { screen?: { orientation?: LockableOrientation } }).screen?.orientation;
  } catch {
    return undefined;
  }
}

/** True when the document is currently fullscreen (standard or webkit). */
export function isFullscreen(): boolean {
  try {
    const doc = getDocument();
    return Boolean(doc?.fullscreenElement ?? doc?.webkitFullscreenElement);
  } catch {
    return false;
  }
}

/** Request fullscreen on `el` (default: the document element). */
export async function enterFullscreen(el?: Element): Promise<void> {
  try {
    const target = (el ?? getDocument()?.documentElement) as FsElement | null | undefined;
    if (!target) return;
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen({ navigationUI: 'hide' });
    } else if (typeof target.webkitRequestFullscreen === 'function') {
      await target.webkitRequestFullscreen();
    }
  } catch {
    // Refused or unsupported: ignore.
  }
}

/** Leave fullscreen, only if currently fullscreen. */
export async function exitFullscreen(): Promise<void> {
  try {
    if (!isFullscreen()) return;
    const doc = getDocument();
    if (!doc) return;
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // ignore
  }
}

/** Lock the screen to landscape (usually requires fullscreen first). */
export async function lockLandscape(): Promise<void> {
  try {
    const orientation = getScreenOrientation();
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape');
    }
  } catch {
    // Unsupported (iOS) or not fullscreen: ignore.
  }
}

/** Release any orientation lock. */
export function unlockOrientation(): Promise<void> {
  try {
    const orientation = getScreenOrientation();
    if (orientation && typeof orientation.unlock === 'function') orientation.unlock();
  } catch {
    // ignore
  }
  return Promise.resolve();
}
