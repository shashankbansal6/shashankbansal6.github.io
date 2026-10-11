// Add photos to the /photos/ timeline from a folder of folders:
//
//   node scripts/add-photos.mjs ~/Desktop/site-photos
//
// Each sub-folder becomes one chapter. Name it  "YYYY-MM Title"  or
// "YYYY-MM Title @ Place"  (e.g. "2019-08 Yosemite @ California"). Every
// jpg/png/heic inside is resized to 1100 px (grid) and 2000 px (lightbox) wide
// into public/photos/img/ and appended to photos/manifest.json. Re-running a
// folder replaces that chapter. macOS only (uses sips).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, copyFileSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';

const src = resolve(process.argv[2] || '');
if (!process.argv[2] || !statSync(src, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('usage: node scripts/add-photos.mjs <folder-of-chapter-folders>');
  process.exit(1);
}
const root = resolve(import.meta.dirname, '..');
const out = join(root, 'public/photos/img');
const manifestPath = join(root, 'photos/manifest.json');
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const sips = (...a) => execFileSync('sips', a, { encoding: 'utf8' });
const prop = (file, key) => sips('-g', key, file).split(`${key}:`)[1]?.trim();
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const dir of readdirSync(src).sort()) {
  const full = join(src, dir);
  if (!statSync(full).isDirectory()) continue;
  const m = dir.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?\s+(.+?)(?:\s+@\s+(.+))?$/);
  if (!m) { console.warn(`skip "${dir}" (name it like "2019-08 Yosemite @ California")`); continue; }
  const [, y, mo, d, title, place] = m;
  const id = slug(`${y}-${mo}-${title}`);
  const photos = [];
  for (const file of readdirSync(full).sort()) {
    if (!/\.(jpe?g|png|heic)$/i.test(file)) continue;
    const p = join(full, file);
    const f = slug(`${id}-${basename(file, extname(file))}`);
    const w0 = +prop(p, 'pixelWidth'), h0 = +prop(p, 'pixelHeight');
    const longest = Math.max(w0, h0);
    for (const size of [1100, 2000]) {
      const dest = join(out, `${f}-${size}.jpg`);
      if (longest > size) sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', String(size), p, '--out', dest);
      else sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '82', p, '--out', dest);
    }
    const [W, H] = [+prop(join(out, `${f}-1100.jpg`), 'pixelWidth'), +prop(join(out, `${f}-1100.jpg`), 'pixelHeight')];
    const taken = prop(p, 'creation')?.match(/^(\d{4}):(\d{2}):(\d{2})/);
    photos.push({ f, w: W, h: H, t: '', d: taken ? `${taken[1]}-${taken[2]}-${taken[3]}` : `${y}-${mo}` });
  }
  if (!photos.length) { console.warn(`"${dir}" has no images`); continue; }
  const chapter = { id, title, ...(place ? { place } : {}), date: d ? `${y}-${mo}-${d}` : `${y}-${mo}-15`, photos };
  manifest.chapters = manifest.chapters.filter((c) => c.id !== id).concat(chapter);
  console.log(`${title}: ${photos.length} photos`);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest updated. Add captions (the "t" fields) by hand if you like, then npm run dev.');
