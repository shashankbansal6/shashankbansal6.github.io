# Editing content

Almost everything a visitor reads about you is in **`src/config.js`**.

| To change… | Edit |
| --- | --- |
| Chip specs (channels, µW/ch, NEF, test setup) | `CHIP` |
| Hover text on the die blocks | `CHIP_BLOCKS` |
| Modalities, their resolutions and descriptions | `MODALITIES` |
| Social links (CV, GitHub, LinkedIn, Threads…) | `PROFILE.links` |
| Honors row under About | `HONORS` |
| "What I work on" pillars + their paper/patent links | `RESEARCH` |
| Selected publications list | `PUBLICATIONS` (authors accept `<b>` for your name) |
| Experience timeline | `EXPERIENCE` (`logo` points into `public/logos/`) |

Chapter copy (the cards in the 3D journey) and the About text live in **`index.html`**.

## Files in `public/`

- `ShashankBansal-CV.pdf` — replace with a newer CV (keep the filename).
- `ShashankB-circle.png` — portrait.
- `logos/*.png` — square organization logos, shown at 40 px. Keep them the same
  style: square, mark centered with padding, white background.
- `404.html` — not-found page.

## Adding a paper

1. Add it to `PUBLICATIONS` with a DOI link (`doi('10.xxxx/…')`).
2. If it belongs to a research area, add a `{ kind: 'Paper', label, href }` entry to
   that pillar's `refs` in `RESEARCH`.
