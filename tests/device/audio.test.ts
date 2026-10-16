// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _resetAudioForTests,
  playSound,
  SOUNDS,
  unlockAudio,
  type SoundName,
} from '../../src/device/audio';
import { installFakeDevice, type FakeDevice } from '../helpers/fakeDevice';

let dev: FakeDevice | undefined;
beforeEach(() => {
  _resetAudioForTests();
});
afterEach(() => {
  dev?.uninstall();
  dev = undefined;
});

const ALL: SoundName[] = ['tick', 'countdown', 'correct', 'pass', 'buzzer'];

describe('audio', () => {
  it('play before unlock is a no-op', () => {
    dev = installFakeDevice();
    playSound('correct');
    expect(dev.audioContext.instances).toHaveLength(0);
    expect(dev.audioContext.oscillators).toHaveLength(0);
  });

  it('unlock creates a context and resumes it when suspended', async () => {
    dev = installFakeDevice();
    unlockAudio();
    expect(dev.audioContext.instances).toHaveLength(1);
    expect(dev.audioContext.resumeCalls).toBe(1);
    await Promise.resolve();
    // Second unlock reuses the running context.
    unlockAudio();
    expect(dev.audioContext.instances).toHaveLength(1);
    expect(dev.audioContext.resumeCalls).toBe(1);
    // Re-suspended (e.g. iOS interruption) -> resume again.
    dev.audioContext.current!.state = 'suspended';
    unlockAudio();
    expect(dev.audioContext.resumeCalls).toBe(2);
  });

  it('recreates a closed context', () => {
    dev = installFakeDevice({ audioState: 'running' });
    unlockAudio();
    dev.audioContext.current!.state = 'closed';
    playSound('tick');
    expect(dev.audioContext.oscillators).toHaveLength(0);
    unlockAudio();
    expect(dev.audioContext.instances).toHaveLength(2);
  });

  it.each(ALL)('after unlock, %s creates oscillators routed through gain envelopes', (name) => {
    dev = installFakeDevice({ audioState: 'running' });
    unlockAudio();
    playSound(name);
    const n = SOUNDS[name].length;
    const { oscillators, gains, current } = dev.audioContext;
    expect(oscillators).toHaveLength(n);
    expect(gains).toHaveLength(n);
    oscillators.forEach((o, i) => {
      expect(o.connect).toHaveBeenCalledWith(gains[i]);
      expect(gains[i]!.connect).toHaveBeenCalledWith(current!.destination);
      expect(o.start).toHaveBeenCalled();
      expect(o.stop).toHaveBeenCalled();
      expect(gains[i]!.gain.linearRampToValueAtTime).toHaveBeenCalled();
      expect(gains[i]!.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });
  });

  it('correct is a rising two-note chime; pass glides down; buzzer is ~0.6s', () => {
    const correct = SOUNDS.correct;
    expect(correct).toHaveLength(2);
    expect(correct[1]!.freq).toBeGreaterThan(correct[0]!.freq);
    const pass = SOUNDS.pass[0]!;
    expect(pass.endFreq).toBeLessThan(pass.freq);
    expect(SOUNDS.buzzer[0]!.dur).toBeCloseTo(0.6, 2);
  });

  it('pass schedules a frequency glide', () => {
    dev = installFakeDevice({ audioState: 'running' });
    unlockAudio();
    playSound('pass');
    expect(
      dev.audioContext.oscillators[0]!.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalled();
  });

  it('falls back to webkitAudioContext', () => {
    dev = installFakeDevice({ audio: 'webkit' });
    unlockAudio();
    playSound('tick');
    expect(dev.audioContext.instances).toHaveLength(1);
    expect(dev.audioContext.oscillators).toHaveLength(1);
  });

  it('is fine when AudioContext is missing', () => {
    dev = installFakeDevice({ audio: 'absent' });
    expect(() => unlockAudio()).not.toThrow();
    expect(() => playSound('buzzer')).not.toThrow();
    expect(dev.audioContext.instances).toHaveLength(0);
  });

  it('swallows errors from the audio graph', () => {
    dev = installFakeDevice({ audioState: 'running' });
    unlockAudio();
    dev.audioContext.current!.createOscillator.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => playSound('correct')).not.toThrow();
  });
});
