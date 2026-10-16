/**
 * Resource scope for a mounted screen: every listener, timer, RAF and
 * subscription registered here is released by dispose(), which screens return
 * as (part of) their router cleanup.
 */

export interface Scope {
  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
  ): void;
  listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ): void;
  listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ): void;
  listen(target: EventTarget, type: string, fn: (e: Event) => void): void;
  timeout(fn: () => void, ms: number): void;
  /** Start a RAF loop; `fn` returning false stops it. */
  loop(fn: (frameTime: number) => boolean | void): void;
  add(cleanup: () => void): void;
  readonly disposed: boolean;
  dispose(): void;
}

export function createScope(
  raf: (cb: FrameRequestCallback) => number,
  cancelRaf: (id: number) => void,
): Scope {
  const cleanups: (() => void)[] = [];
  let disposed = false;

  const add = (fn: () => void): void => {
    if (disposed) fn();
    else cleanups.push(fn);
  };

  return {
    listen(target: EventTarget, type: string, fn: (e: Event) => void) {
      if (disposed) return;
      target.addEventListener(type, fn);
      add(() => target.removeEventListener(type, fn));
    },
    timeout(fn, ms) {
      if (disposed) return;
      const id = setTimeout(fn, ms);
      add(() => clearTimeout(id));
    },
    loop(fn) {
      if (disposed) return;
      let id: number | null = null;
      const frame = (t: number): void => {
        id = null;
        if (disposed) return;
        if (fn(t) === false) return;
        if (!disposed) id = raf(frame);
      };
      id = raf(frame);
      add(() => {
        if (id !== null) cancelRaf(id);
        id = null;
      });
    },
    add,
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      while (cleanups.length) {
        try {
          cleanups.pop()?.();
        } catch {
          // keep releasing the rest
        }
      }
    },
  };
}
