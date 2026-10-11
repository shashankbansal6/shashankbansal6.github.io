// "Be the decoder": the closed-loop task as a 60-second game.
//
// A person with paralysis wants to pick an item on a communication board. Three
// neurons on one electrode are tuned to their intent (left / right / select);
// which one fires most depends on what they're trying to do. Their extracellular
// spikes scroll past a sort window. The player sorts each spike by shape
// (1 / 2 / 3 or tap). Correct sorts move the cursor the way the user intended;
// mislabels move it the wrong way, exactly like a decoder error. Artifacts
// should be left alone. Score = completed requests, plus sorting accuracy.
import { tint, WATERCOLOR } from '../theme.js';

const INK = WATERCOLOR ? '42,35,30' : '236,232,224'; // rgb of trace / UI ink
const UNITS = [
  { name: 'Unit 1', type: 'Fast-spiking interneuron', shape: 'narrow, tall', intent: 'left', glyph: '◀', color: tint('#5eead4'), amp: 1.0, width: 0.5, pos: false },
  { name: 'Unit 2', type: 'Pyramidal neuron', shape: 'broad, shallow', intent: 'right', glyph: '▶', color: tint('#ff6fb1'), amp: 0.55, width: 1.45, pos: false },
  { name: 'Unit 3', type: 'Axonal spike', shape: 'positive-first', intent: 'select', glyph: '●', color: tint('#ffb547'), amp: 0.8, width: 0.85, pos: true },
];
const ITEMS = ['Water', 'Food', 'Nurse', 'Lights', 'Music'];
const DURATION = 60;
const BEST_KEY = 'spikesorter.best.v2';
const SPIKE_PX = 120; // on-screen width of one spike
const WINDOW_W = 92;

// waveform of unit u at phase t (0..1 across the spike), roughly −1..1
function shape(u, t, j) {
  const a = u.amp * j.amp;
  const w = u.width * j.width;
  const x = (t - 0.35) / (0.075 * w);
  const y = (t - 0.35 - 0.16 * w) / (0.16 * w);
  const v = -Math.exp(-x * x) + 0.32 * Math.exp(-y * y);
  return u.pos ? -v * a * 0.9 : v * a;
}
function artifact(t, kind) {
  if (kind === 0) return t > 0.2 && t < 0.75 ? 0.95 * Math.sign(Math.sin(t * 40)) : 0; // saturating step
  return Math.sin(t * 60) * 0.7 * Math.sin(Math.PI * t); // ringing burst
}

const store = {
  get: () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } },
  set: (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ } },
};

export function initSpikeSorter(root) {
  const canvas = root.querySelector('.ss-canvas');
  const ctx = canvas.getContext('2d');
  const scatter = root.querySelector('.ss-scatter');
  const sctx = scatter.getContext('2d');
  const overlay = root.querySelector('.ss-overlay');
  const board = root.querySelector('.ss-board');
  const hud = Object.fromEntries([...root.querySelectorAll('[data-ss]')].map((e) => [e.dataset.ss, e]));
  const buttons = [...root.querySelectorAll('.ss-unit')];

  // ── template buttons: waveform + type + intent ──────────────────────────
  buttons.forEach((b, i) => {
    const u = UNITS[i];
    b.innerHTML = `
      <span class="ss-key"><kbd>${i + 1}</kbd><em style="color:${u.color}">${u.glyph} ${u.intent}</em></span>
      <canvas width="144" height="64"></canvas>
      <strong>${u.type}</strong>
      <small>${u.shape} · extracellular</small>`;
    const c = b.querySelector('canvas');
    const x = c.getContext('2d');
    x.scale(2, 2);
    x.strokeStyle = u.color;
    x.lineWidth = 2;
    x.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const v = shape(u, t, { amp: 1, width: 1 });
      if (k) x.lineTo(6 + t * 60, 16 - v * 12); else x.moveTo(6, 16 - v * 12);
    }
    x.stroke();
  });

  // ── board ────────────────────────────────────────────────────────────────
  board.innerHTML = ITEMS.map((n) => `<div class="ss-item"><span>${n}</span></div>`).join('');
  const cells = [...board.children];

  let W = 0, H = 0, SW = 0, SH = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = scatter.getBoundingClientRect();
    SW = s.width; SH = s.height;
    scatter.width = Math.round(SW * dpr); scatter.height = Math.round(SH * dpr);
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    drawScatter(state === 'over');
  }

  // ── state ────────────────────────────────────────────────────────────────
  let state = 'idle'; // idle | playing | over
  let events = [], sorted = [], flash = null;
  let t = 0, offset = 0, nextAt = 0, score = 0, combo = 0;
  let correct = 0, wrong = 0, missed = 0, done = 0;
  let cursor = 2, best = store.get();
  let queue = []; // the user's upcoming requests; queue[0] is the current one
  const targetOf = () => goalAt(0, cursor);
  const noise = new Float32Array(4096);
  hud.best.textContent = best;

  const windowX = () => W * 0.28;
  const speed = () => 140 + Math.min(1, t / DURATION) * 150; // px/s

  function renderBoard(pulse) {
    cells.forEach((c, i) => {
      c.classList.toggle('cursor', i === cursor);
      c.classList.toggle('target', i === targetOf());
    });
    if (pulse) {
      const c = cells[cursor];
      c.classList.remove('picked', 'oops');
      void c.offsetWidth; // restart the animation
      c.classList.add(pulse);
    }
    hud.wants.textContent = ITEMS[targetOf()];
  }

  function reset() {
    events = []; sorted = []; flash = null;
    t = 0; offset = 0; nextAt = (W || 600) * 0.75; score = 0; combo = 0;
    correct = wrong = missed = done = 0;
    cursor = 2; queue = [];
    noise[0] = 0;
    for (let i = 1; i < noise.length; i++) noise[i] = noise[i - 1] * 0.7 + (Math.random() - 0.5) * 0.11;
    renderBoard();
    updateHud();
  }

  // The user plans ahead: spikes are generated seconds before they reach the
  // sort window, so intent is based on where the cursor *will* be once every
  // intended spike already in flight has been decoded. If you mislabel or miss
  // one, later spikes automatically correct for it.
  function goalAt(k, from) {
    while (queue.length <= k) {
      const prev = queue.length ? queue[queue.length - 1] : from;
      let n;
      do n = Math.floor(Math.random() * ITEMS.length); while (n === prev);
      queue.push(n);
    }
    return queue[k];
  }
  function predict() {
    let p = cursor, k = 0;
    for (const e of events) {
      if (e.done || !e.planned) continue;
      if (e.u === 2) k++; // that request will be done; plan toward the next one
      else p = Math.max(0, Math.min(ITEMS.length - 1, p + (e.u === 0 ? -1 : 1)));
    }
    return { p, goal: goalAt(k, p) };
  }
  function spawn() {
    let u = -1, planned = false;
    if (Math.random() >= 0.12) {
      const pr = predict();
      if (Math.random() < 0.85) {
        u = pr.goal < pr.p ? 0 : pr.goal > pr.p ? 1 : 2;
        planned = true;
      } else u = Math.random() < 0.5 ? 0 : 1; // background firing never "selects"
    }
    events.push({
      x: nextAt,
      u,
      planned,
      kind: Math.floor(Math.random() * 2),
      j: { amp: 0.88 + Math.random() * 0.24, width: 0.88 + Math.random() * 0.24 },
      done: false,
    });
    nextAt += 150 + Math.random() * (180 - Math.min(1, t / DURATION) * 60);
  }
  function signalAt(wx) {
    let v = noise[Math.floor(Math.abs(wx)) % noise.length];
    for (let k = 0; k < events.length; k++) {
      const e = events[k];
      const p = (wx - e.x) / SPIKE_PX;
      if (p >= 0 && p <= 1) v += e.u < 0 ? artifact(p, e.kind) : shape(UNITS[e.u], p, e.j);
    }
    return v;
  }
  const centerOf = (e) => e.x + SPIKE_PX * 0.35;
  function activeEvent() {
    const a = offset + windowX(), b = a + WINDOW_W;
    return events.find((e) => !e.done && centerOf(e) >= a && centerOf(e) <= b) || null;
  }

  function act(i) {
    // apply the decoded command to the assistive cursor
    if (i === 0) cursor = Math.max(0, cursor - 1);
    else if (i === 1) cursor = Math.min(ITEMS.length - 1, cursor + 1);
    else if (cursor === targetOf()) {
      done++;
      score += 30;
      flash = { text: `${ITEMS[cursor]} requested ✓`, color: UNITS[2].color, at: t };
      renderBoard('picked');
      queue.shift();
      renderBoard();
      return;
    } else {
      score = Math.max(0, score - 5);
      flash = { text: `selected ${ITEMS[cursor]} by mistake`, color: 'accent', at: t };
      renderBoard('oops');
      return;
    }
    renderBoard();
  }

  function sort(i) {
    if (state !== 'playing') return;
    buttons[i].classList.remove('hit');
    void buttons[i].offsetWidth;
    buttons[i].classList.add('hit');
    const e = activeEvent();
    if (!e) {
      combo = 0;
      score = Math.max(0, score - 2);
      flash = { text: 'nothing in the window', color: `rgba(${INK},0.6)`, at: t };
      updateHud();
      return;
    }
    e.done = true;
    e.as = i;
    if (e.u === i) {
      combo++;
      correct++;
      score += 10 * Math.min(4, 1 + Math.floor(combo / 5));
    } else {
      combo = 0;
      wrong++;
      score = Math.max(0, score - 5);
      flash = { text: e.u < 0 ? 'that was an artifact' : `that was a ${UNITS[e.u].type.toLowerCase()}`, color: 'accent', at: t };
    }
    if (e.u >= 0) sorted.push({ u: e.u, as: i, amp: UNITS[e.u].amp * e.j.amp, w: UNITS[e.u].width * e.j.width });
    act(i); // the decoder acts on *your* label, right or wrong
    drawScatter(false);
    updateHud();
  }

  function start() {
    resize();
    reset();
    state = 'playing';
    overlay.hidden = true;
    root.classList.add('playing');
    canvas.focus({ preventScroll: true });
  }

  function end() {
    if (state !== 'playing') return;
    state = 'over';
    flash = null;
    root.classList.remove('playing');
    const total = correct + wrong + missed;
    const acc = total ? Math.round((correct / total) * 100) : 0;
    const isBest = score > best;
    if (isBest) { best = score; store.set(best); hud.best.textContent = best; }
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="ss-card">
        <p class="ss-title">${done} request${done === 1 ? '' : 's'} completed</p>
        <p class="ss-big">${score}</p>
        <p class="ss-sub">${correct} spikes sorted correctly · ${wrong} mislabeled · ${missed} missed · ${acc}% accuracy${isBest ? ' · new best' : ''}</p>
        <p class="ss-note">A real decoder does this for thousands of channels, in real time, on a microwatt budget. That's what the chip is for.</p>
        <button type="button" class="ss-start">Play again</button>
      </div>`;
    overlay.querySelector('.ss-start').addEventListener('click', start);
    drawScatter(true);
    draw();
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5b2e';
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const mid = H * 0.55, gain = H * 0.3;
    const wx = windowX();
    const live = state === 'playing' ? activeEvent() : null;
    ctx.fillStyle = `rgba(${INK},${live ? 0.1 : 0.04})`;
    ctx.fillRect(wx, 0, WINDOW_W, H);
    ctx.strokeStyle = `rgba(${INK},0.3)`;
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(wx + 0.5, 0.5, WINDOW_W - 1, H - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${INK},0.6)`;
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('sort window', wx + 8, 20);
    // trace
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgb(${INK})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 1.5) {
      const y = mid - signalAt(offset + x) * gain;
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // colour sorted spikes by the label you gave them
    for (const e of events) {
      if (!e.done || e.as === undefined || e.u < 0) continue;
      const sx = e.x - offset;
      if (sx > W || sx + SPIKE_PX < 0) continue;
      ctx.strokeStyle = UNITS[e.as].color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const p = k / 40;
        const y = mid - signalAt(e.x + p * SPIKE_PX) * gain;
        if (k) ctx.lineTo(sx + p * SPIKE_PX, y); else ctx.moveTo(sx, y);
      }
      ctx.stroke();
    }
    if (flash && t - flash.at < 1.1) {
      ctx.globalAlpha = 1 - (t - flash.at) / 1.1;
      ctx.fillStyle = flash.color === 'accent' ? accent() : flash.color;
      ctx.font = WATERCOLOR ? 'italic 500 18px Newsreader, serif' : '600 16px "Space Grotesk", sans-serif';
      ctx.fillText(flash.text, wx, H - 16 - (t - flash.at) * 16);
      ctx.globalAlpha = 1;
    }
  }

  function drawScatter(reveal) {
    if (!SW) return;
    sctx.clearRect(0, 0, SW, SH);
    const px = (w) => 20 + ((w - 0.3) / 1.4) * (SW - 32);
    const py = (a) => SH - 20 - ((a - 0.4) / 0.8) * (SH - 32);
    sctx.strokeStyle = `rgba(${INK},0.18)`;
    sctx.beginPath();
    sctx.moveTo(16, 8); sctx.lineTo(16, SH - 16); sctx.lineTo(SW - 6, SH - 16);
    sctx.stroke();
    sctx.fillStyle = `rgba(${INK},0.5)`;
    sctx.font = '11px Inter, sans-serif';
    sctx.fillText('spike width →', SW - 82, SH - 3);
    sctx.save(); sctx.translate(11, 76); sctx.rotate(-Math.PI / 2); sctx.fillText('amplitude →', 0, 0); sctx.restore();
    if (reveal) {
      UNITS.forEach((u) => {
        sctx.strokeStyle = u.color;
        sctx.globalAlpha = 0.6;
        sctx.setLineDash([3, 3]);
        sctx.beginPath();
        sctx.ellipse(px(u.width), py(u.amp), (u.width * 0.14 / 1.4) * (SW - 32) + 6, (u.amp * 0.13 / 0.8) * (SH - 32) + 4, 0, 0, Math.PI * 2);
        sctx.stroke();
        sctx.setLineDash([]);
        sctx.globalAlpha = 1;
      });
    }
    for (const s of sorted.slice(-300)) {
      sctx.fillStyle = UNITS[s.as].color;
      sctx.globalAlpha = s.as === s.u ? 0.9 : 0.35;
      sctx.beginPath();
      sctx.arc(px(s.w), py(s.amp), s.as === s.u ? 3 : 2.5, 0, Math.PI * 2);
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  }

  function updateHud() {
    const total = correct + wrong + missed;
    hud.score.textContent = score;
    hud.time.textContent = Math.max(0, Math.ceil(DURATION - t));
    hud.acc.textContent = total ? `${Math.round((correct / total) * 100)}%` : '—';
    hud.done.textContent = done;
  }

  // ── one loop, paused off-screen ──────────────────────────────────────────
  let visible = false;
  let last = 0;
  let hudAcc = 0;
  function step(dt) {
    if (state === 'playing') {
      t += dt;
      offset += speed() * dt;
      while (nextAt < offset + W + 200) spawn();
      const a = offset + windowX();
      for (const e of events) {
        if (!e.done && centerOf(e) < a) {
          e.done = true;
          if (e.u >= 0) {
            missed++;
            combo = 0;
            score = Math.max(0, score - 3);
            flash = { text: `missed a ${UNITS[e.u].intent} spike`, color: `rgba(${INK},0.6)`, at: t };
          } else score += 2; // correctly ignored an artifact
        }
      }
      events = events.filter((e) => e.x - offset > -SPIKE_PX * 2);
      hudAcc += dt;
      if (hudAcc > 0.2) { hudAcc = 0; updateHud(); }
      if (t >= DURATION) { updateHud(); end(); }
    } else if (state === 'idle') {
      // attract mode behind the start card
      t = (t + dt) % 30;
      offset += 80 * dt;
      while (nextAt < offset + W + 200) spawn();
      events = events.filter((e) => e.x - offset > -SPIKE_PX * 2);
    }
  }
  function frame(now) {
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    if (visible && W) {
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  // ── input ────────────────────────────────────────────────────────────────
  const keyIndex = (e) => ['1', '2', '3'].indexOf(e.key);
  window.addEventListener('keydown', (e) => {
    if (!visible || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const i = keyIndex(e);
    if (i >= 0 && state === 'playing') {
      e.preventDefault();
      sort(i);
    } else if ((e.key === 'Enter' || e.key === ' ') && state !== 'playing' && e.target === canvas) {
      e.preventDefault();
      start();
    }
  });
  buttons.forEach((b, i) => {
    // pointerdown is snappier than click and can't double-fire with keys
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sort(i);
    });
    b.addEventListener('keydown', (e) => e.key === ' ' && e.preventDefault());
  });
  overlay.querySelector('.ss-start').addEventListener('click', start);

  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    last = 0; // no time jump after being away
    if (visible) resize();
  }, { threshold: 0.15 }).observe(root);
  new ResizeObserver(() => resize()).observe(canvas);

  if (import.meta.env.DEV) window.__ss = { end, start, peek: () => activeEvent(), sort, state: () => state, stats: () => ({ score, correct, wrong, missed, done, t }) };
  reset();
  resize();
  requestAnimationFrame(frame);
  return { resize };
}
