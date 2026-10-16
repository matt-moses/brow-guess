import './style.css';
import { APP_NAME } from './config.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  const heading = document.createElement('h1');
  heading.textContent = APP_NAME;
  app.replaceChildren(heading);
}
