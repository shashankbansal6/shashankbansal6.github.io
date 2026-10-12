// Visit counts come from Cloudflare Web Analytics only: no cookies, no cross-site tracking, no personal profile,
// so there is nothing to ask the visitor about. The site works exactly the same with it off.
// To turn it on: Cloudflare dashboard → Analytics & Logs → Web Analytics → add shashankbansal.io, then paste the
// token below (or just use the dashboard's one-click "Enable" for a proxied site, which needs no code at all).
const CF_BEACON_TOKEN = '';

export function initAnalytics() {
  if (!CF_BEACON_TOKEN || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token: CF_BEACON_TOKEN });
  document.head.appendChild(s);
}
