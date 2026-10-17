import './style.css';
import { loadAnalytics } from './analytics.ts';
import { createApp } from './app.ts';
import { registerPwa } from './pwa.ts';
import { initInstall } from './ui/install.ts';

const root = document.querySelector<HTMLElement>('#app');
initInstall();

if (root) {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('sim')) {
    // Dev-only desktop sensor simulator; the whole branch is dropped from prod builds.
    void import('./dev/sim.ts').then((m) => m.installSim());
  }
  createApp(root);
}

if (import.meta.env.PROD) {
  void registerPwa();
  loadAnalytics();
}
