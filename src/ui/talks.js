// "Posters & talks": a card per poster / deck, and one full-screen viewer for both.
//  · a poster opens fitted to the screen and zooms and pans (wheel or pinch, drag, double-click / double-tap);
//    zoomed in past what the fitted picture can show, the sharp tiles for just the part on screen load over it
//  · a deck shows one slide at a time: arrows, swipe, or the wheel to move; it zooms like a poster
// Each opened item gets its own address (#talks/<id>, #talks/<id>/<slide>) so it can be shared, and Back closes it.
import { TALKS } from '../config.js';

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const src = (t, i) => (t.pages === 1 ? `/talks/${t.id}.jpg` : `/talks/${t.id}/${String(i + 1).padStart(2, '0')}.jpg`);
const thumb = (t) => `/talks/${t.id}-thumb.jpg`;

export function initTalks(list, dlg) {
  if (!list || !dlg) return;
  list.innerHTML = TALKS.map((t) => `
    <li>
      <button type="button" class="talk-open" data-id="${t.id}" aria-label="View ${esc(t.title)}">
        <span class="talk-thumb ${t.pages === 1 ? 'poster' : 'deck'}"><img src="${thumb(t)}" alt="" loading="lazy" decoding="async" /></span>
        <span class="talk-meta"><span class="year">${t.year}</span>${t.kind}${t.pages > 1 ? ` · ${t.pages} slides` : ''}</span>
        <span class="talk-title">${esc(t.title)}</span>
        <span class="talk-venue">${esc(t.venue)}</span>
      </button>
      <a class="talk-pdf" href="/talks/${t.id}.pdf" download>PDF ↓</a>
    </li>`).join('');

  const $ = (s) => dlg.querySelector(s);
  const stage = $('.v-stage'), img = $('.v-img'), count = $('.v-count');
  const layer = document.createElement('div');
  layer.className = 'v-tiles';
  stage.appendChild(layer);
  let talk = null, page = 0;
  let fitW = 1, fitH = 1, s = 1, x = 0, y = 0; // fitted size, zoom (1 = fitted), pan
  let grid = null; // a poster's tiles: { w, h, t } (full size and tile size, in pixels)
  const tiles = new Map();
  const maxZoom = () => Math.max(2, ((grid ? grid.w / devicePixelRatio : img.naturalWidth) / fitW) * 1.5);

  function apply() {
    const r = stage.getBoundingClientRect();
    const w = fitW * s, h = fitH * s;
    // keep the picture covering the stage when it is bigger than it, centred when it is smaller
    x = w <= r.width ? (r.width - w) / 2 : Math.min(0, Math.max(r.width - w, x));
    y = h <= r.height ? (r.height - h) / 2 : Math.min(0, Math.max(r.height - h, y));
    // sized rather than scaled, so the browser always draws the picture from its full pixels
    for (const el of [img, layer]) {
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
    dlg.classList.toggle('zoomed', s > 1.01);
    tile(r, w, h);
  }
  // load the tiles under the screen (and a little around it) once the fitted picture would look soft; drop the rest
  function tile(r, w, h) {
    const want = new Set();
    if (grid && img.naturalWidth && w * devicePixelRatio > img.naturalWidth * 1.1) {
      const k = w / grid.w, t = grid.t, pad = t / 2;
      const cols = Math.ceil(grid.w / t), rows = Math.ceil(grid.h / t);
      const c0 = Math.max(0, Math.floor((-x / k - pad) / t)), c1 = Math.min(cols - 1, Math.floor(((r.width - x) / k + pad) / t));
      const r0 = Math.max(0, Math.floor((-y / k - pad) / t)), r1 = Math.min(rows - 1, Math.floor(((r.height - y) / k + pad) / t));
      for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++) want.add(`${i}-${j}`);
    }
    tiles.forEach((el, key) => { if (!want.has(key)) { el.remove(); tiles.delete(key); } });
    want.forEach((key) => {
      if (tiles.has(key)) return;
      const [i, j] = key.split('-').map(Number), t = grid.t;
      const el = new Image();
      el.decoding = 'async';
      el.alt = '';
      Object.assign(el.style, {
        left: `${(j * t * 100) / grid.w}%`, top: `${(i * t * 100) / grid.h}%`,
        width: `${(Math.min(t, grid.w - j * t) * 100) / grid.w}%`, height: `${(Math.min(t, grid.h - i * t) * 100) / grid.h}%`,
      });
      el.src = `/talks/${talk.id}/${key}.jpg`;
      layer.appendChild(el);
      tiles.set(key, el);
    });
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    const ar = (img.naturalWidth || 16) / (img.naturalHeight || 9);
    fitW = Math.min(r.width, r.height * ar);
    fitH = fitW / ar;
    s = 1;
    apply();
  }
  // zoom to z around a point (cx, cy) in stage coordinates
  function zoomAt(z, cx, cy) {
    z = Math.min(maxZoom(), Math.max(1, z));
    x = cx - ((cx - x) * z) / s;
    y = cy - ((cy - y) * z) / s;
    s = z;
    apply();
  }
  const centre = () => { const r = stage.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // refit when a picture of a new shape arrives; the sharp version of the same poster keeps the zoom you are at
  let shape = 0;
  img.addEventListener('load', () => {
    const ar = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ar - shape) > 0.01) { shape = ar; fit(); } else apply();
  });

  function show(i) {
    page = Math.max(0, Math.min(talk.pages - 1, i));
    const deck = talk.pages > 1;
    const full = src(talk, page);
    count.textContent = deck ? `${page + 1} / ${talk.pages}` : '';
    $('.v-prev').disabled = page === 0;
    $('.v-next').disabled = page === talk.pages - 1;
    s = 1;
    if (deck) {
      img.src = full;
      [page - 1, page + 1].forEach((k) => { if (k >= 0 && k < talk.pages) new Image().src = src(talk, k); });
    } else if (img.dataset.id !== talk.id) {
      // a poster shows its small preview at once and sharpens when the full image arrives
      const id = (img.dataset.id = talk.id);
      img.src = thumb(talk);
      const hi = new Image();
      hi.onload = () => { if (img.dataset.id === id) img.src = full; };
      hi.src = full;
    }
    apply();
    history.replaceState(history.state, '', `#talks/${talk.id}${deck && page ? `/${page + 1}` : ''}`);
  }

  function open(id, i = 0, push = true) {
    talk = TALKS.find((t) => t.id === id);
    if (!talk) return;
    shape = 0;
    grid = null;
    if (talk.pages === 1) {
      fetch(`/talks/${id}/tiles.json`).then((r) => (r.ok ? r.json() : null)).then((g) => { if (talk?.id === id) { grid = g; apply(); } }).catch(() => {});
    }
    dlg.classList.toggle('deck', talk.pages > 1);
    $('.v-title').textContent = `${talk.title} · ${talk.venue}`;
    $('.v-pdf').href = `/talks/${talk.id}.pdf`;
    img.alt = talk.pages > 1 ? `${talk.title}, slide` : `${talk.title}, poster`;
    if (push) history.pushState({ talk: id }, '', `#talks/${id}`);
    if (!dlg.open) dlg.showModal();
    show(i);
  }
  function close() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('close', () => {
    talk = null;
    grid = null;
    tiles.forEach((el) => el.remove());
    tiles.clear();
    img.removeAttribute('src');
    delete img.dataset.id;
    if (location.hash.startsWith('#talks/')) {
      if (history.state?.talk) history.back();
      else history.replaceState(null, '', '#talks');
    }
  });
  addEventListener('popstate', () => { if (dlg.open && !location.hash.startsWith('#talks/')) dlg.close(); });

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.talk-open');
    if (b) open(b.dataset.id);
  });
  $('.v-close').addEventListener('click', close);
  $('.v-prev').addEventListener('click', () => show(page - 1));
  $('.v-next').addEventListener('click', () => show(page + 1));
  $('.v-fit').addEventListener('click', fit);
  $('.v-zoom-in').addEventListener('click', () => zoomAt(s * 1.6, ...centre()));
  $('.v-zoom-out').addEventListener('click', () => zoomAt(s / 1.6, ...centre()));
  dlg.addEventListener('keydown', (e) => {
    if (!talk) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && talk.pages > 1)) { e.preventDefault(); show(page + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); show(page - 1); }
    else if (e.key === '+' || e.key === '=') zoomAt(s * 1.6, ...centre());
    else if (e.key === '-') zoomAt(s / 1.6, ...centre());
    else if (e.key === '0') fit();
  });

  // wheel: zoom (a trackpad pinch arrives as ctrl+wheel); on an unzoomed deck a plain wheel turns the page
  let wheelLock = 0;
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (talk?.pages > 1 && s <= 1.01 && !e.ctrlKey) {
      if (Math.abs(e.deltaY) < 4 || e.timeStamp < wheelLock) return;
      wheelLock = e.timeStamp + 350;
      show(page + Math.sign(e.deltaY));
      return;
    }
    zoomAt(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)), ...local(e));
  }, { passive: false });

  // pointers: one drags (or, on an unzoomed deck, swipes to the next slide); two pinch
  const ptrs = new Map();
  let start = null, lastTap = 0;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e));
    start = { s, x, y, pts: [...ptrs.values()].map((p) => [...p]), t: e.timeStamp };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId) || !start) return;
    ptrs.set(e.pointerId, local(e));
    const pts = [...ptrs.values()];
    if (pts.length >= 2 && start.pts.length >= 2) {
      const d0 = Math.hypot(start.pts[0][0] - start.pts[1][0], start.pts[0][1] - start.pts[1][1]) || 1;
      const d1 = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const m0 = [(start.pts[0][0] + start.pts[1][0]) / 2, (start.pts[0][1] + start.pts[1][1]) / 2];
      const m1 = [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2];
      const z = Math.min(maxZoom(), Math.max(1, start.s * (d1 / d0)));
      s = z;
      x = m1[0] - ((m0[0] - start.x) * z) / start.s;
      y = m1[1] - ((m0[1] - start.y) * z) / start.s;
      apply();
    } else if (pts.length === 1 && s > 1.01) {
      x = start.x + pts[0][0] - start.pts[0][0];
      y = start.y + pts[0][1] - start.pts[0][1];
      apply();
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (start && start.pts.length === 1 && ptrs.size === 0) {
      const dx = p[0] - start.pts[0][0], dy = p[1] - start.pts[0][1];
      if (talk?.pages > 1 && start.s <= 1.01 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(page + (dx < 0 ? 1 : -1));
      else if (Math.hypot(dx, dy) < 8 && e.timeStamp - start.t < 300) {
        // double-tap / double-click: zoom in there, or back out to fit
        if (e.timeStamp - lastTap < 320) { lastTap = 0; if (s > 1.01) fit(); else zoomAt(2.5, ...p); }
        else lastTap = e.timeStamp;
      }
    }
    // the finger left on the glass carries on from where it is
    start = ptrs.size ? { s, x, y, pts: [...ptrs.values()].map((q) => [...q]), t: e.timeStamp } : null;
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  addEventListener('resize', () => { if (dlg.open) fit(); });

  // a shared link straight to an item: #talks/<id> or #talks/<id>/<slide>
  const m = location.hash.match(/^#talks\/([a-z0-9-]+)(?:\/(\d+))?$/);
  if (m) open(m[1], (+m[2] || 1) - 1, false);
}
