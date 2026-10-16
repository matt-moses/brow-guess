import './style.css';
import { createApp } from './app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('sim')) {
    // Dev-only desktop sensor simulator; the whole branch is dropped from prod builds.
    void import('./dev/sim.ts').then((m) => m.installSim());
  }
  createApp(root);
}
