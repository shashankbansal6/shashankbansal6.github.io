import '../src/fonts.css';
import '../src/menu.css';
import './photos.css';
import { initMenu } from '../src/menu.js';
import { initAnalytics } from '../src/analytics.js';
import manifest from './manifest.json';

const $ = (s, r = document) => r.querySelector(s);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IMG = '/photos/img/';
const VID = '/photos/vid/';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return d ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${y}`;
};
const span = (c) => {
  const ds = c.photos.map((p) => p.d).filter(Boolean).sort();
  if (!ds.length) return fmt(c.date);
  const a = ds[0], b = ds[ds.length - 1];
  if (a === b) return fmt(a);
  const [ya, ma] = a.split('-'), [yb, mb] = b.split('-');
  return ya === yb && ma === mb ? `${MONTHS[+ma - 1]} ${+a.split('-')[2]}–${+b.split('-')[2]}, ${ya}` : `${fmt(a)} – ${fmt(b)}`;
};

// newest first, like a timeline you scroll back through
const count = (c) => {
  const v = c.photos.filter((p) => p.v).length, n = c.photos.length - v;
  return [n && `${n} photo${n === 1 ? '' : 's'}`, v && `${v} video${v === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
};
const chapters = [...manifest.chapters].sort((a, b) => b.date.localeCompare(a.date));
const all = [];
const chaptersEl = $('#chapters');

if (!chapters.length) chaptersEl.innerHTML = '<p class="empty">The photo timeline is being put together. Check back soon.</p>';
chaptersEl.innerHTML += chapters.map((c) => {
  const year = c.date.slice(0, 4);
  const tiles = c.photos.map((p) => {
    const i = all.push({ ...p, chapter: c }) - 1;
    const cap = [p.t, c.place].filter(Boolean).join(' · ');
    const src = p.v ? `${VID}${p.v}.jpg` : `${IMG}${p.f}-800.jpg`;
    return `<button type="button" class="tile${p.v ? ' vid' : ''}" style="--ar:${(p.w / p.h).toFixed(4)}" data-i="${i}" aria-label="${esc(p.t || c.title)}, ${p.v ? 'play video' : 'open large'}">
      <img src="${src}" width="${p.w}" height="${p.h}" alt="${esc(p.alt || p.t || c.title)}" loading="${i < 6 ? 'eager' : 'lazy'}" decoding="async" />
      ${p.v ? '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' : ''}
      ${cap ? `<span class="cap">${esc(cap)}</span>` : ''}
    </button>`;
  }).join('');
  return `<section class="chapter" id="c-${c.id}" data-year="${year}">
    <header class="chapter-head">
      <span class="yr">${year}</span>
      <h2>${esc(c.title)}</h2>
      <span class="when">${esc(span(c))}${c.place ? ` · ${esc(c.place)}` : ''} · ${count(c)}</span>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    </header>
    <div class="grid n${c.photos.length}">${tiles}</div>
  </section>`;
}).join('');

// ── hover a clip to preview it ───────────────────────────────────────────────
// Nothing is downloaded until the pointer is over a clip, and only that one clip, so the page stays light.
// Touch screens keep the poster and the play badge; reduced-motion visitors do too.
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const preview = (tile) => {
    let v = tile.querySelector('video');
    if (!v) {
      v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-hidden', 'true');
      v.src = `${VID}${all[tile.dataset.i].v}.mp4`;
      v.addEventListener('playing', () => v.classList.add('on'), { once: true });
      tile.insertBefore(v, tile.querySelector('.play'));
    }
    return v;
  };
  chaptersEl.addEventListener('pointerover', (e) => {
    const tile = e.target.closest?.('.tile.vid');
    if (!tile || e.pointerType !== 'mouse' || tile.contains(e.relatedTarget)) return;
    preview(tile).play().catch(() => {});
  });
  chaptersEl.addEventListener('pointerout', (e) => {
    const tile = e.target.closest?.('.tile.vid');
    if (!tile || tile.contains(e.relatedTarget)) return;
    const v = tile.querySelector('video');
    if (v) { v.pause(); v.currentTime = 0; v.classList.remove('on'); }
  });
}

// ── year rail ────────────────────────────────────────────────────────────────
const years = [...new Set(chapters.map((c) => c.date.slice(0, 4)))];
$('#years').innerHTML = years.map((y) => `<li data-y="${y}"><a href="#y-${y}">${y}</a></li>`).join('');
years.forEach((y) => { chaptersEl.querySelector(`[data-year="${y}"]`).id = `y-${y}`; });
const railItems = [...document.querySelectorAll('#years li')];
const yearSections = years.map((y) => chaptersEl.querySelector(`[data-year="${y}"]`));
// measured at most once per frame (scroll events can fire several times a frame), and only touched when it changes
let spyAt = -1, spyQueued = false;
function spy() {
  spyQueued = false;
  const line = innerHeight * 0.35;
  let cur = 0;
  yearSections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) cur = i; });
  if (cur === spyAt) return;
  spyAt = cur;
  railItems.forEach((li, i) => li.classList.toggle('on', i === cur));
}
addEventListener('scroll', () => { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });
spy();

const nVid = all.filter((p) => p.v).length;
$('#meta').textContent = `${all.length - nVid} photos${nVid ? ` · ${nVid} videos` : ''} · ${chapters.length} stops · ${years[years.length - 1]}–${years[0]}`;
$('#year').textContent = new Date().getFullYear();

// ── reveal on scroll ─────────────────────────────────────────────────────────
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.tile').forEach((t, i) => {
  t.style.transitionDelay = `${(i % 4) * 60}ms`;
  io.observe(t);
});

// ── lightbox ─────────────────────────────────────────────────────────────────
const lb = $('#lb');
const lbImg = $('img', lb);
const lbVid = $('video', lb);
const lbCap = $('figcaption', lb);
let cur = -1;
let opener = null;

function show(i) {
  cur = (i + all.length) % all.length;
  const p = all[cur];
  if (p.v) {
    lbImg.hidden = true; lbImg.removeAttribute('src');
    lbVid.hidden = false;
    lbVid.poster = `${VID}${p.v}.jpg`;
    lbVid.src = `${VID}${p.v}.mp4`;
    lbVid.setAttribute('aria-label', p.alt || p.t || p.chapter.title);
    lbVid.play().catch(() => {});
  } else {
    lbVid.hidden = true; lbVid.pause(); lbVid.removeAttribute('src'); lbVid.load();
    lbImg.hidden = false;
    lbImg.src = `${IMG}${p.f}-2000.jpg`;
    lbImg.alt = p.alt || p.t || p.chapter.title;
  }
  lbCap.innerHTML = `<b>${esc(p.t || p.chapter.title)}</b><span>${esc([p.chapter.place, p.d ? fmt(p.d) : fmt(p.chapter.date)].filter(Boolean).join(' · '))} · ${cur + 1} / ${all.length}</span>`;
  // warm the neighbours
  for (const k of [cur + 1, cur - 1]) {
    const q = all[(k + all.length) % all.length];
    if (!q.v) new Image().src = `${IMG}${q.f}-2000.jpg`;
  }
}
function open(i, from) {
  opener = from;
  lb.hidden = false;
  document.body.classList.add('noscroll');
  show(i);
  $('.lb-x', lb).focus();
}
function close() {
  lb.hidden = true;
  document.body.classList.remove('noscroll');
  lbImg.removeAttribute('src');
  lbVid.pause(); lbVid.removeAttribute('src'); lbVid.load();
  opener?.focus({ preventScroll: true });
}
chaptersEl.addEventListener('click', (e) => {
  const t = e.target.closest('.tile');
  if (t) open(Number(t.dataset.i), t);
});
$('.lb-x', lb).addEventListener('click', close);
$('.prev', lb).addEventListener('click', () => show(cur - 1));
$('.next', lb).addEventListener('click', () => show(cur + 1));
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') close();
  else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
});
let x0 = null;
lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (x0 == null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
  x0 = null;
});

// ── theme switch (same storage key as the main page) ─────────────────────────
const isWC = document.documentElement.dataset.theme === 'watercolor';
document.querySelectorAll('.theme-switch button').forEach((b) => {
  const on = b.dataset.set === (isWC ? 'watercolor' : 'ink');
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', () => {
    if (on) return;
    try { localStorage.setItem('theme', b.dataset.set); } catch { /* storage unavailable */ }
    const u = new URL(location.href);
    u.searchParams.set('theme', b.dataset.set);
    location.href = u.toString();
  });
});

initMenu();
initAnalytics();
