import './photos.css';
import manifest from './manifest.json';

const $ = (s, r = document) => r.querySelector(s);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IMG = '/photos/img/';
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
const chapters = [...manifest.chapters].sort((a, b) => b.date.localeCompare(a.date));
const all = [];
const chaptersEl = $('#chapters');

if (!chapters.length) chaptersEl.innerHTML = '<p class="empty">The photo timeline is being put together. Check back soon.</p>';
chaptersEl.innerHTML += chapters.map((c) => {
  const year = c.date.slice(0, 4);
  const tiles = c.photos.map((p) => {
    const i = all.push({ ...p, chapter: c }) - 1;
    const cap = [p.t, c.place].filter(Boolean).join(' · ');
    return `<button type="button" class="tile" style="--ar:${(p.w / p.h).toFixed(4)}" data-i="${i}" aria-label="${esc(p.t || c.title)}, open large">
      <img src="${IMG}${p.f}-1100.jpg" width="${p.w}" height="${p.h}" alt="${esc(p.alt || p.t || c.title)}" loading="lazy" decoding="async" />
      ${cap ? `<span class="cap">${esc(cap)}</span>` : ''}
    </button>`;
  }).join('');
  return `<section class="chapter" id="c-${c.id}" data-year="${year}">
    <header class="chapter-head">
      <span class="yr">${year}</span>
      <h2>${esc(c.title)}</h2>
      <span class="when">${esc(span(c))}${c.place ? ` · ${esc(c.place)}` : ''} · ${c.photos.length} photo${c.photos.length === 1 ? '' : 's'}</span>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    </header>
    <div class="grid n${c.photos.length}">${tiles}</div>
  </section>`;
}).join('');

// ── year rail ────────────────────────────────────────────────────────────────
const years = [...new Set(chapters.map((c) => c.date.slice(0, 4)))];
$('#years').innerHTML = years.map((y) => `<li data-y="${y}"><a href="#y-${y}">${y}</a></li>`).join('');
years.forEach((y) => { chaptersEl.querySelector(`[data-year="${y}"]`).id = `y-${y}`; });
const railItems = [...document.querySelectorAll('#years li')];
const yearSections = years.map((y) => chaptersEl.querySelector(`[data-year="${y}"]`));
function spy() {
  const line = innerHeight * 0.35;
  let cur = 0;
  yearSections.forEach((s, i) => { if (s.getBoundingClientRect().top <= line) cur = i; });
  railItems.forEach((li, i) => li.classList.toggle('on', i === cur));
}
addEventListener('scroll', spy, { passive: true });
spy();

$('#meta').textContent = `${all.length} photos · ${chapters.length} stops · ${years[years.length - 1]}–${years[0]}`;
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
const lbCap = $('figcaption', lb);
let cur = -1;
let opener = null;

function show(i) {
  cur = (i + all.length) % all.length;
  const p = all[cur];
  lbImg.src = `${IMG}${p.f}-2000.jpg`;
  lbImg.alt = p.alt || p.t || p.chapter.title;
  lbCap.innerHTML = `<b>${esc(p.t || p.chapter.title)}</b><span>${esc([p.chapter.place, p.d ? fmt(p.d) : fmt(p.chapter.date)].filter(Boolean).join(' · '))} · ${cur + 1} / ${all.length}</span>`;
  // warm the neighbours
  for (const k of [cur + 1, cur - 1]) new Image().src = `${IMG}${all[(k + all.length) % all.length].f}-2000.jpg`;
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
