/**
 * Auto-fit text (FR-21): binary-search the largest integer font size (px) in
 * [min, max] at which `el` still fits. Measurement is injectable because jsdom
 * has no layout.
 */

/** True if `el` fits its container when rendered at `sizePx`. */
export type FitMeasure = (el: HTMLElement, sizePx: number) => boolean;

export interface FitOptions {
  min: number;
  max: number;
  measure?: FitMeasure;
}

/**
 * Default measure: apply the size, then compare the element's scroll size with
 * its parent's client box. A parent with no layout (0×0) counts as fitting.
 */
export const domMeasure: FitMeasure = (el, sizePx) => {
  el.style.fontSize = `${sizePx}px`;
  const box = el.parentElement;
  if (!box || box.clientWidth === 0 || box.clientHeight === 0) return true;
  return el.scrollWidth <= box.clientWidth && el.scrollHeight <= box.clientHeight;
};

/** Fit `el`, set its font-size, and return the chosen size (always within [min, max]). */
export function fitText(el: HTMLElement, opts: FitOptions): number {
  const measure = opts.measure ?? domMeasure;
  const min = Math.floor(Math.min(opts.min, opts.max));
  const max = Math.floor(Math.max(opts.min, opts.max));
  let lo = min;
  let hi = max;
  let best = min;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (measure(el, mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  el.style.fontSize = `${best}px`;
  return best;
}
