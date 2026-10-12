// A "dive": each step is one card (what it is, the papers) and one interactive drawing. Used by the sensor-design and
// chip-design pages. It adapts to the screen on its own:
//  · laptop / desktop: a sticky stage, the text and the drawing side by side, one step per stretch of scrolling
//  · phone / small tablet: no pinned stage and nothing that scrolls inside the page. Each step is a normal block
//    (drawing, then its text) and only the page scrolls; a slim step bar stays on top to jump around.
import { makeFig, clamp } from './fig.js';
import { esc, refsHTML } from './refs.js';

// A mouse acts on press. A finger acts on a tap: if the touch turns into a scroll the browser cancels it,
// so swiping over a drawing scrolls the page instead of poking the drawing.
function tapOnly(el, fn) {
  let d = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return fn(e);
    d = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
  });
  el.addEventListener('pointerup', (e) => {
    if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && e.timeStamp - d.t < 600) fn(e);
    d = null;
  });
  el.addEventListener('pointercancel', () => { d = null; });
}

export function initDive(root, { beats, widgets, captions = {}, label = 'STEP', scrollToY, onActive, strip, stripFrom = 1 }) {
  const N = beats.length;
  const mq = matchMedia('(max-width: 900px)');
  let phone = mq.matches, idx = 0, clock = 0;
  let track, stepsEl, stepBtns, cards, views, beatEls, figs;
  const api = { active: () => idx, jump: (i) => scrollToY(yOf(i)) };

  const viewHTML = (b, i) => `
    <figure class="dive-view" data-i="${i}">
      ${strip && i >= stripFrom ? '<canvas class="dive-strip" role="group" aria-label="The recording chain: click a block to jump to it"></canvas>' : ''}
      <canvas class="dive-main" role="img" aria-label="${esc(b.title)}"></canvas>
      <div class="dive-ctl"></div>
      <figcaption>${esc(b.hint || '')}${b.hint ? ' · ' : ''}${esc(captions[b.widget] || '')}</figcaption>
    </figure>`;
  const cardHTML = (b, i) => `
    <article class="dive-card" data-i="${i}" aria-labelledby="dc-${b.id}">
      <p class="kicker"><span>${label} ${i + 1} / ${N}</span>${esc(b.depth)}</p>
      <h3 id="dc-${b.id}">${esc(b.title)}</h3>
      <p>${esc(b.text)}</p>
      ${refsHTML(b)}
    </article>`;
  const stepsHTML = `<ol class="dive-steps" aria-label="Steps">${beats.map((b, i) => `<li><button type="button" data-i="${i}">${esc(b.step)}</button></li>`).join('')}</ol>`;

  function mount() {
    root.innerHTML = phone
      ? `<div class="dive-track phone">${stepsHTML}${beats.map((b, i) => `<section class="dive-beat" data-i="${i}">${viewHTML(b, i)}${cardHTML(b, i)}</section>`).join('')}</div>`
      : `<div class="dive-track"><div class="dive-sticky">${stepsHTML}<div class="dive-cards">${beats.map(cardHTML).join('')}</div><div class="dive-views">${beats.map(viewHTML).join('')}</div></div></div>`;
    track = root.querySelector('.dive-track');
    stepsEl = root.querySelector('.dive-steps');
    stepBtns = [...root.querySelectorAll('.dive-steps button')];
    cards = [...root.querySelectorAll('.dive-card')];
    views = [...root.querySelectorAll('.dive-view')];
    beatEls = [...root.querySelectorAll('.dive-beat')];
    if (phone) { cards.forEach((c) => c.classList.add('on')); views.forEach((v) => v.classList.add('on')); }
    figs = views.map((v, i) => {
      const canvas = v.querySelector('canvas.dive-main');
      const fig = makeFig(canvas);
      const w = widgets[beats[i].widget](api);
      if (w.controls) v.querySelector('.dive-ctl').appendChild(w.controls);
      if (w.click) tapOnly(canvas, (e) => { const r = canvas.getBoundingClientRect(); w.click(fig, e.clientX - r.left, e.clientY - r.top); });
      if (w.drag) {
        // a finger only grabs the handle if it lands on it; anywhere else the swipe scrolls the page as usual
        let grab = false;
        const go = (e) => { const r = canvas.getBoundingClientRect(); w.drag(fig, e.clientX - r.left, e.clientY - r.top); };
        canvas.addEventListener('pointerdown', (e) => {
          const r = canvas.getBoundingClientRect();
          grab = e.pointerType === 'mouse' || !w.near || w.near(fig, e.clientX - r.left, e.clientY - r.top);
          if (grab) { canvas.setPointerCapture(e.pointerId); go(e); }
        });
        canvas.addEventListener('pointermove', (e) => { if (grab && e.buttons) go(e); });
        const drop = () => { grab = false; };
        canvas.addEventListener('pointerup', drop); canvas.addEventListener('pointercancel', drop);
        canvas.addEventListener('touchmove', (e) => { if (grab) e.preventDefault(); }, { passive: false });
      }
      if (w.cursor) canvas.style.cursor = w.cursor;
      else if (w.click) canvas.style.cursor = 'pointer';
      let sfig = null, sw = null;
      const sc = v.querySelector('canvas.dive-strip');
      if (sc) {
        sfig = makeFig(sc); sw = strip(api);
        sc.style.cursor = 'pointer';
        tapOnly(sc, (e) => { const r = sc.getBoundingClientRect(); sw.click(sfig, e.clientX - r.left, e.clientY - r.top); });
      }
      return { fig, w, sfig, sw, v };
    });
    stepBtns.forEach((b) => b.addEventListener('click', () => api.jump(+b.dataset.i)));
    setActive(Math.min(idx, N - 1), true);
  }

  // where to scroll for step i
  function yOf(i) {
    if (phone) return beatEls[i].getBoundingClientRect().top + scrollY - 104; // under the header and the step bar
    const span = Math.max(1, (track.offsetHeight - innerHeight) / N);
    return track.getBoundingClientRect().top + scrollY + i * span + span * 0.5;
  }

  function setActive(i, force) {
    if (i === idx && !force) return;
    idx = i;
    if (!phone) {
      cards.forEach((c, k) => { c.classList.toggle('on', k === i); c.toggleAttribute('inert', k !== i); });
      views.forEach((v, k) => { v.classList.toggle('on', k === i); v.toggleAttribute('inert', k !== i); });
      figs[i].fig.resize();
      figs[i].sfig?.resize();
    }
    stepBtns.forEach((b, k) => { b.parentElement.classList.toggle('on', k === i); b.parentElement.classList.toggle('done', k < i); });
    if (phone) { // keep the current pill in view in the step bar (only that bar moves, never the page)
      const b = stepBtns[i];
      stepsEl.scrollTo({ left: b.offsetLeft - (stepsEl.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    }
    onActive?.(i, beats[i]);
  }

  const paint = (x, dt) => {
    const { fig, w, sfig, sw } = x;
    if (!fig.W) fig.resize();
    if (!fig.W) return;
    if (fig.themeKey !== document.documentElement.dataset.theme) fig.colors();
    fig.t = clock;
    fig.ctx.clearRect(0, 0, fig.W, fig.H);
    w.draw(fig, dt);
    if (sfig) {
      if (!sfig.W) sfig.resize();
      if (sfig.W) {
        if (sfig.themeKey !== document.documentElement.dataset.theme) sfig.colors();
        sfig.t = clock; sfig.ctx.clearRect(0, 0, sfig.W, sfig.H); sw.draw(sfig, dt);
      }
    }
  };

  mount();
  // rotating a tablet or resizing a window across the breakpoint switches layout
  mq.addEventListener('change', () => { phone = mq.matches; mount(); });

  return {
    y: yOf,
    resize() {
      if (!phone) track.style.height = `${N * 88 + 20}vh`;
      figs.forEach((x) => { x.fig.resize(); x.sfig?.resize(); });
    },
    // progress 0..1 through the dive (for the background), or null when it is off screen
    step(dt, scroll) {
      const r = track.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) return null;
      clock += dt;
      if (phone) {
        // the step in the middle of the screen is "current"; every drawing on screen is drawn
        const mid = innerHeight * 0.45;
        let cur = 0;
        const rects = beatEls.map((el, k) => { const b = el.getBoundingClientRect(); if (b.top <= mid) cur = k; return b; });
        setActive(cur);
        figs.forEach((x, k) => { if (rects[k].bottom > 0 && rects[k].top < innerHeight) paint(x, dt); });
        return clamp((mid - r.top) / Math.max(1, r.height), 0, 0.9999);
      }
      const span = Math.max(1, track.offsetHeight - innerHeight);
      const p = clamp((scroll - (r.top + scroll)) / span, 0, 0.9999);
      setActive(Math.floor(p * N));
      paint(figs[idx], dt);
      return p;
    },
  };
}
