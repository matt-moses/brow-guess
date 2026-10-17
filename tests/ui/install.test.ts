// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initInstall, installControl, resetInstall } from '../../src/ui/install';

const realUa = navigator.userAgent;

function setUa(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
}

/** A stand-in for Chromium's BeforeInstallPromptEvent. */
function fireInstallable(): ReturnType<typeof vi.fn> {
  const prompt = vi.fn(() => Promise.resolve());
  const e = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  window.dispatchEvent(e);
  return prompt;
}

function mount(): HTMLElement {
  const c = installControl();
  document.body.append(c);
  return c;
}

const installBtn = (c: HTMLElement): HTMLButtonElement => c.querySelector('button')!;
const hint = (c: HTMLElement): HTMLElement => c.querySelector('.install-hint')!;

describe('install control', () => {
  let ac: AbortController;

  beforeEach(() => {
    document.body.innerHTML = '';
    resetInstall();
    setUa(realUa);
    // initInstall adds window listeners; route them through a signal we can drop.
    ac = new AbortController();
    const add = window.addEventListener.bind(window);
    initInstall({
      addEventListener: (type: string, fn: EventListener) => add(type, fn, { signal: ac.signal }),
    } as unknown as Window);
  });
  afterEach(() => {
    ac.abort();
    setUa(realUa);
  });

  it('stays hidden until the browser says the app is installable', () => {
    const c = mount();
    expect(c.hidden).toBe(true);
    fireInstallable();
    expect(c.hidden).toBe(false);
    expect(installBtn(c).hidden).toBe(false);
    expect(installBtn(c).textContent).toBe('Install app');
  });

  it('shows the button on a footer rendered after the event fired', () => {
    fireInstallable();
    expect(installBtn(mount()).hidden).toBe(false);
  });

  it('replays the saved prompt once, then hides', () => {
    const prompt = fireInstallable();
    const c = mount();
    installBtn(c).click();
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(c.hidden).toBe(true);
  });

  it('hides for good once the app is installed', () => {
    fireInstallable();
    const c = mount();
    window.dispatchEvent(new Event('appinstalled'));
    expect(c.hidden).toBe(true);
    fireInstallable();
    expect(c.hidden).toBe(true);
  });

  it('shows Add to Home Screen steps on iOS, which has no install event', () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
    const c = mount();
    expect(c.hidden).toBe(false);
    expect(installBtn(c).hidden).toBe(true);
    expect(hint(c).hidden).toBe(false);
    expect(hint(c).textContent).toContain('Add to Home Screen');
  });
});
