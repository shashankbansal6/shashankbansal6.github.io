// A "dive": a sticky stage where each scroll step swaps in one card (what it is, the papers) and one
// interactive drawing. Used by the sensor-design and chip-design pages.
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

export function initDive(root, { intro, beats, widgets, captions = {}, label = 'STEP', mobile, scrollToY, onActive, strip, stripFrom = 1 }) {
  const N = beats.length;
  root.innerHTML = `
    <div class="dive-track">
      <div class="dive-sticky">
        <ol class="dive-steps" aria-label="Steps">${beats.map((b, i) => `<li><button type="button" data-i="${i}">${esc(b.step)}</button></li>`).join('')}</ol>
        <div class="dive-cards">${beats.map((b, i) => `
          <article class="dive-card" data-i="${i}" aria-labelledby="dc-${b.id}">
            <p class="kicker"><span>${label} ${i + 1} / ${N}</span>${esc(b.depth)}</p>
            <h3 id="dc-${b.id}">${esc(b.title)}</h3>
            <p>${esc(b.text)}</p>
            ${refsHTML(b)}
          </article>`).join('')}</div>
        <div class="dive-views">${beats.map((b, i) => `
          <figure class="dive-view" data-i="${i}">
            ${strip && i >= stripFrom ? '<canvas class="dive-strip" role="group" aria-label="The recording chain: click a block to jump to it"></canvas>' : ''}
            <canvas class="dive-main" role="img" aria-label="${esc(b.title)}"></canvas>
            <div class="dive-ctl"></div>
            <figcaption>${esc(b.hint || '')}${b.hint ? ' · ' : ''}${esc(captions[b.widget] || '')}</figcaption>
          </figure>`).join('')}</div>
      </div>
    </div>`;
  const track = root.querySelector('.dive-track');
  const stepBtns = [...root.querySelectorAll('.dive-steps button')];
  const cards = [...root.querySelectorAll('.dive-card')];
  const views = [...root.querySelectorAll('.dive-view')];
  let idx = 0;
  const api = { active: () => idx, jump: (i) => scrollToBeat(i) };
  const figs = views.map((v, i) => {
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
    return { fig, w, sfig, sw };
  });

  const trackTop = () => track.getBoundingClientRect().top + scrollY;
  const beatSpan = () => Math.max(1, (track.offsetHeight - innerHeight) / N);
  function scrollToBeat(i) { scrollToY(trackTop() + i * beatSpan() + beatSpan() * 0.5); }
  stepBtns.forEach((b) => b.addEventListener('click', () => scrollToBeat(+b.dataset.i)));

  function setActive(i) {
    idx = i;
    cards.forEach((c, k) => { c.classList.toggle('on', k === i); c.toggleAttribute('inert', k !== i); });
    views.forEach((v, k) => { v.classList.toggle('on', k === i); v.toggleAttribute('inert', k !== i); });
    stepBtns.forEach((b, k) => { b.parentElement.classList.toggle('on', k === i); b.parentElement.classList.toggle('done', k < i); });
    figs[i].fig.resize();
    figs[i].sfig?.resize();
    onActive?.(i, beats[i]);
  }
  setActive(0);

  let clock = 0;
  return {
    resize() { track.style.height = `${N * (mobile ? 78 : 88) + 20}vh`; figs.forEach((x) => { x.fig.resize(); x.sfig?.resize(); }); },
    // progress 0..1 through the dive (for the background), or null when it is off screen
    step(dt, scroll) {
      const r = track.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) return null;
      const span = Math.max(1, track.offsetHeight - innerHeight);
      const p = clamp((scroll - (r.top + scroll)) / span, 0, 0.9999);
      const i = Math.floor(p * N);
      if (i !== idx) setActive(i);
      clock += dt;
      const { fig, w, sfig, sw } = figs[idx];
      if (!fig.W) fig.resize();
      if (!fig.W) return p;
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
      return p;
    },
  };
}
