// Add a poster or a slide deck to the "Posters & talks" section from its PDF:
//
//   node scripts/add-talk.mjs ~/Downloads/poster.pdf sfn-2025
//
// Writes into public/talks/:
//   <slug>.pdf            the PDF itself (what the download button serves)
//   <slug>-thumb.jpg      the card preview (first page, 1200 px wide)
//   one page  (a poster): <slug>.jpg, 3200 px on the long side, what the viewer shows fitted to the screen, plus
//                         <slug>/tiles.json and <slug>/<row>-<col>.jpg, the poster at 9600 px cut into 1200 px tiles,
//                         which the viewer loads only for the part you have zoomed into
//   several   (a deck):   <slug>/01.jpg, 02.jpg, ... 2560 px wide, one per slide
// Then add an entry to TALKS in src/config.js (title, venue, year, pages). Re-running replaces the files.
// Needs Ghostscript (brew install ghostscript) and Python with Pillow.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, readdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const [pdfArg, slug] = process.argv.slice(2);
if (!pdfArg || !/^[a-z0-9-]+$/.test(slug || '')) {
  console.error('usage: node scripts/add-talk.mjs <file.pdf> <slug, e.g. sfn-2025>');
  process.exit(1);
}
const pdf = resolve(pdfArg);
const out = resolve('public/talks');
const dir = join(out, slug);
const tmp = mkdtempSync(join(tmpdir(), 'talk-'));
mkdirSync(out, { recursive: true });
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir);

const gs = (args) => execFileSync('gs', ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', ...args], { encoding: 'utf8' });
const info = gs(['-dNODISPLAY', '-dNOSAFER', '-c', `(${pdf.replace(/[()\\]/g, '\\$&')}) (r) file runpdfbegin pdfpagecount = 1 pdfgetpage /MediaBox pget pop == quit`]).trim().split('\n');
const pages = Number(info[0]);
const [x0, y0, x1, y1] = info[1].replace(/[[\]]/g, '').trim().split(/\s+/).map(Number);
const [wPt, hPt] = [x1 - x0, y1 - y0];
// render to PNG (Ghostscript's own anti-aliasing), then Pillow resizes and writes JPEGs without chroma subsampling, which keeps small coloured text crisp
const render = (longPx, file, extra = []) => gs(['-sDEVICE=png16m', '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', `-r${(longPx / Math.max(wPt, hPt)) * 72}`, ...extra, '-o', file, pdf]);
const py = (code, ...args) => execFileSync('python3', ['-c', code, ...args], { encoding: 'utf8' });
const PY = `
import sys, json, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
def save(im, path, q): im.convert('RGB').save(path, 'JPEG', quality=q, subsampling=0, optimize=True, progressive=True)
def shrink(im, w): return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
`;

copyFileSync(pdf, join(out, `${slug}.pdf`));
if (pages === 1) {
  render(9600, join(tmp, 'p.png'));
  py(`${PY}
src, out, slug, d = sys.argv[1:]
im = Image.open(src); im.load()
save(shrink(im, 1200), f'{out}/{slug}-thumb.jpg', 82)
big = 3200 if im.width >= im.height else round(3200 * im.width / im.height)
save(shrink(im, big), f'{out}/{slug}.jpg', 86)
T = 1200
for r in range(-(-im.height // T)):
  for c in range(-(-im.width // T)):
    save(im.crop((c * T, r * T, min(im.width, (c + 1) * T), min(im.height, (r + 1) * T))), f'{d}/{r}-{c}.jpg', 84)
json.dump({'w': im.width, 'h': im.height, 't': T}, open(f'{d}/tiles.json', 'w'))
`, join(tmp, 'p.png'), out, slug, dir);
} else {
  const wide = wPt >= hPt ? 2560 : Math.round((2560 * hPt) / wPt);
  render(wide, join(tmp, '%02d.png'));
  py(`${PY}
src, out, slug, d = sys.argv[1:]
for f in sorted(os.listdir(src)):
  im = Image.open(os.path.join(src, f)); im.load()
  if f == '01.png': save(shrink(im, 1200), f'{out}/{slug}-thumb.jpg', 82)
  save(shrink(im, 2560), f'{d}/{f[:-4]}.jpg', 86)
`, tmp, out, slug, dir);
  console.log(`${readdirSync(dir).length} slides`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`${slug}: ${pages === 1 ? 'poster' : `deck of ${pages}`} -> public/talks/ (set pages: ${pages} in TALKS)`);
