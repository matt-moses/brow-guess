// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { HAPTIC, pulse } from '../../src/device/haptics';
import { installFakeDevice, type FakeDevice } from '../helpers/fakeDevice';

let dev: FakeDevice | undefined;
afterEach(() => {
  dev?.uninstall();
  dev = undefined;
});

describe('haptics', () => {
  it('calls vibrate when present', () => {
    dev = installFakeDevice();
    pulse(HAPTIC.correct);
    pulse(HAPTIC.pass);
    expect(dev.vibrate).toHaveBeenNthCalledWith(1, 60);
    expect(dev.vibrate).toHaveBeenNthCalledWith(2, [30, 40, 30]);
  });

  it('does not throw when vibrate is absent', () => {
    dev = installFakeDevice({ vibrate: 'absent' });
    expect(() => pulse(HAPTIC.buzzer)).not.toThrow();
  });

  it('swallows errors from vibrate', () => {
    dev = installFakeDevice({ vibrate: 'reject' });
    expect(() => pulse(HAPTIC.tick)).not.toThrow();
    expect(dev.vibrate).toHaveBeenCalledWith(20);
  });
});
