// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_MS } from '../../src/config';
import type { StorageLike } from '../../src/deps';
import { loadSettings, SETTINGS_KEY } from '../../src/settings';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.useRealTimers();
});

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

/** Pick a segment on the settings screen by its legend and label. */
function choose(legend: string, label: string): void {
  const fieldset = [...document.querySelectorAll('fieldset')].find(
    (f) => f.querySelector('legend')?.textContent === legend,
  );
  const segment = [...(fieldset?.querySelectorAll('label') ?? [])].find(
    (l) => l.textContent === label,
  );
  const input = segment?.querySelector('input');
  if (!input) throw new Error(`no "${label}" in "${legend}"`);
  input.click();
}

describe('settings screen', () => {
  it('opens from home, shows the current values, saves each change and returns home', () => {
    const storage = memoryStorage();
    flow = createFlow({ app: { storage } });
    flow.button('Settings').click();
    expect(flow.screen()).toBe('settings');
    const checked = [...document.querySelectorAll<HTMLInputElement>('input:checked')].map(
      (i) => i.parentElement?.textContent,
    );
    expect(checked).toEqual(['60 s', 'On', 'Normal']);

    choose('Round length', '2 min');
    choose('Sound', 'Off');
    choose('Tilt sensitivity', 'High');
    expect(loadSettings(storage)).toEqual({ roundSeconds: 120, sound: false, sensitivity: 'high' });

    flow.button('Done').click();
    expect(flow.screen()).toBe('home');
    flow.button('Settings').click();
    const again = [...document.querySelectorAll<HTMLInputElement>('input:checked')].map(
      (i) => i.parentElement?.textContent,
    );
    expect(again).toEqual(['2 min', 'Off', 'High']);
  });

  it('uses the chosen round length', async () => {
    const storage = memoryStorage();
    storage.data.set(SETTINGS_KEY, JSON.stringify({ roundSeconds: 30 }));
    flow = createFlow({ app: { storage } });
    await flow.toRound();
    expect(flow.timer()).toBe('0:30');
    await flow.advance(30_100);
    expect(flow.screen()).toBe('results');
  });

  it('mutes every sound when sound is off', async () => {
    const storage = memoryStorage();
    storage.data.set(SETTINGS_KEY, JSON.stringify({ sound: false, roundSeconds: 30 }));
    const playSound = vi.fn();
    flow = createFlow({ app: { storage, device: { playSound } } });
    await flow.toRound();
    flow.tilt(50);
    flow.tilt(0);
    await flow.advance(31_000);
    expect(flow.screen()).toBe('results');
    expect(playSound).not.toHaveBeenCalled();
  });

  it('a 30° tilt only counts on high sensitivity', async () => {
    for (const [sensitivity, fires] of [
      ['normal', false],
      ['high', true],
    ] as const) {
      const storage = memoryStorage();
      storage.data.set(SETTINGS_KEY, JSON.stringify({ sensitivity }));
      flow = createFlow({ app: { storage } });
      await flow.toRound();
      flow.tilt(30);
      expect(flow.feedback().visible, sensitivity).toBe(fires);
      flow.tilt(0);
      await flow.advance(FEEDBACK_MS);
      flow.teardown();
    }
    flow = createFlow();
  });
});
