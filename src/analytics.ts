/**
 * Cloudflare Web Analytics: cookieless, anonymous page-view counts. Adds the
 * beacon script only on the live host, so dev, e2e and Lighthouse runs never
 * load it or skew the numbers. Offline launches simply aren't counted.
 */
import { CF_BEACON_TOKEN, CF_BEACON_URL, SHARE_URL } from './config.ts';

export function loadAnalytics(
  doc: Document = document,
  hostname: string = location.hostname,
  token: string = CF_BEACON_TOKEN,
): void {
  if (!token || hostname !== new URL(SHARE_URL).hostname) return;
  const script = doc.createElement('script');
  script.defer = true;
  script.src = CF_BEACON_URL;
  script.dataset.cfBeacon = JSON.stringify({ token });
  doc.head.append(script);
}
