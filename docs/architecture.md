# Architecture

Vite + Three.js + GSAP, no framework. One fixed full-screen `<canvas>` sits behind
normal HTML; scrolling the page drives the camera and scene state.

## Scroll → scene

- Each chapter is a tall `<section class="stage" data-stage="…">` in `index.html`.
  Its card is `position: sticky`, so it stays on screen while the section scrolls.
- `src/main.js` measures every section's *anchor* (the scroll offset where its center
  is mid-screen) and builds a list of keyframes from `STAGES`.
- Each frame, `sample(scrollY)` finds the two surrounding keyframes and blends:
  - **camera**: target is lerped; the offset is interpolated in spherical
    coordinates (log radius) so the camera orbits around the brain instead of
    cutting through it.
  - **state**: a flat vector of numbers (region highlights `h0..h2`, layer opacities
    `ov_*`, `chip`, `sig`, `link`, `loop`, `brain`, `drag`, `hover`).
- Everything is then damped toward the sampled values, so fast scrolling stays smooth.
- `setViewOffset` shifts the subject left/right (`sx`) or up (`sy`) to leave room for cards.

## Scene modules (`src/scene/`)

| File | Role |
| --- | --- |
| `anatomy.js` | Procedural brain + scalp geometry. `hemiPoint()` maps a direction to the cortex surface; `hemiFrame()` / `cortexPatch()` give positions + normals so devices sit on the cortex. Region tests (motor / visual / language). |
| `brain.js` | ~125k-particle brain (60k on mobile): cortex with ridged-noise sulci, cerebellum, brainstem. Custom point shader handles region highlight, firing sparkles, and the stimulation ripple. |
| `overlays.js` | One `Layer` per modality: EEG cap, MEG helmet, HD-DOT optodes + photon paths, sEMG pads, ECoG grid, µECoG, sEEG leads, Utah-style array + flexible threads, visual-prosthesis tiles. |
| `pathway.js` | 16 parallel electrode → chip streams (flowing tubes), signal pulses up, stimulation pulses down. |
| `chip.js` | The die: 1,024 instanced channel tiles, functional blocks (hoverable via invisible pick boxes), bond pads, routing. |
| `link.js` | Implant + wearable coils, field loops, data/command packets. |
| `materials.js` | Shared shaders: `glowPoints`, `flowLines`, `flowTubes`; the `Layer` class that fades all its materials together. |

A `Layer` only re-parents objects that have no parent yet, so pieces nested inside a
transformed sub-group (the die, the coils) keep their transforms.

## Render pipeline

`RenderPass → clamp pass → UnrealBloomPass → OutputPass` on desktop; plain render on
mobile. The clamp pass caps HDR values at 1 so thousands of additive particles don't
make bloom smear a grey haze over the page. The clear color is pre-linearized twice in
the composer path (see [development.md](development.md#gotchas)).

## Themes

`src/theme.js` reads `<html data-theme>` (set by an inline script in `index.html`
from `?theme=` or localStorage). In the watercolor theme:

- every material factory routes colors through `tint()` (neon → pigment) and uses
  normal instead of additive blending; point shaders switch to a "pigment dab" shape;
- `src/scene/watercolor.js` replaces bloom with a watercolor post-process;
- `src/watercolor.css` overrides tokens and type (Newsreader on paper).

## UI modules (`src/ui/`)

| File | Role |
| --- | --- |
| `signals.js` | Synthetic signal generators per modality + a canvas oscilloscope (`Scope`). |
| `modalities.js` | Sensing chapter: toggles, one stream window per modality, resolution chart. |
| `decode.js` | Closed-loop HUD: features heatmap, decoder bars, cursor task, typed text; fires `onSelect` → stimulation. |
| `labels.js` | HTML labels pinned to 3D points, fading with their layer. |
| `resolution.js` | Sensing "powers of ten" zoom + temporal dot plot. |
| `../game/spikesorter.js` | Spike Sorter game (Play section). |
