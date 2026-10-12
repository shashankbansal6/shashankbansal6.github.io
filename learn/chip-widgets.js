// Interactive drawings for the chip page, one per beat. Each widget returns { controls?, draw(f, dt), click?, move? }.
import { CHIP, totalPowerMW } from '../src/config.js';
import { TAU, clamp, lerp, fmt, rng, gauss, slider, segmented, text, roundRect, glow, withAlpha } from './fig.js';

// 1 · a spike in noise, and a threshold detector
function signalWidget() {
  const FS = 10000, M = 40000, WIN = 2000;
  const r = rng(7);
  const clean = new Float32Array(M), noise = new Float32Array(M), near = new Uint8Array(M);
  const peaks = [];
  let last = -999;
  for (let i = 20; i < M - 20; i++) {
    if (i - last > 90 && r() < 0.0035) {
      const a = 70 + r() * 80;
      for (let k = 0; k < 16; k++) clean[i + k] += -a * Math.exp(-(((k - 4) / 2) ** 2)) + 0.35 * a * Math.exp(-(((k - 9) / 3.2) ** 2));
      peaks.push(i + 4);
      for (let k = -12; k < 6; k++) near[i + 4 + k] = 1;
      last = i;
    }
  }
  for (let i = 0; i < M; i++) noise[i] = gauss(r);
  let sigma = 14;
  const controls = document.createElement('div');
  controls.append(slider('Amplifier noise', 2, 40, 1, sigma, (v) => `${v} µV rms`, (v) => (sigma = v)).el);
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const L = 40, R = W - 10, T = 26, B = H - 30, mid = (T + B) / 2;
      const y = (v) => mid - (v / 220) * (B - T) * 0.5;
      const s0 = Math.floor(f.t * 2500) % (M - WIN - 10);
      ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1;
      for (const v of [-200, -100, 0, 100, 200]) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(R, y(v)); ctx.stroke(); text(f, v ? `${v > 0 ? '+' : ''}${v}` : '0', L - 6, y(v) + 3, { size: 9.5, align: 'right', a: 0.45 }); }
      text(f, 'µV', L - 6, T - 8, { size: 9.5, align: 'right', a: 0.45 });
      const thr = -4 * sigma;
      ctx.strokeStyle = c.accent; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(L, y(thr)); ctx.lineTo(R, y(thr)); ctx.stroke(); ctx.setLineDash([]);
      text(f, 'detection line (−4 × noise)', R - 4, y(thr) - 5, { size: 10, align: 'right', color: c.accent });
      ctx.strokeStyle = c.txt(0.85); ctx.lineWidth = 1.1;
      ctx.beginPath();
      const px = (i) => L + (i / WIN) * (R - L);
      for (let i = 0; i < WIN; i += 2) {
        const v = clean[s0 + i] + sigma * noise[s0 + i];
        i ? ctx.lineTo(px(i), y(clamp(v, -230, 230))) : ctx.moveTo(px(i), y(clamp(v, -230, 230)));
      }
      ctx.stroke();
      let caught = 0, total = 0, false_ = 0, lastFA = -99;
      for (const p of peaks) {
        if (p < s0 + 6 || p > s0 + WIN - 10) continue;
        total++;
        let mn = 1e9;
        for (let k = -3; k <= 6; k++) mn = Math.min(mn, clean[p + k] + sigma * noise[p + k]);
        const got = mn < thr;
        if (got) caught++;
        const x = px(p - s0), yy = y(clean[p] + sigma * noise[p]);
        ctx.lineWidth = 2; ctx.strokeStyle = got ? c.non : c.inv;
        ctx.beginPath(); ctx.arc(x, got ? yy : y(-90), 9, 0, TAU); ctx.stroke();
        if (got) { ctx.fillStyle = c.non; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; }
      }
      for (let i = 0; i < WIN; i++) {
        if (!near[s0 + i] && clean[s0 + i] + sigma * noise[s0 + i] < thr && i - lastFA > 14) {
          false_++; lastFA = i;
          ctx.strokeStyle = c.stim; ctx.lineWidth = 1.6;
          const x = px(i); ctx.beginPath(); ctx.moveTo(x - 4, y(thr) - 14); ctx.lineTo(x + 4, y(thr) - 6); ctx.moveTo(x + 4, y(thr) - 14); ctx.lineTo(x - 4, y(thr) - 6); ctx.stroke();
        }
      }
      text(f, `caught ${caught} of ${total} neurons`, L, H - 10, { size: 12, weight: 600, a: 0.9 });
      text(f, `${false_} false alarm${false_ === 1 ? '' : 's'}`, L + 150, H - 10, { size: 12, weight: 600, color: false_ ? c.stim : c.txt(0.5) });
      text(f, '○ caught   ○ missed', R, H - 10, { size: 10.5, align: 'right', a: 0.55 });
      text(f, '200 ms of recording', R, T - 8, { size: 10, align: 'right', a: 0.45 });
    },
  };
}

// 2 · noise efficiency factor: noise vs power
function nefWidget() {
  const BW = 10000, VDD = 1, UT = 0.02585, kT4 = 4 * 1.380649e-23 * 300;
  const noise = (P_uW, nef) => nef * Math.sqrt((Math.PI * UT * kT4 * BW * VDD) / (2 * P_uW * 1e-6)) * 1e6; // µV rms
  let P = 1;
  const controls = document.createElement('div');
  controls.append(slider('Power per channel', 0, 1, 0.005, 1 / 3, (v) => `${fmt(0.1 * 1000 ** v, 2)} µW`, (v) => (P = 0.1 * 1000 ** v)).el);
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const L = 46, R = W - 14, T = 22, B = H - 42;
      const x = (p) => L + (Math.log10(p) + 1) / 3 * (R - L);
      const y = (v) => B - (Math.log10(v) - Math.log10(0.5)) / (Math.log10(60) - Math.log10(0.5)) * (B - T);
      ctx.lineWidth = 1; ctx.strokeStyle = c.txt(0.1);
      for (const p of [0.1, 1, 10, 100]) { ctx.beginPath(); ctx.moveTo(x(p), T); ctx.lineTo(x(p), B); ctx.stroke(); text(f, `${p}`, x(p), B + 13, { size: 10, align: 'center', a: 0.5 }); }
      for (const v of [1, 10]) { ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(R, y(v)); ctx.stroke(); text(f, `${v}`, L - 6, y(v) + 3, { size: 10, align: 'right', a: 0.5 }); }
      text(f, 'power per channel (µW)', (L + R) / 2, H - 22, { size: 10.5, align: 'center', a: 0.55 });
      text(f, 'input noise (µV rms)', 6, 13, { size: 10.5, a: 0.55 });
      const curve = (nef, color, w, dash, label) => {
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) { const p = 0.1 * 1000 ** (i / 60); const v = noise(p, nef); i ? ctx.lineTo(x(p), y(v)) : ctx.moveTo(x(p), y(v)); }
        ctx.stroke(); ctx.setLineDash([]);
        text(f, label, R - 2, y(noise(100, nef)) - 6, { size: 10, align: 'right', color });
      };
      curve(1, c.txt(0.4), 1, [4, 4], 'NEF 1 · ideal');
      curve(6, c.txt(0.35), 1.2, [], 'NEF 6');
      curve(3, c.txt(0.5), 1.4, [], 'NEF 3');
      curve(CHIP.nef, c.accent, 2.6, [], `NEF ${CHIP.nef}`);
      const v = noise(P, CHIP.nef);
      if (P * 4 <= 100) { // the "four times the power" ghost
        ctx.strokeStyle = c.txt(0.45); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x(P), y(v)); ctx.lineTo(x(P * 4), y(v)); ctx.lineTo(x(P * 4), y(v / 2)); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x(P * 4), y(v / 2), 4, 0, TAU); ctx.stroke();
        text(f, '4× the power → ½ the noise', x(P * 4) + 6, y(v) - 6, { size: 10, a: 0.7 });
      }
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(x(P), y(v), 6.5, 0, TAU); ctx.fill();
      text(f, `${fmt(P, 2)} µW  →  ${fmt(v, 1)} µV rms`, L + 4, T + 12, { size: 13, weight: 700, a: 0.92 });
      text(f, 'assumes a 1 V supply and 10 kHz of bandwidth', L + 4, T + 27, { size: 10, a: 0.5 });
    },
  };
}

// 3 · quantisation
function adcWidget() {
  let bits = 4;
  const controls = document.createElement('div');
  controls.append(slider('ADC resolution', 1, 10, 1, bits, (v) => `${v} bit${v > 1 ? 's' : ''}`, (v) => (bits = v)).el);
  const FS = 400; // full scale, µV
  const sig = (u) => { // one spike, u in 0..1 over 3 ms
    const k = u * 16;
    const a = 125;
    return -a * Math.exp(-(((k - 4.5) / 2) ** 2)) + 0.35 * a * Math.exp(-(((k - 9.5) / 3.2) ** 2)) + 0;
  };
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const L = 40, R = W - 12, T = 22, B = H - 36;
      const y = (v) => (T + B) / 2 - (v / (FS / 2)) * ((B - T) / 2);
      const levels = 2 ** bits, lsb = FS / levels;
      if (levels <= 64) {
        ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1;
        for (let i = 0; i <= levels; i++) { const v = -FS / 2 + i * lsb; ctx.beginPath(); ctx.moveTo(L, y(v)); ctx.lineTo(R, y(v)); ctx.stroke(); }
      } else {
        ctx.strokeStyle = c.txt(0.1); ctx.beginPath(); ctx.moveTo(L, y(0)); ctx.lineTo(R, y(0)); ctx.stroke();
      }
      text(f, `+${FS / 2}`, L - 6, y(FS / 2) + 4, { size: 10, align: 'right', a: 0.5 });
      text(f, `−${FS / 2}`, L - 6, y(-FS / 2) + 3, { size: 10, align: 'right', a: 0.5 });
      text(f, 'µV', L - 6, T - 8, { size: 10, align: 'right', a: 0.5 });
      const N = 48;
      // original
      ctx.strokeStyle = c.txt(0.45); ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) { const u = i / 300; const x = L + u * (R - L); i ? ctx.lineTo(x, y(sig(u))) : ctx.moveTo(x, y(sig(u))); }
      ctx.stroke();
      // sampled and quantised
      const q = (v) => { const lv = clamp(Math.floor((v + FS / 2) / lsb), 0, levels - 1); return -FS / 2 + (lv + 0.5) * lsb; };
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4; ctx.beginPath();
      let err = 0;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N;
        const v = q(sig((u0 + u1) / 2));
        err = Math.max(err, Math.abs(v - sig((u0 + u1) / 2)));
        const x0 = L + u0 * (R - L), x1 = L + u1 * (R - L);
        ctx.moveTo(x0, y(v)); ctx.lineTo(x1, y(v));
      }
      ctx.stroke();
      text(f, `${levels} levels · step ${fmt(lsb, lsb < 1 ? 2 : 1)} µV`, L, H - 20, { size: 12.5, weight: 700, a: 0.92 });
      const rel = 2 ** (bits - 4);
      text(f, `energy per sample ≈ ${rel >= 1 ? fmt(rel, 0) : `1/${fmt(1 / rel, 0)}`}× a 4-bit conversion`, L, H - 5, { size: 10.5, a: 0.6 });
      text(f, '— the spike   ▬ what the chip keeps', R, T - 8, { size: 10, align: 'right', a: 0.55 });
      if (bits <= 2) text(f, 'the spike is gone', (L + R) / 2, T + 20, { size: 12, weight: 700, align: 'center', color: c.inv });
    },
  };
}

// 4 · clocked vs event-driven
function eventsWidget() {
  const N = 64, COLS = 16;
  let p = 0.05, tick = 0, lastTick = -1, k = 0;
  const r = rng(3);
  let active = new Uint8Array(N);
  let cumClock = 0, cumEvent = 0, ticks = 0;
  const flash = new Float32Array(N), flashC = new Float32Array(N);
  const controls = document.createElement('div');
  controls.append(slider('Neurons spiking per tick', 1, 40, 1, 5, (v) => `${v}%`, (v) => { p = v / 100; cumClock = cumEvent = ticks = 0; }).el);
  return {
    controls,
    draw(f, dt) {
      const { ctx, W, H, c } = f;
      tick = Math.floor(f.t / 0.55);
      if (tick !== lastTick) {
        lastTick = tick;
        k = 0;
        for (let i = 0; i < N; i++) { active[i] = r() < p ? 1 : 0; k += active[i]; }
        for (let i = 0; i < N; i++) { flashC[i] = 1; if (active[i]) flash[i] = 1; }
        cumClock += N; cumEvent += k; ticks++;
      }
      for (let i = 0; i < N; i++) { flash[i] *= 0.9; flashC[i] *= 0.9; }
      const cell = Math.min((W - 24) / COLS, (H - 112) / 8);
      const gw = cell * COLS, x0 = (W - gw) / 2;
      const panel = (y0, title, sub, fl, isEvent, work) => {
        text(f, title, x0, y0 - 6, { size: 12, weight: 700, a: 0.9 });
        text(f, sub, x0 + gw, y0 - 6, { size: 11, weight: 600, align: 'right', color: isEvent ? c.non : c.inv });
        for (let i = 0; i < N; i++) {
          const cx = x0 + (i % COLS) * cell, cy = y0 + Math.floor(i / COLS) * cell;
          ctx.fillStyle = c.txt(0.07); ctx.fillRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3);
          const a = fl[i];
          if (a > 0.02) {
            ctx.fillStyle = isEvent ? c.non : (active[i] ? c.accent : c.inv);
            ctx.globalAlpha = Math.min(1, a * (isEvent || active[i] ? 1 : 0.55));
            ctx.fillRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3);
            ctx.globalAlpha = 1;
          }
        }
        void work;
      };
      const h1 = 22, gh = cell * 4;
      panel(h1 + 6, 'Clocked', `${N} updates every tick`, flashC, false, N);
      panel(h1 + 6 + gh + 36, 'Event-driven', `${k} update${k === 1 ? '' : 's'} this tick`, flash, true, k);
      const ratio = cumEvent > 0 ? cumClock / cumEvent : 1 / p;
      text(f, `work over time: ${fmt(ratio, 0)}× less when only spikes cost anything`, W / 2, H - 8, { size: 12, weight: 700, align: 'center', a: 0.9 });
    },
  };
}

// the six blocks of the recording chip, shared by the chain figure and the strip above every later figure
const CHAIN = [
  { n: 'Electrode', s: 'microvolts', beat: 1, col: 'inv', cap: 'µV, in noise' },
  { n: 'Amplifier', s: '× 1,000', beat: 2, col: 'inv', cap: 'same, ×1,000' },
  { n: 'ADC', s: '10 bits', beat: 3, col: 'stim', cap: '30k numbers/s' },
  { n: 'Events', s: 'spikes only', beat: 4, col: 'non', cap: 'only on spikes' },
  { n: 'In-memory', s: 'decode', beat: 5, col: 'non', cap: 'which neuron' },
  { n: 'Radio', s: 'bits out', beat: 6, col: 'accent', cap: 'packets' },
];

const icon = (f, i, cx, cy, s, on) => {
  const { ctx, c } = f;
  const col = c[CHAIN[i].col] || c.accent;
  ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = on ? col : c.txt(0.8); ctx.fillStyle = col;
  const t = f.t;
  if (i === 0) { // a shank with its tip in tissue, a neuron firing nearby
    ctx.beginPath(); ctx.moveTo(cx - s * 0.07, cy - s * 0.5); ctx.lineTo(cx + s * 0.07, cy - s * 0.5); ctx.lineTo(cx, cy + s * 0.34); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.36, 2.6, 0, TAU); ctx.fill();
    for (const [dx, dy] of [[-0.34, 0.12], [0.36, 0.28], [0.3, -0.12]]) { ctx.beginPath(); ctx.arc(cx + dx * s, cy + dy * s, s * 0.09, 0, TAU); ctx.fillStyle = withAlpha(col, 0.55); ctx.fill(); }
    const ph = (t * 1.3) % 1;
    ctx.strokeStyle = withAlpha(col, 1 - ph); ctx.beginPath(); ctx.arc(cx + 0.36 * s, cy + 0.28 * s, s * (0.1 + 0.32 * ph), 0, TAU); ctx.stroke();
  } else if (i === 1) { // op-amp
    ctx.beginPath(); ctx.moveTo(cx - s * 0.34, cy - s * 0.4); ctx.lineTo(cx - s * 0.34, cy + s * 0.4); ctx.lineTo(cx + s * 0.4, cy); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy - s * 0.2); ctx.lineTo(cx - s * 0.34, cy - s * 0.2); ctx.moveTo(cx - s * 0.55, cy + s * 0.2); ctx.lineTo(cx - s * 0.34, cy + s * 0.2); ctx.moveTo(cx + s * 0.4, cy); ctx.lineTo(cx + s * 0.58, cy); ctx.stroke();
    text(f, '+', cx - s * 0.25, cy - s * 0.14, { size: 11, weight: 700, color: ctx.strokeStyle }); text(f, '−', cx - s * 0.25, cy + s * 0.3, { size: 11, weight: 700, color: ctx.strokeStyle });
  } else if (i === 2) { // staircase
    ctx.beginPath();
    for (let k = 0; k < 5; k++) { const x0 = cx - s * 0.5 + k * s * 0.2, y0 = cy + s * 0.34 - k * s * 0.17; ctx.lineTo(x0, y0); ctx.lineTo(x0 + s * 0.2, y0); }
    ctx.stroke();
    const bits = ['1', '0', '1', '1'];
    text(f, bits.map((b, k) => ((Math.floor(t * 3) + k) % 3 ? b : b === '1' ? '0' : '1')).join(''), cx, cy - s * 0.38, { size: 9.5, weight: 600, align: 'center', color: withAlpha(col, 0.95), font: 'JetBrains Mono, monospace' });
  } else if (i === 3) { // sparse ticks
    ctx.beginPath(); ctx.moveTo(cx - s * 0.52, cy + s * 0.3); ctx.lineTo(cx + s * 0.52, cy + s * 0.3); ctx.stroke();
    for (const [dx, h] of [[-0.34, 0.5], [0.04, 0.7], [0.38, 0.4]]) { ctx.beginPath(); ctx.moveTo(cx + dx * s, cy + s * 0.3); ctx.lineTo(cx + dx * s, cy + s * 0.3 - h * s); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + dx * s, cy + s * 0.3 - h * s, 2.2, 0, TAU); ctx.fill(); }
  } else if (i === 4) { // crossbar with one active row and column
    const n = 4, g = s * 0.26, x0 = cx - g * 1.5, y0 = cy - g * 1.5, ar = Math.floor(t * 1.2) % n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { ctx.beginPath(); ctx.arc(x0 + b * g, y0 + a * g, a === ar ? 2.8 : 1.9, 0, TAU); ctx.fillStyle = a === ar ? col : c.txt(0.5); ctx.fill(); }
    ctx.strokeStyle = withAlpha(col, 0.9); ctx.beginPath(); ctx.moveTo(x0 - g * 0.6, y0 + ar * g); ctx.lineTo(x0 + g * 3.6, y0 + ar * g); ctx.stroke();
  } else { // antenna
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.42); ctx.lineTo(cx, cy - s * 0.05); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, 3, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) { const ph = (t * 0.9 + k / 3) % 1; ctx.strokeStyle = withAlpha(col, (1 - ph) * 0.9); ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * (0.14 + 0.36 * ph), -2.3, -0.84); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 0.12, s * (0.14 + 0.36 * ph), Math.PI + 0.84, Math.PI + 2.3); ctx.stroke(); }
  }
};

// 0 · the whole chain: one spike's journey, drawn as the signal itself changing shape
function chainWidget(api) {
  const M = 6000, K = 1.4;
  const r = rng(11);
  const clean = new Float32Array(M), noise = new Float32Array(M), det = [];
  let last = -999;
  for (let i = 40; i < M - 40; i++) {
    if (i - last > 170 && r() < 0.011) {
      const a = 75 + r() * 70;
      for (let k = 0; k < 26; k++) clean[i + k] += -a * Math.exp(-(((k - 5) / 2.4) ** 2)) + 0.35 * a * Math.exp(-(((k - 11) / 4) ** 2));
      det.push({ i: i + 5, cls: Math.floor(r() * 3) });
      last = i;
    }
  }
  for (let i = 0; i < M; i++) noise[i] = gauss(r);
  const SIGMA = 15;
  let hit = [], hover = -1;
  const RAW = 1024 * 30000 * 10;           // bit/s straight off the ADCs
  const EVT = 1024 * 10 * 16;              // 10 spikes/s per channel, 16 bits per event (illustrative)
  const DEC = 20;                          // a decoded intention: tens of bits/s at most
  const sizeOf = (rate) => clamp((Math.log10(rate) - 1) / (Math.log10(RAW) - 1), 0, 1);
  const thick = [1, 1, 1, sizeOf(EVT), sizeOf(EVT) * 0.55, sizeOf(DEC)];

  return {
    draw(f, dt) {
      const { ctx, W, H, c } = f;
      const narrow = W < 470;
      const PADX = narrow ? 8 : 14, L = PADX, R = W - PADX, zw = (R - L) / CHAIN.length;
      const usable = H - 18;
      const th = clamp(usable * 0.22, 58, 100), rh = usable * 0.32, fh = Math.max(34, usable * 0.14);
      const ty = 8, ry = ty + th + 22 + rh / 2, fy = ry + rh / 2 + 18 + fh / 2;
      const s0 = f.t * 220;
      const colOf = (i) => c[CHAIN[i].col] || c.accent;
      const active = api.active();
      hit = [];
      // which tile is under the pointer?
      hover = -1;
      if (f.mouse.in) CHAIN.forEach((st, i) => { const x0 = L + i * zw; if (f.mouse.x >= x0 && f.mouse.x <= x0 + zw && f.mouse.y >= ty - 4 && f.mouse.y <= ry + rh / 2 + 4) hover = i; });

      // 1 · the six tiles
      CHAIN.forEach((st, i) => {
        const x0 = L + i * zw + 3, w = zw - 6, cx = x0 + w / 2;
        const on = st.beat > 0 && st.beat === active;
        const hv = hover === i;
        const lift = hv ? -3 : 0;
        roundRect(ctx, x0, ty + lift, w, th, 10);
        ctx.fillStyle = on ? withAlpha(colOf(i), 0.16) : c.paper; ctx.fill();
        ctx.strokeStyle = on || hv ? colOf(i) : c.txt(0.22); ctx.lineWidth = on || hv ? 1.8 : 1; ctx.stroke();
        icon(f, i, cx, ty + lift + th * 0.4, Math.min(w * 0.8, th * 0.62), on || hv);
        text(f, st.n, cx, ty + lift + th - 17, { size: narrow ? 9.5 : 12, weight: 700, align: 'center', a: 0.92 });
        text(f, st.s, cx, ty + lift + th - 5, { size: narrow ? 8.5 : 10, align: 'center', color: withAlpha(colOf(i), 1) });
        if (st.beat) hit.push({ x: x0, y: ty - 4, w, h: ry + rh / 2 - ty + 8, beat: st.beat });
      });

      // 2 · the signal ribbon, one zone per block
      CHAIN.forEach((st, i) => {
        const zl = L + i * zw, zr = zl + zw;
        const on = (st.beat > 0 && st.beat === active) || hover === i;
        ctx.fillStyle = withAlpha(colOf(i), on ? 0.16 : 0.06);
        ctx.fillRect(zl, ry - rh / 2, zw, rh);
        ctx.strokeStyle = c.txt(0.18); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(zl, ry - rh / 2); ctx.lineTo(zl, ry + rh / 2); ctx.stroke();
        if (!narrow) text(f, st.cap, zl + zw / 2, ry - rh / 2 + 13, { size: 9.5, align: 'center', color: withAlpha(colOf(i), 1) });
        ctx.save();
        ctx.beginPath(); ctx.rect(zl + 1, ry - rh / 2 + (narrow ? 2 : 18), zw - 1, rh - (narrow ? 4 : 20)); ctx.clip();
        const mid = ry + (narrow ? 0 : 7), idxAt = (x) => ((Math.floor(s0 - (x - L) * K) % M) + M) % M;
        ctx.strokeStyle = colOf(i); ctx.lineWidth = 1.7; ctx.lineJoin = 'round';
        if (i <= 2) {
          const gain = i === 0 ? 0.2 : 0.4;       // px per µV
          ctx.beginPath();
          if (i < 2) {
            for (let x = zl; x <= zr; x += 1.5) { const k = idxAt(x), v = clamp(clean[k] + SIGMA * noise[k], -260, 260); x === zl ? ctx.moveTo(x, mid - v * gain) : ctx.lineTo(x, mid - v * gain); }
          } else { // sampled and held on a coarse grid of levels
            const lsb = 400 / 32; let px = null;
            for (let x = zl; x <= zr; x += 5) {
              const k = idxAt(x), v = clamp(clean[k] + SIGMA * noise[k], -200, 200), q = Math.round(v / lsb) * lsb;
              if (px === null) ctx.moveTo(x, mid - q * gain); else { ctx.lineTo(x, mid - px * gain); ctx.lineTo(x, mid - q * gain); }
              px = q;
            }
          }
          ctx.stroke();
          if (i === 2) {
            ctx.fillStyle = withAlpha(c.stim, 0.9);
            for (let x = zl + 8; x < zr - 8; x += 38) { const k = idxAt(x); const bits = ((k * 2654435761) >>> 0).toString(2).slice(-4); text(f, bits, x, ry + rh / 2 - 6, { size: 8.5, weight: 600, align: 'center', color: withAlpha(c.stim, 0.9), font: 'JetBrains Mono, monospace' }); }
          }
        } else { // events, decoded events, packets
          ctx.strokeStyle = c.txt(0.22); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(zl, mid + rh * 0.22); ctx.lineTo(zr, mid + rh * 0.22); ctx.stroke();
          for (const d of det) {
            const off = (((s0 - d.i) % M) + M) % M, x = L + off / K;
            if (x < zl - 24 || x > zr + 24) continue;
            if (i === 3) { ctx.strokeStyle = c.non; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, mid + rh * 0.22); ctx.lineTo(x, mid - rh * 0.22); ctx.stroke(); ctx.fillStyle = c.non; ctx.beginPath(); ctx.arc(x, mid - rh * 0.22, 3, 0, TAU); ctx.fill(); }
            else if (i === 4) {
              const col = [c.accent, c.non, c.inv][d.cls];
              ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, mid + rh * 0.22); ctx.lineTo(x, mid - rh * 0.1); ctx.stroke();
              ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, mid - rh * 0.16, 5, 0, TAU); ctx.fill();
              text(f, 'ABC'[d.cls], x, mid - rh * 0.16 + 3.2, { size: 8.5, weight: 800, align: 'center', color: c.onAccent });
            } else {
              roundRect(ctx, x - 11, mid - 9, 22, 16, 4); ctx.fillStyle = withAlpha(c.accent, 0.16); ctx.fill(); ctx.strokeStyle = c.accent; ctx.lineWidth = 1.3; ctx.stroke();
              for (let b = 0; b < 3; b++) { ctx.fillStyle = (d.i >> b) & 1 ? c.accent : withAlpha(c.accent, 0.3); ctx.fillRect(x - 8 + b * 6, mid - 4, 4, 6); }
            }
          }
        }
        ctx.restore();
        if (i === 0 && !narrow) text(f, '~100 µV', zl + 6, ry + rh / 2 - 6, { size: 9.5, weight: 600, color: withAlpha(c.inv, 1) });
        if (i === 1 && !narrow) text(f, '~100 mV', zl + 6, ry + rh / 2 - 6, { size: 9.5, weight: 600, color: withAlpha(c.inv, 1) });
      });
      // arrowheads between blocks
      ctx.fillStyle = c.txt(0.55);
      for (let i = 1; i < CHAIN.length; i++) { const x = L + i * zw; ctx.beginPath(); ctx.moveTo(x - 4, ry - 6); ctx.lineTo(x + 3, ry); ctx.lineTo(x - 4, ry + 6); ctx.closePath(); ctx.fill(); }

      // 3 · the data funnel: how many bits per second each stage carries (log scale)
      const maxT = fh, minT = 3;
      const tAt = (i) => minT + (maxT - minT) * thick[i];
      const xs = CHAIN.map((_, i) => L + (i + 0.5) * zw);
      const top = (u) => { // smooth thickness between stage centres
        const p = clamp((u - L) / zw - 0.5, 0, CHAIN.length - 1), a = Math.floor(p), b = Math.min(CHAIN.length - 1, a + 1), q = p - a, e = q * q * (3 - 2 * q);
        return lerp(tAt(a), tAt(b), e);
      };
      const grad = ctx.createLinearGradient(L, 0, R, 0);
      grad.addColorStop(0, withAlpha(c.inv, 0.5)); grad.addColorStop(0.38, withAlpha(c.stim, 0.55)); grad.addColorStop(0.7, withAlpha(c.non, 0.6)); grad.addColorStop(1, withAlpha(c.accent, 0.7));
      ctx.fillStyle = grad; ctx.beginPath();
      for (let x = L; x <= R; x += 4) { const t = top(x); x === L ? ctx.moveTo(x, fy - t / 2) : ctx.lineTo(x, fy - t / 2); }
      for (let x = R; x >= L; x -= 4) ctx.lineTo(x, fy + top(x) / 2);
      ctx.closePath(); ctx.fill();
      // particles streaming through the funnel
      const pr = rng(5);
      for (let k = 0; k < 90; k++) {
        const u = (pr() + f.t * (0.12 + 0.1 * pr())) % 1, x = L + u * (R - L), t = top(x), y = fy + (pr() - 0.5) * t * 0.9;
        ctx.fillStyle = c.txt(0.55); ctx.fillRect(x, y, 1.8, 1.8);
      }
      text(f, `${fmt(RAW / 1e6, 0)} Mb/s`, xs[2], fy - maxT / 2 - 5, { size: 10.5, weight: 700, align: 'center', a: 0.9 });
      text(f, `${fmt(EVT / 1e3, 0)} kb/s`, xs[3], fy - tAt(3) / 2 - 5, { size: 10.5, weight: 700, align: 'center', a: 0.9 });
      text(f, 'tens of bits/s', xs[5] - (narrow ? 20 : 0), fy - 9, { size: 10.5, weight: 700, align: 'center', a: 0.9 });
      text(f, 'bits per second at each stage (log scale)', L + 2, fy + maxT / 2 + 14, { size: 10, a: 0.5 });
      text(f, `${CHIP.channels.toLocaleString()} ch × ${CHIP.powerPerChannelUW} µW ≈ ${totalPowerMW().toFixed(1)} mW · NEF ${CHIP.nef}`, R, fy + maxT / 2 + 14, { size: 10, align: 'right', a: 0.6 });
    },
    click(f, x, y) {
      const h = hit.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (h) api.jump(h.beat);
    },
  };
}

// the chain, kept above every figure so you can see which block you are in and jump to another
export function chainStrip(api) {
  let hit = [], hover = -1;
  return {
    cursor: 'pointer',
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 520, active = api.active(), n = CHAIN.length, g = narrow ? 4 : 8, w = (W - g * (n - 1)) / n;
      hit = []; hover = -1;
      if (f.mouse.in) CHAIN.forEach((_, i) => { const x0 = i * (w + g); if (f.mouse.x >= x0 && f.mouse.x <= x0 + w) hover = i; });
      CHAIN.forEach((st, i) => {
        const x0 = i * (w + g), on = st.beat > 0 && st.beat === active, hv = hover === i, col = c[st.col] || c.accent;
        roundRect(ctx, x0 + 0.5, 1.5 + (hv && !on ? -1 : 0), w - 1, H - 3, 9);
        ctx.fillStyle = on ? withAlpha(col, 0.16) : c.paper; ctx.fill();
        ctx.strokeStyle = on || hv ? col : c.txt(0.22); ctx.lineWidth = on ? 2 : hv ? 1.6 : 1; ctx.stroke();
        if (narrow) {
          icon(f, i, x0 + w / 2, H * 0.4, Math.min(w * 0.8, H * 0.6), on || hv);
          text(f, st.n, x0 + w / 2, H - 6, { size: 8.5, weight: on ? 800 : 700, align: 'center', a: on ? 1 : 0.8 });
        } else {
          icon(f, i, x0 + H * 0.5, H / 2, H * 0.62, on || hv);
          text(f, st.n, x0 + H * 0.92, H / 2 - 1, { size: 12, weight: 700, a: on ? 1 : 0.88 });
          text(f, st.s, x0 + H * 0.92, H / 2 + 13, { size: 10, color: withAlpha(col, 1) });
        }
        if (on) { ctx.fillStyle = col; ctx.fillRect(x0 + w * 0.3, H - 3, w * 0.4, 2.5); }
        hit.push({ x: x0, w, beat: st.beat });
      });
    },
    click(f, x) {
      const h = hit.find((b) => x >= b.x && x <= b.x + b.w);
      if (h) api.jump(h.beat);
    },
  };
}

// 5 · move the data to the compute, or the compute to the data
function cimWidget() {
  let mode = 0;
  const MODES = [
    { n: 'DRAM → processor', e: 640 + 0.23, move: 640, tag: '640 pJ to fetch one 32-bit weight', note: 'The weight sits off-chip, so every multiply starts with a long trip.' },
    { n: 'SRAM → processor', e: 5 + 0.23, move: 5, tag: '5 pJ to fetch one 32-bit weight', note: 'On-chip memory is far cheaper, but the data still has to travel to the multiplier.' },
    { n: 'Compute in the memory', e: 0.05, move: 0, tag: '≈ 0.05 pJ per multiply-add', note: 'The weights never move. The inputs go to the memory, and the answer comes out.' },
  ];
  const controls = segmented(MODES.map((m) => m.n), (i) => { mode = i; start = -1; });
  let start = -1;
  const r = rng(21);
  const wts = Array.from({ length: 6 * 8 }, () => 0.25 + 0.75 * r());
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      if (start < 0) start = f.t;
      const t = f.t - start;
      const narrow = W < 560;
      const m = MODES[mode];
      const sw = narrow ? W - 16 : W * 0.6, sh = narrow ? H * 0.58 : H - 16, sx = 8, sy = 8;
      // ── schematic
      roundRect(ctx, sx, sy, sw, sh, 12); ctx.fillStyle = withAlpha(c.stim, c.wc ? 0.05 : 0.04); ctx.fill(); ctx.strokeStyle = c.txt(0.16); ctx.lineWidth = 1; ctx.stroke();
      const memGrid = (x, y, w, h, cols, rows, lit) => {
        roundRect(ctx, x, y, w, h, 7); ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.txt(0.45); ctx.lineWidth = 1.2; ctx.stroke();
        const cw = (w - 12) / cols, ch = (h - 12) / rows;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const cx = x + 6 + i * cw, cy = y + 6 + j * ch, isLit = lit && lit(i, j);
          ctx.fillStyle = isLit ? c.stim : c.txt(0.13); ctx.fillRect(cx + 1.2, cy + 1.2, cw - 2.4, ch - 2.4);
        }
        return { cw, ch };
      };
      if (mode < 2) {
        const dram = mode === 0;
        const mw = sw * (dram ? 0.28 : 0.3), mh = sh * 0.46, aluW = sw * 0.22, aluH = sh * 0.34;
        const gap = dram ? sw * 0.28 : sw * 0.07;
        const total = mw + gap + aluW, x0 = sx + (sw - total) / 2;
        const my = sy + sh * 0.3, mx = x0, ax = x0 + mw + gap, ay = my + (mh - aluH) / 2;
        // the chip boundary: the DRAM sits outside it
        const chipX = dram ? ax - sw * 0.06 : x0 - 12, chipW = dram ? aluW + sw * 0.12 : total + 24;
        roundRect(ctx, chipX, sy + 16, chipW, sh - 32, 12); ctx.setLineDash([5, 4]); ctx.strokeStyle = c.txt(0.3); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        text(f, 'the chip', chipX + 10, sy + 30, { size: 10, a: 0.5 });
        const litRow = Math.floor(t * 1.4) % 5, litCol = Math.floor(t * 2.3 + 2) % 8;
        memGrid(mx, my, mw, mh, 8, 5, (i, j) => (j === litRow && i === litCol));
        text(f, dram ? 'DRAM, off the chip' : 'SRAM, on the chip', mx + mw / 2, my + mh + 16, { size: 11, weight: 700, align: 'center', a: 0.85 });
        // multiplier
        const flash = (t * (dram ? 0.9 : 2.2)) % 1;
        roundRect(ctx, ax, ay, aluW, aluH, 9); ctx.fillStyle = withAlpha(c.non, 0.12 + 0.3 * Math.max(0, 1 - flash * 4)); ctx.fill(); ctx.strokeStyle = c.non; ctx.lineWidth = 1.8; ctx.stroke();
        text(f, '× +', ax + aluW / 2, ay + aluH / 2 + 7, { size: 20, weight: 700, align: 'center', color: c.non });
        text(f, 'multiply-add', ax + aluW / 2, ay + aluH + 16, { size: 11, weight: 700, align: 'center', a: 0.85 });
        text(f, '0.23 pJ for the maths', ax + aluW / 2, ay + aluH + 30, { size: 10, align: 'center', color: c.non });
        // the bus
        const bx0 = mx + mw, bx1 = ax, by = my + mh / 2;
        const hot = dram ? 1 : 0.35;
        ctx.lineCap = 'round';
        ctx.strokeStyle = withAlpha(c.inv, 0.18 * hot + 0.1); ctx.lineWidth = 12 * hot + 4; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(bx1, by); ctx.stroke();
        ctx.strokeStyle = withAlpha(c.inv, 0.8); ctx.lineWidth = 2.4 * hot + 1; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(bx1, by); ctx.stroke();
        // weights in flight: bigger and hotter the more energy the trip costs
        const period = dram ? 1.25 : 0.5, rad = 3 + 2.1 * Math.log10(m.move + 1);
        for (let k = 0; k < (dram ? 3 : 4); k++) {
          const u = (t / period + k / (dram ? 3 : 4)) % 1, x = bx0 + (bx1 - bx0) * u, y = by + Math.sin(u * 14 + k) * (dram ? 2.5 : 1);
          glow(ctx, x, y, rad * 3.2, c.inv, 0.55);
          ctx.fillStyle = c.inv; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
          ctx.fillStyle = c.paper; ctx.beginPath(); ctx.arc(x, y, rad * 0.35, 0, TAU); ctx.fill();
        }
        text(f, m.tag, (bx0 + bx1) / 2, by - rad * 3.2 - 8, { size: 10.5, weight: 700, align: 'center', color: c.inv });
        // the input arrives from above
        ctx.strokeStyle = c.txt(0.5); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax + aluW / 2, sy + 44); ctx.lineTo(ax + aluW / 2, ay); ctx.stroke();
        text(f, 'input', ax + aluW / 2 + 8, sy + 54, { size: 10, a: 0.55 });
      } else {
        // a crossbar: weights stored at the crossings; inputs enter on rows, sums appear on columns
        const rows = 6, cols = 8, gx = sx + sw * 0.16, gy = sy + sh * 0.2, gw = sw * 0.72, gh = sh * 0.46;
        const dx = gw / (cols - 1), dy = gh / (rows - 1);
        const tick = Math.floor(t * 2.2), ph = (t * 2.2) % 1;
        const rr = rng(tick * 7 + 3);
        const act = Array.from({ length: rows }, () => rr() < 0.45);
        const sums = new Array(cols).fill(0);
        for (let j = 0; j < rows; j++) if (act[j]) for (let i = 0; i < cols; i++) sums[i] += wts[j * cols + i];
        text(f, 'weights stay in the memory cells', gx + gw / 2, sy + 20, { size: 11, weight: 700, align: 'center', color: c.stim });
        for (let i = 0; i < cols; i++) { ctx.strokeStyle = c.txt(0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx + i * dx, gy - 10); ctx.lineTo(gx + i * dx, gy + gh + 12); ctx.stroke(); }
        for (let j = 0; j < rows; j++) {
          const y = gy + j * dy;
          ctx.strokeStyle = act[j] ? withAlpha(c.non, 0.9) : c.txt(0.22); ctx.lineWidth = act[j] ? 2 : 1;
          ctx.beginPath(); ctx.moveTo(gx - 26, y); ctx.lineTo(gx + gw + 10, y); ctx.stroke();
          if (act[j]) { const hx = gx - 26 + (gw + 36) * Math.min(1, ph * 1.6); glow(ctx, hx, y, 12, c.non, 0.9); ctx.fillStyle = c.non; ctx.beginPath(); ctx.arc(hx, y, 3.2, 0, TAU); ctx.fill(); }
          for (let i = 0; i < cols; i++) {
            const w = wts[j * cols + i], lit = act[j] && ph * 1.6 > (i * dx + 26) / (gw + 36);
            ctx.fillStyle = lit ? c.stim : withAlpha(c.stim, 0.35 + 0.4 * w);
            ctx.beginPath(); ctx.arc(gx + i * dx, y, 2.5 + 2.4 * w, 0, TAU); ctx.fill();
            if (lit) glow(ctx, gx + i * dx, y, 10, c.stim, 0.5);
          }
        }
        text(f, 'inputs', gx - 28, gy - 14, { size: 10, a: 0.55 });
        // column sums grow as the currents add on each wire
        const by = gy + gh + 22, bh = sh * 0.2, mx = Math.max(1, rows * 0.45 * 0.9);
        for (let i = 0; i < cols; i++) {
          const v = clamp(sums[i] / (mx * 0.9), 0, 1) * Math.min(1, ph * 1.8);
          ctx.fillStyle = c.txt(0.08); ctx.fillRect(gx + i * dx - 8, by, 16, bh);
          ctx.fillStyle = c.non; ctx.globalAlpha = 0.9; ctx.fillRect(gx + i * dx - 8, by + bh * (1 - v), 16, bh * v); ctx.globalAlpha = 1;
        }
        text(f, 'each column wire adds up its cells: 48 multiplies in one step', gx + gw / 2, by + bh + 16, { size: 10.5, weight: 700, align: 'center', color: c.non });
      }
      // ── ledger: energy for 1,000 multiply-adds, log scale
      const lx = narrow ? 8 : sx + sw + 14, ly = narrow ? sy + sh + 12 : 8, lw = narrow ? W - 16 : W - lx - 8, lh = narrow ? H - sh - 28 : H - 16;
      text(f, narrow ? 'energy for 1,000 multiply-adds · log scale' : 'energy for 1,000 multiply-adds', lx, ly + 14, { size: 11, weight: 700, a: 0.9 });
      if (!narrow) text(f, 'log scale · 45 nm', lx, ly + 28, { size: 10, a: 0.5 });
      const lo = Math.log10(0.02), hi = Math.log10(1500);
      const ratio = MODES[mode].e / MODES[2].e;
      const ratioText = mode === 2 ? 'baseline: 0.05 pJ per multiply-add (illustrative)' : `${fmt(ratio, 0)}× the energy of computing in the memory`;
      const nJ = (nj) => (nj >= 100 ? `${fmt(nj, 0)} nJ` : nj >= 1 ? `${fmt(nj, 1)} nJ` : `${fmt(nj, 2)} nJ`);
      if (narrow) {
        // compact ledger: name on the left, bar on the right, number inside or just past the bar
        const nameW = 108, bx = lx + nameW, bwn = lw - nameW - 4, rh = Math.max(15, Math.min(24, (lh - 52) / 3 - 5)), top = ly + 24;
        MODES.forEach((mm, i) => {
          const y = top + i * (rh + 5), on = i === mode;
          const w = clamp((Math.log10(mm.e) - lo) / (hi - lo), 0.02, 1) * bwn;
          text(f, mm.n, lx, y + rh / 2 + 4, { size: 10, weight: on ? 700 : 500, a: on ? 0.95 : 0.55 });
          ctx.fillStyle = c.txt(0.07); ctx.fillRect(bx, y, bwn, rh);
          ctx.fillStyle = i === 2 ? c.non : c.inv; ctx.globalAlpha = on ? 0.95 : 0.4; ctx.fillRect(bx, y, w, rh); ctx.globalAlpha = 1;
          const inside = w > 52;
          text(f, nJ(mm.e), inside ? bx + w - 5 : bx + w + 5, y + rh / 2 + 4, { size: 10, weight: 700, align: inside ? 'right' : 'left', color: inside ? c.onAccent : c.txt(on ? 0.95 : 0.55) });
        });
        text(f, ratioText, lx, top + 3 * (rh + 5) + 8, { size: 10.5, weight: 700, a: 0.92 });
      } else {
        const rowH = Math.min(46, (lh - 90) / 3), top = ly + 44, bw = lw - 4;
        MODES.forEach((mm, i) => {
          const y = top + i * (rowH + 8), nj = mm.e;
          const w = clamp((Math.log10(nj) - lo) / (hi - lo), 0.02, 1) * bw;
          const on = i === mode;
          text(f, mm.n, lx, y + 11, { size: 10.5, weight: on ? 700 : 500, a: on ? 0.95 : 0.55 });
          ctx.fillStyle = c.txt(0.07); ctx.fillRect(lx, y + 17, bw, rowH - 20);
          ctx.fillStyle = i === 2 ? c.non : c.inv; ctx.globalAlpha = on ? 0.95 : 0.4; ctx.fillRect(lx, y + 17, w, rowH - 20); ctx.globalAlpha = 1;
          const lblX = Math.min(lx + w + 6, lx + bw - 54);
          text(f, nJ(nj), lblX, y + rowH - 3 - (rowH - 20) / 2 + 3, { size: 11, weight: 700, color: w > bw - 70 ? c.onAccent : c.txt(on ? 0.95 : 0.55) });
        });
        text(f, ratioText, lx, top + 3 * (rowH + 8) + 8, { size: 11, weight: 700, a: 0.92 });
        text(f, m.note, lx, top + 3 * (rowH + 8) + 28, { size: 10, a: 0.6 });
      }
    },
  };
}

// 6 · adiabatic charging
function adiabaticWidget() {
  let n = 4;
  const controls = document.createElement('div');
  controls.append(slider('Charging steps (N)', 1, 16, 1, n, (v) => `N = ${v}`, (v) => (n = v)).el);
  let heat = 0, lastU = 0;
  return {
    controls,
    draw(f, dt) {
      const { ctx, W, H, c } = f;
      const narrow = W < 520;
      // the period of one charge + discharge cycle is 4 s
      const u = (f.t * 0.25) % 1;
      const steps = (q) => (q < 0.5 ? Math.min(n, Math.floor(q * 2 * n) + 1) / n : Math.max(0, Math.ceil((2 - q * 2) * n) - 1) / n);
      const stepStart = (q) => (q < 0.5 ? Math.floor(q * 2 * n) / (2 * n) : 0.5 + Math.floor((q - 0.5) * 2 * n) / (2 * n));
      const tau = 0.5 / n / 5 * (n === 1 ? 1.5 : 1);
      const vc = (q) => { const s = steps(q), t0 = stepStart(q), prev = q < 0.5 ? Math.max(0, s - 1 / n) : Math.min(1, s + 1 / n); return s + (prev - s) * Math.exp(-(q - t0) / tau); };
      const cur = (q) => steps(q) - vc(q);                       // charging current (negative: charge flowing back)
      // heat in the resistor, accumulated over the cycle (I²R, arbitrary units)
      if (u < lastU) heat = 0;
      heat += cur(u) ** 2 * (u - lastU > 0 ? (u - lastU) : 0) * 140;
      lastU = u;
      // ── top: the circuit
      const cy = 46, x0 = 18, x1 = W - 18;
      const supX = x0 + 26, resX = x0 + (x1 - x0) * 0.42, capX = x1 - 40;
      ctx.strokeStyle = c.txt(0.5); ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // wire loop
      ctx.beginPath(); ctx.moveTo(supX, cy - 18); ctx.lineTo(supX, cy - 28); ctx.lineTo(capX, cy - 28); ctx.lineTo(capX, cy - 12); ctx.moveTo(capX, cy + 12); ctx.lineTo(capX, cy + 28); ctx.lineTo(supX, cy + 28); ctx.lineTo(supX, cy + 18); ctx.stroke();
      // supply: a little staircase generator
      roundRect(ctx, supX - 22, cy - 18, 44, 36, 7); ctx.fillStyle = c.paper; ctx.fill(); ctx.strokeStyle = c.txt(0.5); ctx.stroke();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let k = 0; k <= 12; k++) { const q = k / 12, x = supX - 16 + q * 32; const v = steps(Math.min(0.999, q)); k ? ctx.lineTo(x, cy + 10 - v * 20) : ctx.moveTo(x, cy + 10 - v * 20); }
      ctx.stroke();
      // resistor: it glows as heat is produced
      const hi = Math.min(1, Math.abs(cur(u)) * 2.2);
      glow(ctx, resX, cy - 28, 26, c.inv, hi * 0.95);
      ctx.strokeStyle = c.txt(0.8); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(resX - 24, cy - 28);
      for (let k = 0; k < 6; k++) ctx.lineTo(resX - 24 + (k + 0.5) * 8, cy - 28 + (k % 2 ? 6 : -6));
      ctx.lineTo(resX + 24, cy - 28); ctx.stroke();
      text(f, 'switch resistance', resX, cy - 42, { size: 9.5, align: 'center', a: 0.55 });
      if (hi > 0.25) text(f, 'heat', resX, cy - 12, { size: 10, weight: 700, align: 'center', color: c.inv });
      // capacitor, filled to the level of vc
      const v = clamp(vc(u), 0, 1);
      ctx.strokeStyle = c.txt(0.8); ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(capX - 14, cy - 12); ctx.lineTo(capX + 14, cy - 12); ctx.moveTo(capX - 14, cy + 12); ctx.lineTo(capX + 14, cy + 12); ctx.stroke();
      ctx.fillStyle = withAlpha(c.non, 0.18 + 0.6 * v); ctx.fillRect(capX - 12, cy - 10, 24, 20);
      text(f, `${fmt(v, 2)} V`, capX, cy + 4, { size: 10.5, weight: 700, align: 'center', color: v > 0.5 ? c.onAccent : c.txt(0.9) });
      text(f, 'load capacitor', capX, cy + 46, { size: 9.5, align: 'center', a: 0.55 });
      // charge moving round the loop: accent going in, green coming back (recycled)
      const loopLen = (capX - supX) * 2 + 56 + 24, ci = cur(u), flowDir = Math.sign(ci);
      const nd = Math.round(clamp(Math.abs(ci) * 26, 0, 14));
      for (let k = 0; k < nd; k++) {
        let s = ((f.t * 0.4 * (flowDir || 1) + k / Math.max(1, nd)) % 1 + 1) % 1;
        let px, py; const d = s * loopLen;
        const a1 = capX - supX;
        if (d < a1) { px = supX + d; py = cy - 28; } else if (d < a1 + 56) { px = capX; py = cy - 28 + (d - a1); } else if (d < 2 * a1 + 56) { px = capX - (d - a1 - 56); py = cy + 28; } else { px = supX; py = cy + 28 - (d - 2 * a1 - 56); }
        ctx.fillStyle = flowDir > 0 ? c.accent : c.non; ctx.beginPath(); ctx.arc(px, py, 3, 0, TAU); ctx.fill();
      }
      if (flowDir < 0 && Math.abs(ci) > 0.02) text(f, 'charge returns to the supply: recycled', (supX + capX) / 2, cy + 4, { size: 10.5, weight: 700, align: 'center', color: c.non });
      // ── bottom left: the staircase and the capacitor voltage
      const pw = narrow ? W - 20 : W * 0.62;
      const L = 30, R = pw - 6, T = 112, B = H - 54;
      const y = (q) => B - q * (B - T);
      text(f, 'volts across the capacitor, over one cycle', L, T - 8, { size: 10, a: 0.55 });
      ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y(0)); ctx.lineTo(R, y(0)); ctx.moveTo(L, y(1)); ctx.lineTo(R, y(1)); ctx.stroke();
      text(f, 'V', L - 6, y(1) + 4, { size: 10, align: 'right', a: 0.5 });
      ctx.strokeStyle = c.txt(0.4); ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]); ctx.beginPath();
      for (let i = 0; i <= 400; i++) { const q = Math.min(0.9999, i / 400), x = L + (i / 400) * (R - L); i ? ctx.lineTo(x, y(steps(q))) : ctx.moveTo(x, y(steps(q))); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2.6; ctx.beginPath();
      for (let i = 0; i <= 400; i++) { const q = Math.min(0.9999, i / 400), x = L + (i / 400) * (R - L); i ? ctx.lineTo(x, y(vc(q))) : ctx.moveTo(x, y(vc(q))); }
      ctx.stroke();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(L + u * (R - L), y(vc(Math.min(0.9999, u))), 5, 0, TAU); ctx.fill();
      text(f, '┄ supply staircase   — capacitor voltage', L, H - 36, { size: 10, a: 0.6 });
      text(f, 'charge up', L + (R - L) * 0.25, B + 13, { size: 10, align: 'center', a: 0.45 });
      text(f, 'discharge: the charge goes back', L + (R - L) * 0.75, B + 13, { size: 10, align: 'center', a: 0.45 });
      // ── bottom right: where the energy goes (per charge)
      if (!narrow) {
        const bx = pw + 16, bw = (W - bx - 14) / 2 - 8, bh = B - T - 10;
        text(f, 'per charge', bx, T - 8, { size: 10, a: 0.55 });
        const bar = (x, rel, color, label, val) => {
          ctx.fillStyle = c.txt(0.07); ctx.fillRect(x, T, bw, bh);
          ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.fillRect(x, T + bh * (1 - rel), bw, bh * rel); ctx.globalAlpha = 1;
          text(f, label, x + bw / 2, B + 13, { size: 10, align: 'center', a: 0.7 });
          text(f, val, x + bw / 2, Math.max(T + 12, T + bh * (1 - rel) - 5), { size: 10.5, weight: 700, align: 'center', color: rel > 0.9 ? c.onAccent : c.txt(0.9) });
        };
        bar(bx, 1, c.non, 'stored', '½CV²');
        bar(bx + bw + 16, 1 / n, c.inv, 'heat', n === 1 ? '½CV²' : `½CV²/${n}`);
      }
      text(f, n === 1 ? 'conventional: half the energy drawn becomes heat' : `N = ${n} steps: the heat per cycle falls ${n}-fold`, W / 2, H - 8, { size: 13, weight: 700, align: 'center', a: 0.92 });
    },
  };
}

// 7 · the radio: power in and data out over one pair of coils (cyclic on-off keying)
function radioWidget() {
  const FC = 13.56;                       // MHz carrier
  const sym = [2, 0, 3, 1, 2, 0];         // which of the four cycles in each symbol is shorted = two bits
  let Q = 25, lay = null;
  const controls = document.createElement('div');
  controls.append(slider('Coil quality factor (Q)', 5, 80, 1, Q, (v) => `Q = ${v}`, (v) => (Q = v)).el);
  return {
    controls,
    cursor: 'pointer',
    click(f, x, y) {
      if (!lay || y < lay.top || y > lay.bot) return;
      const k = Math.floor((x - lay.x0) / lay.cell);
      if (k >= 0 && k < lay.n) sym[k] = (sym[k] + 1) % 4;
    },
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 520, n = narrow ? 4 : 6;
      const x0 = narrow ? 12 : 18, x1 = W - x0, cell = (x1 - x0) / n, cw = cell / 4;
      // ── the link: external coil (power) and the implant coil (data)
      const ay = 34, lx = x0 + 34, rx = x1 - 34;
      const coil = (cx, col, label) => {
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(cx + k * 5, ay, 9, 17, 0, 0, TAU); ctx.stroke(); }
        text(f, label, cx + 5, ay + 34, { size: 10, align: 'center', a: 0.65 });
      };
      coil(lx - 5, c.stim, 'outside the body'); coil(rx - 5, c.inv, 'implant');
      // power flowing right, data flowing left
      for (let k = 0; k < 6; k++) {
        const u = ((f.t * 0.5 + k / 6) % 1), x = lx + 30 + u * (rx - lx - 70);
        ctx.fillStyle = withAlpha(c.stim, 0.9 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(x, ay - 7, 2.6, 0, TAU); ctx.fill();
        const x2 = rx - 30 - ((f.t * 0.5 + k / 6 + 0.5) % 1) * (rx - lx - 70);
        const u2 = (rx - 30 - x2) / (rx - lx - 70);
        ctx.fillStyle = withAlpha(c.inv, 0.9 * Math.sin(u2 * Math.PI)); ctx.fillRect(x2 - 2.5, ay + 5, 5, 5);
      }
      text(f, 'power in  →', (lx + rx) / 2, ay - 14, { size: 10.5, weight: 700, align: 'center', color: c.stim });
      text(f, '←  data out', (lx + rx) / 2, ay + 22, { size: 10.5, weight: 700, align: 'center', color: c.inv });
      // ── the implant coil voltage: three of the four cycles of every symbol ring, one is shorted to a flat line
      const laneTop = narrow ? 96 : 108, below = narrow ? 134 : 146;
      const laneH = clamp(H - laneTop - below, 62, 128), top = laneTop, bot = laneTop + laneH, mid = (top + bot) / 2, amp = laneH * 0.3;
      lay = { x0, cell, n, top, bot: bot + 26 };
      text(f, narrow ? 'coil voltage · 4 cycles = 2 bits · tap a symbol' : 'implant coil voltage · 4 carrier cycles = 1 symbol = 2 bits  (click a symbol)', x0, top - 10, { size: 10, a: 0.6 });
      const hov = f.mouse.in && f.mouse.y >= top && f.mouse.y <= bot + 26 ? Math.floor((f.mouse.x - x0) / cell) : -1;
      const now = Math.floor((f.t * 0.7) % n);
      for (let s = 0; s < n; s++) {
        const sx = x0 + s * cell, v = sym[s];
        roundRect(ctx, sx + 2, top, cell - 4, laneH + 26, 9);
        ctx.fillStyle = s === now ? withAlpha(c.accent, 0.07) : c.paper; ctx.fill();
        ctx.strokeStyle = s === hov ? c.accent : c.txt(s === now ? 0.4 : 0.18); ctx.lineWidth = s === hov ? 1.8 : 1; ctx.stroke();
        // the shorted cycle
        ctx.fillStyle = withAlpha(c.accent, 0.16); ctx.fillRect(sx + v * cw + 1, top + 5, cw - 2, laneH - 10);
        text(f, 'short', sx + v * cw + cw / 2, top + 15, { size: 8.5, weight: 700, align: 'center', color: c.accent });
        // the two bits this symbol carries
        text(f, v.toString(2).padStart(2, '0'), sx + cell / 2, bot + 19, { size: narrow ? 14 : 16, weight: 800, align: 'center', color: c.accent });
      }
      ctx.strokeStyle = c.txt(0.16); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
      ctx.strokeStyle = c.inv; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath();
      const tot = n * 4, steps = Math.round((x1 - x0) / 1.5);
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (i / steps) * (x1 - x0), cyc = (i / steps) * tot, k = Math.min(tot - 1, Math.floor(cyc));
        const shorted = sym[Math.floor(k / 4)] === k % 4;
        const y = mid - (shorted ? 0 : Math.sin((cyc - f.t * 0.6) * TAU) * amp);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // ── the numbers: COOK against load-shift keying as the coil Q changes (illustrative)
      const by = bot + 26 + 24, bw = W - x0 * 2 - (narrow ? 74 : 150), lsk = Math.min(FC / 2, FC / (Q * 0.8));
      const row = (y, label, val, col, txtv) => {
        text(f, label, x0, y - 4, { size: 10.5, weight: 600, a: 0.8 });
        ctx.fillStyle = c.txt(0.07); ctx.fillRect(x0, y, bw, 11);
        ctx.fillStyle = col; ctx.fillRect(x0, y, Math.max(2, bw * val), 11);
        text(f, txtv, x0 + bw + 10, y + 10, { size: 11, weight: 700, color: col });
      };
      row(by, 'Cyclic on-off keying (any Q)', 1, c.accent, `${fmt(FC / 2, 2)} Mb/s`);
      row(by + 32, 'Load-shift keying at this Q', lsk / (FC / 2), c.inv, `~${fmt(lsk, 2)} Mb/s`);
      text(f, 'power flows in 3 of every 4 cycles', x0, by + 60, { size: 10.5, weight: 700, color: c.stim });
      text(f, 'a high Q moves power well, and caps the load-shift rate', x0, by + 76, { size: 10.5, a: 0.7 });
    },
  };
}

export const WIDGETS = { chain: chainWidget, signal: signalWidget, nef: nefWidget, adc: adcWidget, events: eventsWidget, cim: cimWidget, adiabatic: adiabaticWidget, radio: radioWidget };
export const CAPTIONS = {
  chain: 'The signal changes shape at every block. Pulses are analog until the ADC, then bits, then events. Rates are illustrative: 30 kS/s, 10 bits, 10 spikes/s per channel, 16 bits per event.',
  signal: 'Simulated spikes in noise. Thresholding is how most chips find a neuron.',
  nef: 'Noise ∝ NEF/√power. Curves are drawn from the NEF definition, not measured data.',
  adc: 'A single spike sampled at 30 kHz and quantised to the chosen resolution.',
  events: 'A cartoon of 64 neurons: bright squares are spikes, dim ones are idle work.',
  cim: 'Schematic. DRAM, SRAM and arithmetic energies are the published 45 nm figures (Horowitz, ISSCC 2014); the in-memory figure is illustrative.',
  adiabatic: 'Idealised: a staircase supply charging a capacitor through a switch.',
  radio: 'Simplified from the published scheme: two bits per four carrier cycles on a 13.56 MHz link. The load-shift curve is illustrative (rate ≈ carrier / 0.8Q), not a measurement.',
};
