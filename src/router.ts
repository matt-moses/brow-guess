/**
 * In-memory screen router (PRD §7.4): no History API, no hash. Showing a
 * screen always runs the previous screen's cleanup first, so listeners,
 * timers, and RAF loops never outlive their screen.
 */

export type Cleanup = () => void;

export interface Screen<P, C> {
  /** Stable name, exposed for tests and the `data-screen` attribute. */
  readonly name: string;
  /** Render into `root` (already emptied) and return a cleanup. */
  mount(root: HTMLElement, props: P, ctx: C): Cleanup | void;
}

export interface Router<C> {
  show<P>(screen: Screen<P, C>, props: P): void;
  /** Name of the mounted screen, or null. */
  current(): string | null;
  /** Clean up the mounted screen and empty the root. */
  destroy(): void;
}

export function createRouter<C>(root: HTMLElement, ctx: C): Router<C> {
  let cleanup: Cleanup | null = null;
  let currentName: string | null = null;
  let generation = 0;

  function unmount(): void {
    const prev = cleanup;
    cleanup = null;
    currentName = null;
    try {
      prev?.();
    } finally {
      root.replaceChildren();
      delete root.dataset.screen;
    }
  }

  return {
    show(screen, props) {
      unmount();
      const gen = ++generation;
      currentName = screen.name;
      root.dataset.screen = screen.name;
      const result = screen.mount(root, props, ctx) ?? null;
      if (gen !== generation) {
        // The screen navigated away during its own mount; drop it now.
        result?.();
        return;
      }
      cleanup = result;
    },
    current: () => currentName,
    destroy() {
      generation++;
      unmount();
    },
  };
}
