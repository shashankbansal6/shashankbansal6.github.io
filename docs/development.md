# Development

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
```

## Deep links

`?at=<chapter>` jumps straight to a chapter and skips the intro:
`hero`, `landscape`, `motor`, `visual`, `language`, `signals`, `chip`, `link`, `decode`.
`?at=<number>` jumps to a raw scroll offset. `?bloom=0` disables bloom.

In dev builds, `window.__site` exposes the scene, camera, renderer and state for debugging.

## Screenshots

Headless Chrome via `puppeteer-core` (pointing at the installed Chrome) works well for
checking every chapter at a fixed size: load `/?at=<chapter>`, wait ~3 s for the
camera to settle, then screenshot. Save keepers to `docs/versions/<version>/`.

## Gotchas

- **Negative point sizes.** Points behind the camera get a negative `gl_PointSize`,
  which some GPUs draw as huge sprites (screen-wide grey haze). Every point shader
  bails out when `mv.z > -0.01`.
- **Bloom haze.** Additive particles exceed 1.0 in HDR; a clamp pass before bloom stops
  the widest blur from lifting the whole background.
- **Clear color in the composer.** The clear into the composer's render target gets
  sRGB-encoded and `OutputPass` encodes again, so the composer path uses
  `new Color(bg).convertSRGBToLinear()`.
- **Layer re-parenting.** `Layer.add()` must not re-parent objects already inside a
  transformed group, or the die/coils jump to the origin at 1:1 scale.
- **First-frame dt.** The timer can report a negative delta on the first frame;
  dt is clamped to `[0, 0.05]` or the damped state becomes NaN.
- **CSS uppercase + µ.** `text-transform: uppercase` turns "µW" into "ΜW". Don't
  uppercase labels that contain units.
