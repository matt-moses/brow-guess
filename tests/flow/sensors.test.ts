// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SENSOR_TIMEOUT_MS } from '../../src/config';
import { createFlow, useFlowTimers, type Flow } from '../helpers/flow';

let flow: Flow;

beforeEach(() => useFlowTimers());
afterEach(() => {
  flow.teardown();
  vi.useRealTimers();
});

describe('permission & sensor availability', () => {
  it('iOS denied → permission screen with reload + Settings instructions; Back → home', async () => {
    flow = createFlow({ device: { permission: 'denied' } });
    await flow.startGame(0);
    expect(flow.screen()).toBe('permission');
    const text = flow.root.textContent ?? '';
    expect(text).toMatch(/Reload this page/);
    expect(text).toContain('Settings → Safari → Motion & Orientation Access');
    expect(flow.dev.wakeLock.active).toBe(0);

    flow.button('Try again').click();
    expect(flow.dev.requestPermission).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.screen()).toBe('permission');

    flow.dev.setPermission('granted');
    flow.button('Try again').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(flow.screen()).toBe('ready');

    flow.button('Quit round').click();
    expect(flow.screen()).toBe('home');
  });

  it('Back on the permission screen returns home', async () => {
    flow = createFlow({ device: { permission: 'denied' } });
    await flow.startGame(0);
    flow.button('Back').click();
    expect(flow.screen()).toBe('home');
  });

  it(`no orientation events within ${SENSOR_TIMEOUT_MS} ms → unsupported screen`, async () => {
    flow = createFlow({ device: { permission: 'absent' } });
    flow.tilt(null);
    await flow.startGame(0);
    expect(flow.screen()).toBe('ready');
    flow.dev.dispatchOrientation({}); // desktop Chrome's null reading doesn't count
    await flow.advance(SENSOR_TIMEOUT_MS - 100);
    expect(flow.screen()).toBe('ready');
    await flow.advance(200);
    expect(flow.screen()).toBe('unsupported');
    expect(flow.root.textContent).toContain('Motion sensors not available — play on a phone');
    expect(flow.dev.wakeLock.active).toBe(0);
    flow.button('Back').click();
    expect(flow.screen()).toBe('home');
  });

  it('portrait shows the rotate overlay and the countdown does not start', async () => {
    flow = createFlow({ device: { angle: 0 } });
    await flow.startGame(0);
    const overlay = (): string | undefined => flow.$('.rotate-overlay')?.dataset.portrait;
    expect(overlay()).toBe('true');
    await flow.holdNeutral(3000);
    expect(flow.screen()).toBe('ready');
    expect(overlay()).toBe('true');

    flow.dev.setAngle(90);
    expect(overlay()).toBe('false');
    await flow.holdNeutral(1100);
    expect(flow.screen()).toBe('countdown');
  });

  it('a phone not held upright (lying flat) does not start the countdown', async () => {
    flow = createFlow();
    await flow.startGame(0);
    flow.tilt(-80);
    await flow.advance(3000);
    expect(flow.screen()).toBe('ready');
  });
});
