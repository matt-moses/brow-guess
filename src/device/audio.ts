/**
 * Web Audio sound effects (FR-14). All sounds are synthesized with oscillators
 * and gain envelopes, so there are no audio assets to license.
 *
 * Call unlockAudio() synchronously inside the deck-tap gesture: it creates (or
 * resumes) the AudioContext, which autoplay policies only allow there.
 * playSound() is a no-op until then, and everything is a no-op when Web Audio
 * is unsupported. Nothing here throws.
 */

export type SoundName = 'tick' | 'countdown' | 'correct' | 'pass' | 'buzzer';

interface Tone {
  /** Start frequency (Hz). */
  freq: number;
  /** Optional end frequency for a glide (Hz). */
  endFreq?: number;
  /** Offset from "now" (s). */
  at: number;
  /** Duration including decay (s). */
  dur: number;
  type: OscillatorType;
  /** Peak gain (0..1). */
  peak: number;
}

const ATTACK_S = 0.005;
const SILENT = 0.0001;

/** Sound recipes. Exported for tests and tuning. */
export const SOUNDS: Readonly<Record<SoundName, readonly Tone[]>> = {
  tick: [{ freq: 1800, at: 0, dur: 0.03, type: 'square', peak: 0.12 }],
  countdown: [{ freq: 660, at: 0, dur: 0.15, type: 'sine', peak: 0.35 }],
  correct: [
    { freq: 880, at: 0, dur: 0.12, type: 'triangle', peak: 0.35 },
    { freq: 1318.5, at: 0.1, dur: 0.22, type: 'triangle', peak: 0.35 },
  ],
  pass: [{ freq: 330, endFreq: 165, at: 0, dur: 0.28, type: 'sine', peak: 0.35 }],
  buzzer: [
    { freq: 110, at: 0, dur: 0.6, type: 'square', peak: 0.2 },
    { freq: 116, at: 0, dur: 0.6, type: 'sawtooth', peak: 0.15 },
  ],
};

type AudioCtor = new () => AudioContext;

let ctx: AudioContext | null = null;

function getCtor(): AudioCtor | undefined {
  try {
    const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return g.AudioContext ?? g.webkitAudioContext;
  } catch {
    return undefined;
  }
}

/** Create the AudioContext on first call, or resume it if suspended. Sync; call in the gesture. */
export function unlockAudio(): void {
  try {
    if (!ctx || ctx.state === 'closed') {
      const Ctor = getCtor();
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') {
      void Promise.resolve(ctx.resume()).catch(() => {});
    }
  } catch {
    // ignore
  }
}

function scheduleTone(audio: AudioContext, tone: Tone, now: number): void {
  const start = now + tone.at;
  const end = start + tone.dur;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.freq, start);
  if (tone.endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(tone.endFreq, end);
  gain.gain.setValueAtTime(SILENT, start);
  gain.gain.linearRampToValueAtTime(tone.peak, start + ATTACK_S);
  gain.gain.exponentialRampToValueAtTime(SILENT, end);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Play a named sound effect. No-op before unlockAudio() or when unsupported. */
export function playSound(name: SoundName): void {
  const audio = ctx;
  if (!audio || audio.state === 'closed') return;
  try {
    const now = audio.currentTime;
    for (const tone of SOUNDS[name]) scheduleTone(audio, tone, now);
  } catch {
    // ignore
  }
}

/** Test hook: forget the cached AudioContext so each test starts locked. */
export function _resetAudioForTests(): void {
  ctx = null;
}
