/**
 * Screen Wake Lock adapter (FR-11). Silent when unsupported or refused.
 * Globals are read lazily, so creating a controller at import time is safe.
 */

export interface WakeLockController {
  /** Mark the lock as wanted and request it. Never rejects. */
  acquire(): Promise<void>;
  /** Clear "wanted" and release any held lock. Never rejects. */
  release(): Promise<void>;
  /** True while a sentinel is held and not yet released. */
  isHeld(): boolean;
  /** Release and stop listening for visibility changes. */
  dispose(): void;
}

interface SentinelLike {
  readonly released?: boolean;
  release(): Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
}

interface WakeLockApi {
  request(type: 'screen'): Promise<SentinelLike>;
}

function getApi(): WakeLockApi | undefined {
  try {
    const nav = (globalThis as { navigator?: { wakeLock?: Partial<WakeLockApi> } }).navigator;
    const api = nav?.wakeLock;
    if (api && typeof api.request === 'function') return api as WakeLockApi;
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Create a wake-lock controller. While wanted (after acquire(), until
 * release()), it re-acquires when the document becomes visible again, since
 * browsers drop the lock when the page is hidden.
 */
export function createWakeLock(): WakeLockController {
  let wanted = false;
  let sentinel: SentinelLike | null = null;
  let pending: Promise<void> | null = null;
  let listeningDoc: Document | null = null;

  const isHeld = (): boolean => sentinel !== null && sentinel.released !== true;

  const onVisibility = (): void => {
    if (!wanted || isHeld()) return;
    if (listeningDoc?.visibilityState !== 'visible') return;
    void request();
  };

  const listen = (): void => {
    if (listeningDoc || typeof document === 'undefined') return;
    try {
      document.addEventListener('visibilitychange', onVisibility);
      listeningDoc = document;
    } catch {
      // ignore
    }
  };

  const unlisten = (): void => {
    if (!listeningDoc) return;
    try {
      listeningDoc.removeEventListener('visibilitychange', onVisibility);
    } catch {
      // ignore
    }
    listeningDoc = null;
  };

  const doRequest = async (): Promise<void> => {
    const api = getApi();
    if (!api) return;
    try {
      const s = await api.request('screen');
      if (!wanted) {
        // release() was called while the request was in flight.
        await s.release();
        return;
      }
      sentinel = s;
      s.addEventListener?.('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      // Unsupported, hidden page, or policy refusal: degrade silently.
    }
  };

  function request(): Promise<void> {
    if (pending) return pending;
    pending = doRequest().finally(() => {
      pending = null;
    });
    return pending;
  }

  const releaseSentinel = async (): Promise<void> => {
    const s = sentinel;
    sentinel = null;
    if (!s || s.released === true) return;
    try {
      await s.release();
    } catch {
      // ignore
    }
  };

  return {
    async acquire() {
      wanted = true;
      listen();
      if (isHeld()) return;
      await request();
    },
    async release() {
      wanted = false;
      await releaseSentinel();
    },
    isHeld,
    dispose() {
      wanted = false;
      unlisten();
      void releaseSentinel();
    },
  };
}

/** App-wide wake-lock controller. */
export const wakeLock: WakeLockController = createWakeLock();
