# TODO

## Photos page (lower priority)

A local photo timeline at `/photos/` replaces the Flickr link. The page itself is
built (`photos/index.html`, `photos.js`, `photos.css`: year rail, justified rows,
lightbox, both themes); it just has no photos yet (`photos/manifest.json` is empty),
so the site still links to Flickr.

- [ ] Pick the best non-people photos from the Photos library, **up to 2022 only**
      (before the PhD). Scanning the whole library through AppleScript is very slow
      (16,891 items; filtering favorites alone ran >10 min), so work from an album or
      a date range, or export a folder by hand.
- [ ] Resize each to `public/photos/img/<name>-1100.jpg` (grid) and `-2000.jpg`
      (lightbox), `sips -Z 1100` / `sips -Z 2000` work.
- [ ] Add chapters (title, place, date, optional note) and photos
      (`{ f, w, h, t, d }`) to `photos/manifest.json`.
- [ ] Point `PROFILE.links` Photos and the About text at `/photos/`.

## Awards

- [ ] Save the two certificate photos as `public/awards/iscas-2026.jpg` and
      `public/awards/ieee-brain-2023.jpg`. They already show up in the Honors row
      (and enlarge on click) as soon as the files exist.
