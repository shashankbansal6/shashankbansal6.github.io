# shashankbansal6.github.io

Personal site: a scroll-driven Three.js journey from the whole brain → sensing
modalities → motor / visual / language cortex → live signals → recording chip →
inductive link → closed-loop decoding, followed by bio and experience.

Docs: see the [wiki in `docs/`](docs/README.md) and the [CHANGELOG](CHANGELOG.md).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```

Deep-link to any chapter with `?at=<chapter>`: `hero`, `landscape`, `motor`,
`visual`, `language`, `signals`, `chip`, `link`, `decode`.

## Where things live

| What | File |
| --- | --- |
| Chip specs, modalities, bio, experience | `src/config.js` |
| Camera path + per-chapter scene state | `src/main.js` (`STAGES`) |
| Procedural brain + regions | `src/scene/anatomy.js`, `src/scene/brain.js` |
| Sensor layers (EEG, MEG, HD-DOT, ECoG, sEEG, arrays…) | `src/scene/overlays.js` |
| Chip die, cable, inductive link | `src/scene/chip.js`, `pathway.js`, `link.js` |
| HUD panels (scope, toggles, decoder) | `src/ui/*` |
| Copy for each chapter | `index.html` |

Chip specs in `src/config.js` come from the CV (1,024 ch, 1 µW/ch, NEF 1.8).

## Deploy (Cloudflare Workers → shashankbansal.io)

The built `dist/` is served by a Worker with static assets (`wrangler.jsonc`,
`worker/index.js`). Both `shashankbansal.io` and `www.shashankbansal.io` are
Custom Domains, so the first deploy creates the DNS records and TLS certificates
automatically; `www` 301-redirects to the apex.

```bash
npx wrangler login     # once, opens Cloudflare in the browser
npm run deploy:check   # build + dry run, uploads nothing
npm run deploy         # build + publish
```

`.github/workflows/deploy.yml` can also deploy from GitHub (manual trigger) once
the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are set.

The previous Jekyll-template site is kept in `legacy/` for reference.
