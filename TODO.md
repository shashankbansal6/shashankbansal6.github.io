# TODO

## Photos page

Live at `/photos/` (nav + About + link rows). It has one photo so far (the CIM die).

- [ ] Add more: export the best non-people photos (pre-2022 for the PhD-start cutoff) from the
      Photos app into folders named `YYYY-MM Title @ Place`, then
      `node scripts/add-photos.mjs <folder>` (resizes with sips and updates
      `photos/manifest.json`). Add captions to the `t` fields by hand if you like.

## Awards

- [ ] Save the two certificate photos as `public/awards/iscas-2026.jpg` and
      `public/awards/ieee-brain-2023.jpg`. They already show up in the Honors row
      (and enlarge on click) as soon as the files exist.

## Old GitHub Pages address

- [ ] Publish `redirect/` as shashankbansal6.github.io (see README).

## Teaching

- [ ] Add a Teaching section: courses TA'd, guest lectures and outreach (the high-school
      talk in Posters & talks is a start). Likely its own block on the home page plus an
      entry in the Explore menu (`src/menu.js`).

## Papers still without a hosted PDF

- [ ] Add the accepted manuscript (not IEEE's formatted version) of the BioCAS 2023 HiAER
      paper to `public/papers/` and set `pdf:` on its entry in `src/config.js`.
