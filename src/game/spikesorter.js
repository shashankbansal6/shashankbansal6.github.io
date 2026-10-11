// Spike Sorter: a 60-second browser game.
// A slowed-down extracellular recording scrolls left. Spikes from three neurons
// (distinct waveform shapes) and the occasional artifact pass a sort window.
// Press 1 / 2 / 3 (or tap a template) to assign the spike in the window to its
// unit; leave artifacts alone. Sorted spikes land in a feature-space scatter
// (peak-to-trough width × amplitude), so the clusters form as you play.

import { tint, WATERCOLOR } from '../theme.js';

const INK = WATERCOLOR ? '42,35,30' : '236,232,224'; // rgb of the trace / UI ink
const UNITS = [
  { key: '1', name: 'Unit 1', color: tint('#5eead4'), amp: 1.0, width: 0.5, pos: false }, // tall, sharp
  { key: '2', name: 'Unit 2', color: tint('#ff6fb1'), amp: 0.55, width: 1.45, pos: false }, // short, broad
  { key: '3', name: 'Unit 3', color: tint('#ffb547'), amp: 0.8, width: 0.85, pos: true }, // positive-first
];
const DURATION = 60;
const BEST_KEY = 'spikesorter.best';

// waveform for unit u at phase t (0..1 across the spike), returns −1..1
function shape(u, t, jitter) {
  const a = u.amp * jitter.amp;
  const w = u.width * jitter.width;
  const x = (t - 0.35) / (0.075 * w);
  const trough = -Math.exp(-x * x);
  const y = (t - 0.35 - 0.16 * w) / (0.16 * w);
  const repol = 0.32 * Math.exp(-y * y);
  const v = trough + repol;
  return u.pos ? -v * a * 0.9 : v * a;
}

function artifact(t, kind) {
  if (kind === 0) return t > 0.2 && t < 0.75 ? 0.95 * Math.sign(Math.sin(t * 40)) : 0; // saturating step
  return Math.sin(t * 60) * 0.7 * Math.sin(Math.PI * t); // ringing burst
}

const bestGet = () => {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
};
const bestSet = (v) => {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ }
};

export function initSpikeSorter(root) {
  const canvas = root.querySelector('.ss-canvas');
  const ctx = canvas.getContext('2d');
  const scatter = root.querySelector('.ss-scatter');
  const sctx = scatter.getContext('2d');
  const overlay = root.querySelector('.ss-overlay');
  const hud = {
    score: root.querySelector('[data-ss="score"]'),
    time: root.querySelector('[data-ss="time"]'),
    acc: root.querySelector('[data-ss="acc"]'),
    combo: root.querySelector('[data-ss="combo"]'),
    best: root.querySelector('[data-ss="best"]'),
  };
  const buttons = [...root.querySelectorAll('.ss-unit')];

  // template thumbnails
  buttons.forEach((b, i) => {
    const c = b.querySelector('canvas');
    const x = c.getContext('2d');
    const dpr = Math.min(devicePixelRatio, 2);
    c.width = 72 * dpr; c.height = 40 * dpr;
    x.scale(dpr, dpr);
    x.strokeStyle = UNITS[i].color;
    x.lineWidth = 2;
    x.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const v = shape(UNITS[i], t, { amp: 1, width: 1 });
      if (k) x.lineTo(6 + t * 60, 20 - v * 15); else x.moveTo(6, 20 - v * 15);
    }
    x.stroke();
  });

  let W = 0, H = 0, SW = 0, SH = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = scatter.getBoundingClientRect();
    SW = s.width; SH = s.height;
    scatter.width = SW * dpr; scatter.height = SH * dpr;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    drawScatter();
  }

  // ── game state ──────────────────────────────────────────────────────────
  let state = 'idle'; // idle | playing | over
  let events = [];
  let sorted = [];
  let t = 0, offset = 0, nextAt = 0, score = 0, combo = 0;
  let correct = 0, wrong = 0, missed = 0, ignored = 0;
  let flash = null;
  let noise = new Float32Array(4096);
  let best = bestGet();
  hud.best.textContent = best;

  const SPIKE_PX = 120; // on-screen width of one spike
  const windowX = () => W * 0.28;
  const windowW = 86;
  const speed = () => 150 + Math.min(1, t / DURATION) * 190; // px/s

  function reset() {
    events = []; sorted = [];
    t = 0; offset = 0; nextAt = W * 0.9; score = 0; combo = 0;
    correct = wrong = missed = ignored = 0;
    for (let i = 0; i < noise.length; i++) noise[i] = (i ? noise[i - 1] * 0.7 : 0) + (Math.random() - 0.5) * 0.11;
  }

  function spawn() {
    const isArtifact = Math.random() < 0.13;
    const u = isArtifact ? -1 : Math.floor(Math.random() * 3);
    events.push({
      x: nextAt, // world x of spike start
      u,
      kind: Math.floor(Math.random() * 2),
      jitter: { amp: 0.88 + Math.random() * 0.24, width: 0.88 + Math.random() * 0.24 },
      done: false,
    });
    nextAt += 170 + Math.random() * (230 - Math.min(1, t / DURATION) * 90);
  }

  function signalAt(wx) {
    let v = noise[Math.floor(Math.abs(wx)) % noise.length];
    for (const e of events) {
      const p = (wx - e.x) / SPIKE_PX;
      if (p >= 0 && p <= 1) v += e.u < 0 ? artifact(p, e.kind) : shape(UNITS[e.u], p, e.jitter);
    }
    return v;
  }

  function activeEvent() {
    const wx0 = offset + windowX(), wx1 = wx0 + windowW;
    return events.find((e) => !e.done && e.x + SPIKE_PX * 0.35 >= wx0 && e.x + SPIKE_PX * 0.35 <= wx1);
  }

  function sort(i) {
    if (state !== 'playing') return;
    const e = activeEvent();
    buttons[i].classList.add('hit');
    setTimeout(() => buttons[i].classList.remove('hit'), 140);
    if (!e) {
      score = Math.max(0, score - 2);
      combo = 0;
      flash = { text: 'nothing to sort', color: '#8a867d', at: t };
      return;
    }
    e.done = true;
    if (e.u === i) {
      combo++;
      correct++;
      score += 10 * Math.min(4, 1 + Math.floor(combo / 5));
      flash = { text: combo >= 5 ? `×${Math.min(4, 1 + Math.floor(combo / 5))} combo` : 'sorted', color: UNITS[i].color, at: t };
    } else {
      combo = 0;
      wrong++;
      score = Math.max(0, score - 5);
      flash = { text: e.u < 0 ? 'that was an artifact' : `that was ${UNITS[e.u].name}`, color: '#ff5b2e', at: t };
    }
    if (e.u >= 0) sorted.push({ u: e.u, as: i, amp: UNITS[e.u].amp * e.jitter.amp, w: UNITS[e.u].width * e.jitter.width, pos: UNITS[e.u].pos });
    drawScatter();
  }

  function start() {
    reset();
    state = 'playing';
    overlay.hidden = true;
    root.classList.add('playing');
    canvas.focus({ preventScroll: true });
  }

  function end() {
    state = 'over';
    flash = null;
    root.classList.remove('playing');
    const total = correct + wrong + missed;
    const acc = total ? Math.round((correct / total) * 100) : 0;
    if (score > best) {
      best = score;
      bestSet(best);
      hud.best.textContent = best;
    }
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="ss-card">
        <p class="ss-title">Recording complete</p>
        <p class="ss-big">${score}</p>
        <p class="ss-sub">${correct} sorted correctly · ${wrong} mislabeled · ${missed} missed · ${acc}% accuracy${score >= best && score > 0 ? ' · new best' : ''}</p>
        <p class="ss-note">Real spike sorters do this for millions of spikes across thousands of channels, which is why the chip has to keep the data clean and the decoder has to run fast.</p>
        <button type="button" class="ss-start">Sort again</button>
      </div>`;
    overlay.querySelector('.ss-start').addEventListener('click', start);
    drawScatter(true);
  }

  // ── drawing ─────────────────────────────────────────────────────────────
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const mid = H * 0.52;
    const gain = H * 0.32;
    // sort window
    const wx = windowX();
    const act = state === 'playing' ? activeEvent() : null;
    ctx.fillStyle = act ? `rgba(${INK},0.09)` : `rgba(${INK},0.04)`;
    ctx.fillRect(wx, 0, windowW, H);
    ctx.strokeStyle = `rgba(${INK},0.25)`;
    ctx.setLineDash([3, 4]);
    ctx.strokeRect(wx + 0.5, 0.5, windowW - 1, H - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a867d';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('sort window', wx + 8, 16);
    // threshold line
    ctx.strokeStyle = 'rgba(255,91,46,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, mid + gain * 0.42);
    ctx.lineTo(W, mid + gain * 0.42);
    ctx.stroke();
    // trace
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgb(${INK})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 1.5) {
      const v = signalAt(offset + x);
      if (x) ctx.lineTo(x, mid - v * gain); else ctx.moveTo(x, mid - v * gain);
    }
    ctx.stroke();
    // colour already-sorted spikes
    for (const e of events) {
      if (!e.done || e.u < 0) continue;
      const sx = e.x - offset;
      if (sx > W || sx + SPIKE_PX < 0) continue;
      ctx.strokeStyle = UNITS[e.u].color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const p = k / 40;
        const v = signalAt(e.x + p * SPIKE_PX);
        if (k) ctx.lineTo(sx + p * SPIKE_PX, mid - v * gain); else ctx.moveTo(sx, mid - v * gain);
      }
      ctx.stroke();
    }
    // feedback text
    if (flash && t - flash.at < 0.9) {
      ctx.globalAlpha = 1 - (t - flash.at) / 0.9;
      ctx.fillStyle = flash.color;
      ctx.font = WATERCOLOR ? 'italic 500 16px Newsreader, serif' : '600 15px "Space Grotesk", sans-serif';
      ctx.fillText(flash.text, wx, H - 14 - (t - flash.at) * 18);
      ctx.globalAlpha = 1;
    }
  }

  function drawScatter(reveal = false) {
    if (!SW) return;
    sctx.clearRect(0, 0, SW, SH);
    const px = (w) => 18 + ((w - 0.3) / 1.4) * (SW - 30);
    const py = (a) => SH - 18 - ((a - 0.4) / 0.8) * (SH - 30);
    sctx.strokeStyle = `rgba(${INK},0.15)`;
    sctx.beginPath();
    sctx.moveTo(14, 8); sctx.lineTo(14, SH - 14); sctx.lineTo(SW - 6, SH - 14);
    sctx.stroke();
    sctx.fillStyle = '#5f5b54';
    sctx.font = '10px Inter, sans-serif';
    sctx.fillText('width →', SW - 48, SH - 2);
    sctx.save();
    sctx.translate(10, 52);
    sctx.rotate(-Math.PI / 2);
    sctx.fillText('amplitude →', 0, 0);
    sctx.restore();
    if (reveal) {
      UNITS.forEach((u) => {
        sctx.strokeStyle = u.color;
        sctx.globalAlpha = 0.5;
        sctx.setLineDash([3, 3]);
        sctx.beginPath();
        sctx.ellipse(px(u.width), py(u.amp), (u.width * 0.14 / 1.4) * (SW - 30) + 6, (u.amp * 0.13 / 0.8) * (SH - 30) + 4, 0, 0, Math.PI * 2);
        sctx.stroke();
        sctx.setLineDash([]);
        sctx.globalAlpha = 1;
      });
    }
    for (const s of sorted) {
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
    hud.combo.textContent = combo >= 5 ? `×${Math.min(4, 1 + Math.floor(combo / 5))}` : '×1';
  }

  // ── loop ────────────────────────────────────────────────────────────────
  let visible = false;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      if (state === 'playing') {
        t += dt;
        offset += speed() * dt;
        while (nextAt < offset + W + 200) spawn();
        // events that left the window unsorted
        const wx0 = offset + windowX();
        for (const e of events) {
          if (!e.done && e.x + SPIKE_PX * 0.35 < wx0) {
            e.done = true;
            if (e.u >= 0) {
              missed++;
              combo = 0;
              score = Math.max(0, score - 3);
              flash = { text: 'missed', color: '#8a867d', at: t };
            } else {
              ignored++;
              score += 2;
            }
          }
        }
        events = events.filter((e) => e.x - offset > -SPIKE_PX * 2);
        if (t >= DURATION) end();
        updateHud();
      } else if (state === 'idle') {
        // attract mode: let the trace drift behind the start card
        t += dt;
        offset += 90 * dt;
        while (nextAt < offset + W + 200) spawn();
        events = events.filter((e) => e.x - offset > -SPIKE_PX * 2);
      }
      draw();
    }
    requestAnimationFrame(frame);
  }

  // ── input ───────────────────────────────────────────────────────────────
  root.addEventListener('keydown', (e) => {
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0) {
      e.preventDefault();
      sort(i);
    } else if ((e.key === ' ' || e.key === 'Enter') && state !== 'playing' && e.target === canvas) {
      e.preventDefault();
      start();
    }
  });
  // also accept keys while the game is on screen and playing, even without focus
  window.addEventListener('keydown', (e) => {
    if (!visible || state !== 'playing' || root.contains(e.target)) return;
    const i = ['1', '2', '3'].indexOf(e.key);
    if (i >= 0) {
      e.preventDefault();
      sort(i);
    }
  });
  buttons.forEach((b, i) => b.addEventListener('click', () => (state === 'playing' ? sort(i) : null)));
  overlay.querySelector('.ss-start').addEventListener('click', start);

  // off-screen = paused (the loop only advances while visible)
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    last = performance.now();
  }, { threshold: 0.2 }).observe(root);

  addEventListener('resize', resize);
  if (import.meta.env.DEV) window.__ss = { end, start };
  reset();
  resize();
  requestAnimationFrame(frame);
  return { resize };
}
