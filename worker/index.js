// Serves the built site from static assets, sends www → apex, and adds the security headers.
const APEX = 'shashankbansal.io';

// Everything is first-party except the optional Cloudflare Web Analytics beacon.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'", // the pages set style attributes from script; no external stylesheets
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // always HTTPS, and www goes to the bare domain, in a single hop. Cloudflare reports the visitor's own scheme in
    // CF-Visitor; without that header (local dev) nothing is rewritten, so this can never loop.
    const insecure = /"scheme"\s*:\s*"http"/.test(request.headers.get('CF-Visitor') || '');
    if (insecure || url.hostname === `www.${APEX}`) {
      url.protocol = 'https:';
      if (url.hostname === `www.${APEX}`) url.hostname = APEX;
      return Response.redirect(url.toString(), 301);
    }
    // a static site: nothing accepts a body
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD', ...SECURITY } });
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(SECURITY)) out.headers.set(k, v);
    if (res.ok) {
      // hashed build output never changes under the same name; photos, clips and logos rarely do (a week, refreshed quietly after);
      // pages stay revalidated on every visit so a new deploy is picked up at once
      if (url.pathname.startsWith('/assets/')) out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      else if (/^\/(photos|awards|logos)\/|^\/shashank\.jpg$/.test(url.pathname)) out.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    }
    return out;
  },
};
