/**
 * Service-worker registration (FR-17/19). Uses the `prompt` flow: a new worker
 * waits until the player taps Reload in the update toast. Called only in
 * production builds (see main.ts), so dev never runs a stale worker.
 */
import { showOfflineReadyToast, showUpdateToast } from './ui/toast.ts';

export async function registerPwa(): Promise<void> {
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateToast(updateSW);
    },
    onOfflineReady() {
      showOfflineReadyToast();
    },
  });
}
