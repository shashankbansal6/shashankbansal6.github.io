# Changelog

Every visual version of the site is tagged in git (`git tag -l 'v*'`) and has a
screenshot set in [`docs/versions/`](docs/versions/). To look at an old version:

```bash
git checkout v2-editorial   # detached checkout of that version
npm install && npm run dev
git checkout redesign       # back to the latest
```

## v2-editorial — 2026-10-11

- Editorial dark palette: warm ink `#0d0d0c`, bone text `#ece8e0`, one accent `#ff5b2e`.
- Instrument Serif display face + Inter body; no gradient text, glows or glass panels.
- Sensing chapter: one live waveform window per selected modality.
- Closed-loop chapter: 16 parallel electrode → chip streams (flowing tubes) with stimulation pulses back down each.
- Research pillars with paper / patent links; selected publications list; honors.
- Experience timeline with organization logos; Qernel.AI added; Threads replaces Twitter.
- Real chip specs from the CV (1,024 ch, 1 µW/ch, NEF 1.8); placeholder claims removed.
- Latest CV (June 2026).
- Cloudflare Worker + Custom Domain config for `shashankbansal.io` (not deployed yet).

Screenshots: [`docs/versions/v2`](docs/versions/v2).

## v1-neon — 2026-10-11 (not committed)

First Three.js revamp: neon cyan/magenta on near-black, Space Grotesk + JetBrains Mono,
glass cards, bloom. Same 8-chapter journey (brain → sensing → motor / visual / language →
signals → chip → link → decode). Source was iterated in place before version tracking
began, so only screenshots survive: [`docs/versions/v1`](docs/versions/v1).

## v0 — legacy

Jon Barron–template academic page, kept in [`legacy/`](legacy/).
