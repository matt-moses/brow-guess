/**
 * App controller: owns the game session (deck, round, tilt detector,
 * subscriptions) and wires the device adapters to the screens (PRD §5).
 *
 *   home ─tap─► (denied → permission) ─► ready ─hold─► countdown ─► round ─► results
 *                                          └─ no sensor → unsupported
 *   countdown/round ─hidden─► paused ─tap─► countdown (recalibrate) ─► round (resumed)
 */
import { APP_NAME } from './config.ts';
import type { Deck } from './decks/index.ts';
import { resolveDeps, type AppDeps, type AppDepsInput } from './deps.ts';
import { HAPTIC } from './device/haptics.ts';
import { createRound, type Round } from './game/round.ts';
import { createTiltDetector, type TiltDetector } from './game/tilt.ts';
import { createRouter } from './router.ts';
import { countdownScreen } from './screens/countdown.ts';
import { homeScreen } from './screens/home.ts';
import { pausedScreen } from './screens/paused.ts';
import { permissionScreen } from './screens/permission.ts';
import { readyScreen } from './screens/ready.ts';
import { resultsScreen } from './screens/results.ts';
import { roundScreen } from './screens/round.ts';
import { unsupportedScreen } from './screens/unsupported.ts';
import type { FitMeasure } from './ui/autofit.ts';

export const LAST_DECK_KEY = 'lastDeckId';

export interface AppOptions extends AppDepsInput {
  /** Autofit measurement override (tests; jsdom has no layout). */
  measure?: FitMeasure;
}

export interface AppState {
  screen: string | null;
  deckId: string | null;
  /** Remaining round time, or null when no round exists. */
  remainingMs: number | null;
}

export interface App {
  /** Read-only snapshot for tests and debugging. */
  state(): AppState;
  /** Tear everything down (screens, session, device holds). */
  destroy(): void;
}

interface Session {
  deck: Deck;
  detector: TiltDetector;
  round: Round | null;
  offVisibility: () => void;
}

export function createApp(root: HTMLElement, options: AppOptions = {}): App {
  const deps: AppDeps = resolveDeps(options);
  const { device } = deps;
  const router = createRouter<AppDeps>(root, deps);
  let session: Session | null = null;

  document.title = APP_NAME;

  // --- storage ----------------------------------------------------------------
  function lastDeckId(): string | null {
    try {
      return deps.storage?.getItem(LAST_DECK_KEY) ?? null;
    } catch {
      return null;
    }
  }
  function rememberDeck(id: string): void {
    try {
      deps.storage?.setItem(LAST_DECK_KEY, id);
    } catch {
      // private mode / quota: ignore
    }
  }

  // --- device holds -------------------------------------------------------------
  function releaseDevice(): void {
    void device.wakeLock.release();
    device.wakeLock.dispose(); // also drops its visibilitychange listener
    void device.exitFullscreen();
    void device.unlockOrientation();
  }

  function endSession(): void {
    session?.offVisibility();
    session = null;
  }

  // --- navigation ---------------------------------------------------------------
  function showHome(): void {
    endSession();
    router.show(homeScreen, { decks: deps.decks, lastDeckId: lastDeckId(), onPick: startGame });
  }

  /**
   * Deck tap (and Play again / Try again). Runs inside the user gesture, so
   * requestMotionPermission() MUST be the first call, and every
   * activation-gated API is kicked off before the first await.
   */
  function startGame(deck: Deck): void {
    const permission = device.requestMotionPermission();
    device.unlockAudio();
    const fullscreen = device.enterFullscreen();
    void device.lockLandscape();
    // Chrome only allows the lock once fullscreen is active, so retry then.
    void fullscreen.then(() => device.lockLandscape());
    void device.wakeLock.acquire();

    rememberDeck(deck.id);
    endSession();
    const s: Session = {
      deck,
      detector: createTiltDetector(),
      round: null,
      offVisibility: () => {},
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') pause(s);
    };
    document.addEventListener('visibilitychange', onVisibility);
    s.offVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
    session = s;

    void permission.then((result) => {
      if (session !== s) return;
      if (result === 'denied') {
        releaseDevice();
        endSession();
        router.show(permissionScreen, {
          onRetry: () => startGame(deck),
          onBack: showHome,
        });
      } else {
        showReady(s);
      }
    });
  }

  function quitNow(): void {
    releaseDevice();
    showHome();
  }

  function showReady(s: Session): void {
    router.show(readyScreen, {
      onReady: () => {
        if (session === s) showCountdown(s);
      },
      onNoSensor: () => {
        if (session !== s) return;
        releaseDevice();
        endSession();
        router.show(unsupportedScreen, { onBack: showHome });
      },
      onQuit: quitNow,
    });
  }

  function showCountdown(s: Session): void {
    router.show(countdownScreen, {
      onDone: (neutral) => {
        if (session !== s) return;
        s.detector.reset(); // reset() clears calibration, so calibrate after it
        s.detector.calibrate(neutral);
        if (s.round) {
          s.round.resume();
        } else {
          s.round = createRound({
            words: s.deck.words,
            now: deps.now,
            rng: deps.rng,
            roundMs: deps.roundMs,
          });
          s.round.start();
        }
        showRound(s);
      },
    });
  }

  function showRound(s: Session): void {
    const round = s.round;
    if (!round) return;
    router.show(roundScreen, {
      round,
      detector: s.detector,
      measure: options.measure,
      onOver: () => {
        if (session === s) finishRound(s, round);
      },
      onQuit: () => void confirmQuit(s),
    });
  }

  function pause(s: Session): void {
    if (session !== s) return;
    const screen = router.current();
    if (screen !== 'countdown' && screen !== 'round') return;
    s.round?.pause();
    router.show(pausedScreen, {
      onResume: () => {
        if (session !== s) return;
        // A tap is a fresh gesture: re-unlock audio and re-enter fullscreen.
        device.unlockAudio();
        void device.enterFullscreen();
        void device.wakeLock.acquire();
        showCountdown(s);
      },
      onQuit: () => void confirmQuit(s),
    });
  }

  async function confirmQuit(s: Session): Promise<void> {
    const round = s.round;
    const wasRunning = router.current() === 'round' && round !== null && !round.isPaused();
    if (wasRunning) round.pause();
    const ok = await deps.confirm('Quit this round? Your score will be lost.', {
      confirmLabel: 'Quit',
      cancelLabel: 'Keep playing',
    });
    if (session !== s) return;
    if (ok) quitNow();
    else if (wasRunning && router.current() === 'round') round.resume();
  }

  function finishRound(s: Session, round: Round): void {
    device.playSound('buzzer');
    device.pulse(HAPTIC.buzzer);
    releaseDevice();
    endSession();
    router.show(resultsScreen, {
      deckTitle: s.deck.title,
      results: round.results(),
      onPlayAgain: () => startGame(s.deck),
      onChooseDeck: showHome,
    });
  }

  showHome();

  return {
    state: () => ({
      screen: router.current(),
      deckId: session?.deck.id ?? null,
      remainingMs: session?.round ? session.round.remainingMs() : null,
    }),
    destroy() {
      if (session) releaseDevice();
      endSession();
      router.destroy();
    },
  };
}
