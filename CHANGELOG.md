# Changelog

Every visual version of the site is tagged in git (`git tag -l 'v*'`) and has a
screenshot set in [`docs/versions/`](docs/versions/). To look at an old version:

```bash
git checkout v2-editorial   # detached checkout of that version
npm install && npm run dev
git checkout redesign       # back to the latest
```

## v3.5 — 2026-10-11

- **Photos page is live in the site**: Flickr links removed; the nav, About text and link rows point to
  `/photos/`. First photo: the CIM chip, a 1 mm² bare die. `node scripts/add-photos.mjs <folder>`
  turns a folder of "YYYY-MM Title @ Place" sub-folders into timeline chapters.
- Sensing resolution figure: more space between modality legend entries.
- Content pages (About, Research, Publications, Experience, Contact, Play) are ~0.88× smaller.

## v3.4 — 2026-10-11

- **Sensing page**: both side panels are narrower and always fit the window. The live-signals panel
  no longer scrolls: every modality you add makes the other signal windows shorter (and hides the
  descriptions past 3), and the resolution figure scales down to fit the left panel.
- **Content pages fit one screen**: About, Research, Publications + Patents, Experience, Be the
  decoder and Contact are each one window tall (Publications and Experience are two-column; the
  page content is zoomed down just enough to fit short windows; mobile scrolls normally).
- **"1,024 channels"** in the research section counts up from 0 when scrolled into view.
- **Smoother theme switch**: uses the View Transitions API to crossfade the whole page
  (text and 3D together) while the theme swap and shader recompiles happen out of sight;
  browsers without it use the previous freeze-frame fade.
- Award certificate thumbnails sit beside each honor (once `public/awards/*.jpg` exist).

## v3.3 — 2026-10-11

- **Type scale back to 1.2× the original** (root 16 px → 19.2 px max, was up to 26 px), with
  the small labels that were genuinely too small (sensing page captions, chip labels,
  kickers) bumped individually.
- **Live theme switch**: Watercolor ⇄ Ink no longer reloads. The frame is frozen, the page
  dips, the theme (materials, shaders, post-processing, game, signals, zoom) is swapped in
  place, and the new look fades in over the same scroll position and camera angle.
  The other theme's fonts are preloaded at idle so the first switch doesn't wait.

## v3.2 — 2026-10-11

- **Watercolor is now the default**; Ink is one click away in a Watercolor | Ink switch in
  the middle of the top bar (the choice is remembered, `?theme=` still works).
- Bigger type everywhere: all sizes are rem-based and the root grows with the window
  (16 px up to ~1000 px wide, ~19 px at 1440, ~22 px at 1920, 26 px max); chapter cards,
  small labels and the top bar are noticeably larger. Hindi name under the title is ~2.5×
  bigger, with a Devanagari web font.
- Experience, publications, "What I work on", About and honors are 1.5–3× larger.
- Publications and Patents are separate sub-lists.
- Awards: the IEEE ISCAS 2026 certificate (it reads **Student Paper Award**, so the text now
  says that rather than "Best Paper") and the IEEE Brain 2023 Best Poster certificate show in
  the Honors row and enlarge on click. Drop the files at `public/awards/iscas-2026.jpg` and
  `public/awards/ieee-brain-2023.jpg` (the row hides an image that is missing).
- Watercolor scene is easier to read: more saturated, mutually distinct pigments for
  electrodes and hardware, a paler brain, less blur and bleed in the paper pass.
- About portrait is a color photo (new picture) in both themes.
- Every link turns fully orange on hover (text and underline).
- Spike game: runs at **1,000× slower than real time** (1 s of play = 1 ms of recording),
  with a real-recording-time axis under the trace and a note saying so. The sort window is
  wider and the speed no longer ramps, so sorts land instead of missing. **← → ↑** sort as
  unit 1 / 2 / 3 (1 2 3 still work; arrows don't scroll the page during play).
- A `/photos/` timeline page (year rail, justified rows, lightbox, both themes) is built but
  not linked yet; see `TODO.md`.

Screenshots: not regenerated for this version.

## v3.1 — 2026-10-11

- Bigger hero brain on wide screens (camera distance scales with aspect ratio).
- Closing the loop is now a real task: in chapter 08 a person with paralysis moves a
  cursor across a communication board (Water, Food, Nurse, Lights, Music) and
  selects what they need; each selection triggers the stimulation pulse.
- The game became chapter 09, **Be the decoder**: three neurons tuned to left / right /
  select, labelled by type (fast-spiking interneuron, pyramidal neuron, axonal spike;
  all extracellular). Your labels drive the person's cursor; mislabels move it the wrong
  way. The simulated user plans ahead for spikes already in flight and queues requests.
- Game robustness: one animation loop, pauses off-screen with no time jump, re-measures
  on visibility/resize, pointerdown input, no double-firing keys. Verified with a bot
  over two back-to-back 60 s rounds: steady 60 fps, zero long frames, zero errors.
- Resolution zoom shows live activity: a traveling wave across the 10 cm view, columns
  lighting up at 1 cm, and at 1 mm individual neurons firing with spikes propagating
  along axons (refractory periods, probabilistic transmission).
- "Up to 1,024 channels" wording on the chip chapter and research pillar.
- Larger text throughout (zoom labels ~13 px, UI labels ≥ 13 px).

Screenshots: [`docs/versions/v3.1`](docs/versions/v3.1).

## v3-watercolor — 2026-10-11

A second theme of the same site, switchable from the nav ("Watercolor" / "Ink") or
with `?theme=watercolor`; the choice is remembered.

- Pigment-on-paper rendering: normal blending, neon → pigment palette (cerulean,
  viridian, alizarin, sienna), soft underpainting washes across the cortex.
- Full-screen watercolor pass: bleeding (noise-displaced lookups), wet-in-wet blur,
  wet-edge pooling, granulation, fibrous paper.
- Newsreader book serif on warm paper with ink text; Inter for small labels.
- Hardware layers render above the brain and get stronger opacity on paper.

Screenshots: [`docs/versions/v3`](docs/versions/v3).

## v2.2 — 2026-10-11

- **Spike Sorter** game in a new Play section: sort spikes from three neurons by
  shape (keys 1/2/3 or tap), ignore artifacts, watch clusters form in feature space.

Screenshots: [`docs/versions/v2.2`](docs/versions/v2.2).

## v2.1 — 2026-10-11

- Headings and body back to Space Grotesk (Inter for small labels).
- Sensing: "powers of ten" resolution zoom (10 cm → 1 cm → 1 mm) with true-scale
  blocks, neurons per sample, and a temporal dot plot; live signals moved to a
  separate right-hand panel.
- Logos normalized to one tile style; both UIUC roles use the Illinois mark.

Screenshots: [`docs/versions/v2.1`](docs/versions/v2.1).

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
