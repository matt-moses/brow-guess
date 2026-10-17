// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadAnalytics } from '../src/analytics';
import { CF_BEACON_URL } from '../src/config';

const beacons = () => document.head.querySelectorAll(`script[src="${CF_BEACON_URL}"]`);

describe('loadAnalytics', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('adds the beacon with the token on the live host', () => {
    loadAnalytics(document, 'matt-moses.github.io', 'abc123');
    const [script] = beacons();
    expect(script).toBeDefined();
    expect((script as HTMLScriptElement).defer).toBe(true);
    expect(JSON.parse((script as HTMLScriptElement).dataset.cfBeacon!)).toEqual({
      token: 'abc123',
    });
  });

  it('does nothing on any other host', () => {
    loadAnalytics(document, '127.0.0.1', 'abc123');
    loadAnalytics(document, 'localhost', 'abc123');
    expect(beacons()).toHaveLength(0);
  });

  it('does nothing without a token', () => {
    loadAnalytics(document, 'matt-moses.github.io', '');
    expect(beacons()).toHaveLength(0);
  });
});
