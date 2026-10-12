// Interactive drawings for the sensor-design page, one per beat. Each returns { controls?, draw(f, dt), click?, drag?, cursor? }.
import { TAU, clamp, lerp, fmt, rng, gauss, slider, segmented, text, roundRect, glow, withAlpha } from './fig.js';

const spikeShape = (tt) => (tt < 0 || tt > 1 ? 0 : -Math.exp(-(((tt - 0.25) / 0.09) ** 2)) + 0.35 * Math.exp(-(((tt - 0.55) / 0.18) ** 2)));
const noiseTable = (() => { const r = rng(5); return Float32Array.from({ length: 4096 }, () => gauss(r)); })();

// 0 · where the signal is born: a neuron, the field around it, and an electrode you can move
function fieldWidget() {
  let pos = null; // in micrometres relative to the soma
  const PER = 1.8;
  const A0 = 130, R0 = 40, SIGMA = 12;
  const geom = (f) => {
    const narrow = f.W < 520;
    const fw = narrow ? f.W - 16 : f.W * 0.58, fh = narrow ? f.H * 0.6 : f.H - 16;
    const s = fh / 560; // px per µm
    return { narrow, fx: 8, fy: 8, fw, fh, s, cx: 8 + fw * 0.45, cy: 8 + fh * 0.58 };
  };
  return {
    cursor: 'crosshair',
    drag(f, x, y) { const g = geom(f); pos = { x: clamp((x - g.cx) / g.s, -g.fw * 0.45 / g.s, g.fw * 0.5 / g.s), y: clamp((y - g.cy) / g.s, -g.fh * 0.55 / g.s, g.fh * 0.4 / g.s) }; },
    draw(f) {
      const { ctx, W, H, c } = f;
      const g = geom(f), { fx, fy, fw, fh, s, cx, cy, narrow } = g;
      if (!pos) pos = { x: 70, y: -15 };
      const ph = (f.t % PER) / PER, tt = ph / 0.2, sp = ph < 0.2 ? -spikeShape(tt) : 0, inten = Math.max(0, sp);
      // panel
      roundRect(ctx, fx, fy, fw, fh, 12); ctx.fillStyle = withAlpha(c.inv, c.wc ? 0.04 : 0.05); ctx.fill(); ctx.strokeStyle = c.txt(0.16); ctx.lineWidth = 1; ctx.stroke();
      ctx.save(); roundRect(ctx, fx, fy, fw, fh, 12); ctx.clip();
      // the field: isopotential rings around the soma, brighter during a spike
      for (const lv of [0.8, 0.5, 0.3, 0.16, 0.08]) {
        const r = R0 * Math.sqrt(1 / lv - 1) * s;
        glow(ctx, cx, cy, r * 1.25, c.inv, 0.07 + 0.26 * inten * lv);
        ctx.strokeStyle = withAlpha(c.inv, 0.14 + 0.5 * inten); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // the neuron: dendrites above and below, an axon, and the soma (current sink)
      ctx.strokeStyle = c.txt(0.62); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      const br = (x0, y0, dx, dy, len, depth) => {
        const x1 = x0 + dx * len * s, y1 = y0 + dy * len * s;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (depth > 0) { br(x1, y1, dx * 0.82 - dy * 0.55, dy * 0.82 + dx * 0.55, len * 0.62, depth - 1); br(x1, y1, dx * 0.82 + dy * 0.55, dy * 0.82 - dx * 0.55, len * 0.62, depth - 1); }
      };
      br(cx, cy - 8 * s, 0, -1, 140, 2);
      br(cx, cy + 8 * s, -0.5, 0.86, 62, 1); br(cx, cy + 8 * s, 0.5, 0.86, 62, 1);
      ctx.beginPath(); ctx.moveTo(cx + 8 * s, cy + 4 * s); ctx.lineTo(cx + 40 * s, cy + 110 * s); ctx.stroke();
      glow(ctx, cx, cy, 30 * s * (0.8 + inten), c.inv, 0.5 * inten);
      ctx.fillStyle = inten > 0.2 ? c.inv : c.txt(0.8); ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, TAU); ctx.fill();
      // return current flows up the dendrite during the spike
      if (inten > 0.2) { ctx.strokeStyle = withAlpha(c.non, 0.9); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 3, cy - 12 * s); ctx.lineTo(cx + 3, cy - 120 * s); ctx.stroke(); }
      text(f, 'soma: current flows in', cx + 14 * s, cy + 22 * s, { size: 10, a: 0.7, color: c.inv });
      if (!narrow) text(f, 'return current out along the dendrite', cx + 12 * s, cy - 90 * s, { size: 10, color: c.non });
      // the electrode
      const ex = cx + pos.x * s, ey = cy + pos.y * s;
      ctx.strokeStyle = c.txt(0.85); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex, fy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill();
      glow(ctx, ex, ey, 16, c.accent, 0.5);
      // the distance
      ctx.strokeStyle = c.accent; ctx.setLineDash([2, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      const d = Math.hypot(pos.x, pos.y);
      text(f, `${fmt(d, 0)} µm`, (cx + ex) / 2 + 6, (cy + ey) / 2 - 6, { size: 11, weight: 700, color: c.accent });
      // scale bar
      ctx.strokeStyle = c.txt(0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + 14, fy + fh - 16); ctx.lineTo(fx + 14 + 100 * s, fy + fh - 16); ctx.stroke();
      text(f, '100 µm', fx + 14, fy + fh - 22, { size: 10, a: 0.6 });
      text(f, 'drag the electrode', fx + fw - 10, fy + 18, { size: 10, align: 'right', a: 0.55 });
      ctx.restore();
      // ── the recording
      const rx = narrow ? 8 : fx + fw + 14, ry = narrow ? fy + fh + 10 : 8, rw = narrow ? W - 16 : W - rx - 8, rh = narrow ? H - fh - 26 : H - 16;
      const A = A0 / (1 + (d / R0) ** 2);
      const L = rx + 36, R = rx + rw - 6, T = ry + 26, B = ry + rh - 34, mid = (T + B) / 2;
      const yv = (v) => mid - (clamp(v, -170, 170) / 170) * (B - T) / 2;
      text(f, 'what this electrode records', rx, ry + 14, { size: 11, weight: 700, a: 0.9 });
      ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1;
      for (const v of [-100, 0, 100]) { ctx.beginPath(); ctx.moveTo(L, yv(v)); ctx.lineTo(R, yv(v)); ctx.stroke(); text(f, `${v}`, L - 5, yv(v) + 3, { size: 9.5, align: 'right', a: 0.45 }); }
      text(f, 'µV', L - 5, T - 6, { size: 9.5, align: 'right', a: 0.45 });
      const thr = -4 * SIGMA;
      ctx.strokeStyle = c.accent; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(L, yv(thr)); ctx.lineTo(R, yv(thr)); ctx.stroke(); ctx.setLineDash([]);
      text(f, 'detection line', R, yv(thr) - 4, { size: 9.5, align: 'right', color: c.accent });
      ctx.strokeStyle = c.txt(0.88); ctx.lineWidth = 1.3; ctx.beginPath();
      const WIN = 3.2 * PER, n = Math.floor(R - L);
      for (let i = 0; i <= n; i += 1) {
        const tau = f.t - WIN + (i / n) * WIN, pp = ((tau % PER) + PER) % PER / PER;
        const y = yv(A * spikeShape(pp / 0.2) + SIGMA * noiseTable[(Math.floor(tau * 700) % 4096 + 4096) % 4096]);
        i ? ctx.lineTo(L + i, y) : ctx.moveTo(L + i, y);
      }
      ctx.stroke();
      const ok = A * 1.0 > -thr * 0.98;
      text(f, `spike amplitude ≈ ${fmt(A, 0)} µV`, rx, ry + rh - 18, { size: 11.5, weight: 700, a: 0.92 });
      text(f, ok ? 'detected: clearly above the noise' : 'lost in the noise: too far away', rx, ry + rh - 3, { size: 11, weight: 700, color: ok ? c.non : c.inv });
    },
  };
}

// 1 · the metal–saline interface: impedance and what survives into the amplifier
function interfaceWidget() {
  let mat = 0, diam = 30;
  const MATS = [
    { n: 'Platinum', cdl: 2e-5, col: 'inv' },       // F/cm², smooth metal
    { n: 'TiN (porous)', cdl: 1.5e-3, col: 'stim' },
    { n: 'PEDOT:PSS', cdl: 8e-3, col: 'non' },
  ];
  const CIN = 5e-12, RHO = 0.7;
  const area = (d) => Math.PI * (d * 1e-4 / 2) ** 2; // cm²
  const Z = (m, d, fq) => {
    const C = MATS[m].cdl * area(d), Rs = RHO / (4 * (d * 1e-6 / 2));
    const w = TAU * fq, re = Rs, im = -1 / (w * C);
    return { mag: Math.hypot(re, im), C, Rs };
  };
  const controls = document.createElement('div');
  controls.append(segmented(MATS.map((m) => m.n), (i) => { mat = i; }));
  controls.append(slider('Electrode diameter', 0, 1, 0.005, 0.38, (v) => `${fmt(5 * 40 ** v, 0)} µm`, (v) => { diam = 5 * 40 ** v; }).el);
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 520;
      const pw = narrow ? W : W * 0.66, L = 52, R = pw - 14, T = 24, B = H - 70;
      const lx = (fq) => L + (Math.log10(fq) / 5) * (R - L);          // 1 Hz … 100 kHz
      const ly = (z) => B - ((Math.log10(z) - 3) / 6) * (B - T);       // 1 kΩ … 1 GΩ
      // spike band
      ctx.fillStyle = withAlpha(c.accent, 0.1); ctx.fillRect(lx(300), T, lx(5000) - lx(300), B - T);
      text(f, 'spike band', (lx(300) + lx(5000)) / 2, T + 12, { size: 10, align: 'center', color: c.accent });
      ctx.strokeStyle = c.txt(0.09); ctx.lineWidth = 1;
      for (const fq of [1, 10, 100, 1e3, 1e4, 1e5]) { ctx.beginPath(); ctx.moveTo(lx(fq), T); ctx.lineTo(lx(fq), B); ctx.stroke(); text(f, fq >= 1e3 ? `${fq / 1e3}k` : `${fq}`, lx(fq), B + 13, { size: 9.5, align: 'center', a: 0.5 }); }
      for (const z of [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9]) { ctx.beginPath(); ctx.moveTo(L, ly(z)); ctx.lineTo(R, ly(z)); ctx.stroke(); const lab = z >= 1e6 ? `${z / 1e6} MΩ` : `${z / 1e3} kΩ`; if ([1e3, 1e5, 1e7, 1e9].includes(z)) text(f, lab.replace('1000 MΩ', '1 GΩ'), L - 5, ly(z) + 3, { size: 9.5, align: 'right', a: 0.5 }); }
      text(f, 'frequency (Hz)', (L + R) / 2, B + 28, { size: 10, align: 'center', a: 0.55 });
      text(f, 'electrode impedance |Z|', 6, 14, { size: 10, a: 0.55 });
      const curve = (m, color, w, a) => {
        ctx.strokeStyle = withAlpha(color, a); ctx.lineWidth = w; ctx.beginPath();
        for (let i = 0; i <= 90; i++) { const fq = 10 ** (i / 90 * 5); const z = clamp(Z(m, diam, fq).mag, 1e3, 1e9); i ? ctx.lineTo(lx(fq), ly(z)) : ctx.moveTo(lx(fq), ly(z)); }
        ctx.stroke();
      };
      MATS.forEach((m, i) => { if (i !== mat) curve(i, c[m.col], 1.4, 0.35); });
      curve(mat, c[MATS[mat].col], 3, 1);
      const z1k = Z(mat, diam, 1000);
      ctx.strokeStyle = c.txt(0.5); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(lx(1000), T); ctx.lineTo(lx(1000), B); ctx.stroke(); ctx.setLineDash([]);
      const zy = ly(clamp(z1k.mag, 1e3, 1e9));
      ctx.fillStyle = c[MATS[mat].col]; ctx.beginPath(); ctx.arc(lx(1000), zy, 5.5, 0, TAU); ctx.fill();
      const zl = z1k.mag >= 1e6 ? `${fmt(z1k.mag / 1e6, 1)} MΩ` : `${fmt(z1k.mag / 1e3, 0)} kΩ`;
      text(f, `${zl} at 1 kHz`, lx(1000) + 9, zy - 8, { size: 11.5, weight: 700, a: 0.95 });
      // the divider into an amplifier
      const att = z1k.C / (z1k.C + CIN);
      const gx = narrow ? 10 : pw + 14, gy = narrow ? H - 62 : 24, gw = narrow ? W - 20 : W - gx - 10;
      if (!narrow) {
        text(f, 'signal that reaches the amplifier', gx, gy + 6, { size: 11, weight: 700, a: 0.9 });
        text(f, '(a 5 pF input, at 1 kHz)', gx, gy + 20, { size: 10, a: 0.5 });
        const bh = H - 24 - (gy + 40) - 70, by = gy + 34;
        ctx.fillStyle = c.txt(0.07); ctx.fillRect(gx, by, 34, bh);
        ctx.fillStyle = att > 0.8 ? c.non : att > 0.5 ? c.stim : c.inv; ctx.globalAlpha = 0.92; ctx.fillRect(gx, by + bh * (1 - att), 34, bh * att); ctx.globalAlpha = 1;
        text(f, `${fmt(att * 100, 0)}%`, gx + 44, by + bh * (1 - att) + 14, { size: 20, weight: 700, a: 0.95 });
        text(f, att > 0.8 ? 'nearly all of it' : att > 0.5 ? 'a good share is lost' : 'most of it is lost', gx + 44, by + bh * (1 - att) + 30, { size: 10.5, a: 0.65 });
        // a tiny schematic: electrode capacitance in series with the amplifier input
        ctx.strokeStyle = c.txt(0.6); ctx.lineWidth = 1.4;
        const sy = by + bh + 22; ctx.beginPath(); ctx.moveTo(gx, sy); ctx.lineTo(gx + 20, sy); ctx.moveTo(gx + 20, sy - 8); ctx.lineTo(gx + 20, sy + 8); ctx.moveTo(gx + 26, sy - 8); ctx.lineTo(gx + 26, sy + 8); ctx.moveTo(gx + 26, sy); ctx.lineTo(gx + 56, sy); ctx.lineTo(gx + 56, sy + 18); ctx.moveTo(gx + 46, sy + 18); ctx.lineTo(gx + 66, sy + 18); ctx.stroke();
        text(f, 'electrode C', gx, sy - 12, { size: 9.5, a: 0.55 }); text(f, 'amp input', gx + 70, sy + 22, { size: 9.5, a: 0.55 });
      } else {
        text(f, `signal reaching the amplifier: ${fmt(att * 100, 0)}% (5 pF input)`, gx, gy + 12, { size: 11, weight: 700, color: att > 0.8 ? c.non : att > 0.5 ? c.stim : c.inv });
      }
    },
  };
}

// 2 · size sets what you see
function sizeWidget() {
  const DEV = [
    { n: 'Neuropixels site', d: 12, mode: 'pen', spk: 95, slow: 12, what: 'one neuron, spike by spike' },
    { n: 'Utah array tip', d: 50, mode: 'pen', spk: 105, slow: 45, what: 'a few neurons plus the local field' },
    { n: 'µECoG contact', d: 200, mode: 'sur', spk: 10, slow: 85, what: 'thousands of neurons, mostly slow waves' },
    { n: 'ECoG contact', d: 2300, mode: 'sur', spk: 0, slow: 130, what: 'hundreds of thousands of neurons averaged' },
    { n: 'EEG electrode', d: 10000, mode: 'sur', spk: 0, slow: 28, what: 'millions of neurons, through the skull' },
  ];
  let sel = 1;
  const controls = segmented(DEV.map((d) => d.n.replace(' electrode', '').replace(' contact', '').replace(' array tip', ' tip').replace(' site', '')), (i) => { sel = i; }, sel);
  const nNeurons = (d) => (d.mode === 'pen' ? null : 5e4 * (Math.PI * ((d.d / 1000) / 2) ** 2) * 2); // neurons under a surface contact: 50,000/mm³ × 2 mm of cortex
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 520;
      const d = DEV[sel];
      // ── top: a log ruler with the five devices, drawn as circles whose area is to scale
      const rh = narrow ? 92 : 112, L = 22, R = W - 22, mid = rh * 0.52;
      const x = (dd) => L + ((Math.log10(dd) - Math.log10(8)) / (Math.log10(14000) - Math.log10(8))) * (R - L);
      ctx.strokeStyle = c.txt(0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, rh - 16); ctx.lineTo(R, rh - 16); ctx.stroke();
      for (const t of [10, 100, 1000, 10000]) { ctx.beginPath(); ctx.moveTo(x(t), rh - 20); ctx.lineTo(x(t), rh - 12); ctx.stroke(); text(f, t >= 1000 ? `${t / 1000} mm` : `${t} µm`, x(t), rh - 2, { size: 9.5, align: 'center', a: 0.5 }); }
      DEV.forEach((dv, i) => {
        const r = Math.max(2.5, Math.min(rh * 0.34, Math.sqrt(dv.d) * 0.18 * (narrow ? 0.7 : 1) + 2));
        const on = i === sel;
        ctx.fillStyle = on ? c.accent : withAlpha(c.accent, 0.3); ctx.beginPath(); ctx.arc(x(dv.d), mid - 6, r, 0, TAU); ctx.fill();
        if (on) { glow(ctx, x(dv.d), mid - 6, r * 2.6, c.accent, 0.35); text(f, dv.d >= 1000 ? `${fmt(dv.d / 1000, 1)} mm` : `${dv.d} µm`, x(dv.d), 14, { size: 11, weight: 700, align: 'center', color: c.accent }); }
      });
      // ── the simulated recording
      const T = rh + 12, B = H - 66, L2 = 44, R2 = W - 12, midY = (T + B) / 2;
      const yv = (v) => midY - (clamp(v, -170, 170) / 170) * (B - T) / 2;
      ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1;
      for (const v of [-100, 0, 100]) { ctx.beginPath(); ctx.moveTo(L2, yv(v)); ctx.lineTo(R2, yv(v)); ctx.stroke(); text(f, `${v}`, L2 - 6, yv(v) + 3, { size: 9.5, align: 'right', a: 0.45 }); }
      text(f, 'µV', L2 - 6, T - 3, { size: 9.5, align: 'right', a: 0.45 });
      const WIN = 2.4, n = Math.floor(R2 - L2);
      ctx.strokeStyle = c.txt(0.9); ctx.lineWidth = 1.3; ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const tau = f.t - WIN + (i / n) * WIN;
        // sparse spikes at fixed times, plus a slow rhythm
        let v = d.slow * (0.6 * Math.sin(TAU * 1.7 * tau) + 0.4 * Math.sin(TAU * 0.6 * tau + 1));
        const k = ((tau * 5) % 1 + 1) % 1; const sk = Math.floor(tau * 5);
        if (d.spk > 0 && noiseTable[(sk * 13) & 4095] > 0.1) v += d.spk * spikeShape(k / 0.12);
        v += 6 * noiseTable[(Math.floor(tau * 900) % 4096 + 4096) % 4096];
        const y = yv(v);
        i ? ctx.lineTo(L2 + i, y) : ctx.moveTo(L2 + i, y);
      }
      ctx.stroke();
      const N = nNeurons(d);
      const ns = N === null ? (d.d <= 12 ? '1' : '1 to 3 isolated, many more nearby') : N >= 1e6 ? `≈ ${fmt(N / 1e6, 0)} million` : `≈ ${fmt(N / 1e3, 0)} thousand`;
      text(f, `neurons contributing: ${ns}`, 10, H - 46, { size: 12, weight: 700, a: 0.92 });
      text(f, `it hears ${d.what}`, 10, H - 28, { size: 11.5, a: 0.7 });
      text(f, 'amplitudes are typical orders of magnitude, drawn schematically', 10, H - 10, { size: 10, a: 0.45 });
    },
  };
}

// 3 · five ways in, from the outside to the cortex
function formsWidget() {
  const DEV = [
    { n: 'EEG', full: 'EEG cap electrode', ch: '32 to 256 contacts', gap: 'about 1 to 2 cm of scalp, skull and fluid', hears: 'the summed activity of millions of neurons, smeared by the skull', sig: 0.12, inv: 0.02, mine: true },
    { n: 'ECoG', full: 'ECoG grid (subdural)', ch: '16 to 256 contacts, 1 to 10 mm apart', gap: 'on the cortical surface, under the dura', hears: 'local field potentials from a few millimetres of cortex', sig: 0.5, inv: 0.5, mine: false },
    { n: 'sEEG', full: 'sEEG depth lead', ch: '8 to 18 contacts per lead, about 3.5 mm apart', gap: 'inside the cortex and deeper', hears: 'local fields from deep structures a surface grid cannot reach', sig: 0.6, inv: 0.62, mine: false },
    { n: 'Utah', full: 'Utah array (intracortical)', ch: '96 recording channels, 400 µm pitch, 1 to 1.5 mm long', gap: 'tips sit among the cortical neurons', hears: 'spikes of single neurons and the local field', sig: 0.88, inv: 0.82, mine: true },
    { n: 'Neuropixels', full: 'Neuropixels probe', ch: '384 recording channels chosen from 960 sites on one 10 mm shank', gap: 'a thin shank through every layer', hears: 'hundreds of neurons along a line, spike by spike', sig: 1, inv: 0.9, mine: false },
  ];
  let sel = 3;
  const hit = [];
  return {
    click(f, x, y) { const h = hit.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (h) sel = h.i; },
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 560;
      const pw = narrow ? W - 16 : W * 0.6, ph = narrow ? H * 0.64 : H - 16, x0 = 8, y0 = 8;
      // layers: scalp, skull, CSF, cortex
      const Ls = [
        { n: 'scalp', h: 0.1, col: withAlpha(c.stim, c.wc ? 0.25 : 0.2) },
        { n: 'skull', h: 0.12, col: c.txt(0.18) },
        { n: 'fluid', h: 0.06, col: withAlpha(c.non, 0.12) },
        { n: 'cortex', h: 0.72, col: withAlpha(c.inv, c.wc ? 0.1 : 0.09) },
      ];
      let y = y0; const ys = {};
      Ls.forEach((l) => { const hh = ph * l.h; ctx.fillStyle = l.col; ctx.fillRect(x0, y, pw, hh); ys[l.n] = [y, y + hh]; text(f, l.n, x0 + 8, y + 14, { size: 10, a: 0.55 }); y += hh; });
      ctx.strokeStyle = c.txt(0.18); ctx.lineWidth = 1; for (const k of ['skull', 'fluid', 'cortex']) { ctx.beginPath(); ctx.moveTo(x0, ys[k][0]); ctx.lineTo(x0 + pw, ys[k][0]); ctx.stroke(); }
      // pyramidal neurons in the cortex
      const r = rng(9);
      const ct = ys.cortex[0], cb = ys.cortex[1];
      for (let i = 0; i < 26; i++) {
        const nx = x0 + 30 + r() * (pw - 60), ny = ct + (cb - ct) * (0.25 + 0.65 * r()), fire = (Math.sin(f.t * 2.1 + i * 1.7) > 0.93);
        ctx.strokeStyle = c.txt(0.3); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx, ny - (cb - ct) * 0.3); ctx.stroke();
        ctx.fillStyle = fire ? c.inv : c.txt(0.5); ctx.beginPath(); ctx.arc(nx, ny, fire ? 3.6 : 2.6, 0, TAU); ctx.fill();
        if (fire) glow(ctx, nx, ny, 18, c.inv, 0.6);
      }
      // devices
      const px = [0.1, 0.27, 0.43, 0.6, 0.82].map((u) => x0 + pw * (u + 0.04));
      const drawDev = (i, on) => {
        const col = on ? c.accent : c.txt(0.8);
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = on ? 2.6 : 1.8; ctx.lineCap = 'round';
        const X = px[i];
        if (i === 0) { roundRect(ctx, X - 11, ys.scalp[0] - 2, 22, 9, 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(X, ys.scalp[0] - 2); ctx.lineTo(X, y0 - 0); ctx.stroke(); }
        else if (i === 1) { for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(X + k * 9, ys.cortex[0] - 2, 3.2, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.moveTo(X - 18, ys.cortex[0] - 5.4); ctx.lineTo(X + 18, ys.cortex[0] - 5.4); ctx.stroke(); }
        else if (i === 2) { const top = ys.skull[0] + 6; ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(X, cb - (cb - ct) * 0.12); ctx.stroke(); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(X, ct + (cb - ct) * (0.15 + k * 0.13), 3, 0, TAU); ctx.fillStyle = k % 2 ? col : withAlpha(col, 0.55); ctx.fill(); } }
        else if (i === 3) { for (let k = -2; k <= 2; k++) { const xx = X + k * 7; ctx.beginPath(); ctx.moveTo(xx, ys.fluid[0] - 5); ctx.lineTo(xx, ct + (cb - ct) * 0.42); ctx.lineWidth = on ? 2 : 1.4; ctx.stroke(); } roundRect(ctx, X - 18, ys.fluid[0] - 8, 36, 5, 2); ctx.fill(); }
        else { const top = ys.fluid[0] - 6; ctx.lineWidth = on ? 3.4 : 2.4; ctx.beginPath(); ctx.moveTo(X, top); ctx.lineTo(X, cb - 8); ctx.stroke(); for (let k = 0; k < 14; k++) { ctx.fillStyle = k % 2 ? col : withAlpha(col, 0.5); ctx.fillRect(X - 2, ct + 6 + k * ((cb - ct - 18) / 14), 4, 3); } }
        if (on) glow(ctx, X, i === 0 ? ys.scalp[0] : ct + 20, 30, c.accent, 0.3);
      };
      hit.length = 0;
      DEV.forEach((d, i) => { drawDev(i, i === sel); hit.push({ i, x: px[i] - 26, y: y0, w: 52, h: ph }); text(f, d.n, px[i], ph + y0 + (narrow ? 12 : -6), { size: 10.5, weight: i === sel ? 700 : 500, align: 'center', color: i === sel ? c.accent : c.txt(0.7) }); });
      // ── details
      const d = DEV[sel];
      const dx = narrow ? 8 : pw + 18, dy = narrow ? ph + 30 : 14, dw = narrow ? W - 16 : W - dx - 8;
      text(f, d.full, dx, dy + 6, { size: 13, weight: 700, a: 0.95 });
      if (d.mine) text(f, '★ I work with this', dx, dy + 22, { size: 10.5, weight: 700, color: c.accent });
      const wrap = (s, x, yy, w, size, a) => {
        const words = s.split(' '); let line = ''; const lh = size + 4;
        for (const wd of words) { const t = line ? `${line} ${wd}` : wd; if (ctx.measureText(t).width > w && line) { text(f, line, x, yy, { size, a }); yy += lh; line = wd; } else line = t; ctx.font = `500 ${size}px Inter, system-ui, sans-serif`; }
        text(f, line, x, yy, { size, a }); return yy + lh;
      };
      ctx.font = '500 11px Inter, system-ui, sans-serif';
      let yy = dy + (d.mine ? 40 : 26);
      yy = wrap(d.ch, dx, yy, dw, 11, 0.7);
      yy = wrap(`Sits: ${d.gap}.`, dx, yy + 2, dw, 11, 0.7);
      yy = wrap(`Hears: ${d.hears}.`, dx, yy + 2, dw, 11, 0.85);
      if (!narrow || H - yy > 40) {
        const bar = (label, v, col, yb) => { text(f, label, dx, yb, { size: 10, a: 0.6 }); ctx.fillStyle = c.txt(0.08); ctx.fillRect(dx, yb + 4, dw - 4, 8); ctx.fillStyle = col; ctx.fillRect(dx, yb + 4, (dw - 4) * v, 8); };
        const yb = Math.min(yy + 14, H - 50);
        bar('signal detail', d.sig, c.non, yb); bar('surgery needed', d.inv, c.inv, yb + 28);
      }
    },
  };
}

// 4 · soft versus stiff
function softWidget() {
  let soft = 0, weeks = 6;
  const controls = document.createElement('div');
  controls.append(segmented(['Stiff silicon shank', 'Soft polymer probe'], (i) => { soft = i; }));
  controls.append(slider('Time since implant', 0, 12, 1, weeks, (v) => `${v} weeks`, (v) => { weeks = v; }).el);
  const r = rng(13);
  const cells = Array.from({ length: 140 }, () => ({ x: r(), y: r(), s: 0.5 + r() }));
  const MAT = [['Brain', 3e3], ['Soft polymer (PDMS)', 1e6], ['Polyimide', 2.5e9], ['Silicon', 1.5e11]];
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 540;
      const pw = narrow ? W - 16 : W * 0.58, ph = narrow ? H * 0.62 : H - 16, x0 = 8, y0 = 8;
      roundRect(ctx, x0, y0, pw, ph, 12); ctx.fillStyle = withAlpha(c.inv, c.wc ? 0.05 : 0.06); ctx.fill(); ctx.strokeStyle = c.txt(0.16); ctx.stroke();
      ctx.save(); roundRect(ctx, x0, y0, pw, ph, 12); ctx.clip();
      const cx = x0 + pw / 2, shankW = soft ? 7 : 20;
      // brain micromotion: the tissue moves with every heartbeat and breath; a stiff shank tethered to the skull does not follow
      const move = 9 * (0.65 * Math.sin(f.t * TAU * 0.9) + 0.35 * Math.sin(f.t * TAU * 0.25));
      const k = weeks / 12;
      const scar = (soft ? 7 : 46) * Math.min(1, k * 1.1) + 2, kill = (soft ? 10 : 70) * Math.min(1, k * 1.1);
      const follow = soft ? move * 0.85 : 0;
      // scar halo
      if (weeks > 0) { glow(ctx, cx + follow, y0 + ph * 0.55, 120, c.stim, 0.0); ctx.fillStyle = withAlpha(c.stim, 0.22 + 0.2 * k); ctx.fillRect(cx + follow - shankW / 2 - scar, y0, shankW + 2 * scar, ph); }
      // neurons: dim and shrink inside the kill zone
      let alive = 0, total = 0;
      for (const cell of cells) {
        const x = x0 + cell.x * pw + move, y = y0 + cell.y * ph;
        const dd = Math.abs(x - (cx + follow));
        if (dd < shankW / 2 + 90 * (pw / 400)) total++;
        const dead = dd < shankW / 2 + kill * (pw / 400) * 0.9;
        if (dd < shankW / 2 + 90 * (pw / 400) && !dead) alive++;
        if (dd < shankW / 2) continue;
        ctx.fillStyle = dead ? c.txt(0.14) : withAlpha(c.non, 0.8); ctx.beginPath(); ctx.arc(x, y, 2.2 + cell.s * 1.4, 0, TAU); ctx.fill();
      }
      // glia clustering on the shank
      if (weeks > 1) { ctx.fillStyle = withAlpha(c.stim, 0.9); const n = Math.round(30 * Math.min(1, k * (soft ? 0.25 : 1))); for (let i = 0; i < n; i++) { const yy = y0 + ((i * 37) % 100) / 100 * ph; ctx.beginPath(); ctx.arc(cx + follow + (i % 2 ? 1 : -1) * (shankW / 2 + 3 + (i % 5)), yy, 2.4, 0, TAU); ctx.fill(); } }
      // the shank
      ctx.fillStyle = soft ? withAlpha(c.accent, 0.9) : c.txt(0.78); ctx.fillRect(cx + follow - shankW / 2, y0, shankW, ph * 0.9);
      if (!soft) { ctx.strokeStyle = c.inv; ctx.lineWidth = 2; const sx = cx + move; ctx.beginPath(); ctx.moveTo(sx, y0 + ph * 0.3); ctx.lineTo(cx, y0 + ph * 0.3); ctx.stroke(); text(f, 'tissue slides past the stiff shank', cx + 24, y0 + ph * 0.3 - 8, { size: 10, color: c.inv }); }
      else text(f, 'the soft probe moves with the brain', cx + 16, y0 + ph * 0.3 - 8, { size: 10, color: c.accent });
      text(f, 'glial scar', x0 + 10, y0 + ph - 10, { size: 10, a: 0.0 });
      ctx.restore();
      text(f, soft ? 'soft polymer' : 'stiff silicon', x0 + 10, y0 + 18, { size: 11, weight: 700, a: 0.85 });
      // ── readouts
      const dx = narrow ? 8 : pw + 18, dy = narrow ? ph + 28 : 14, dw = narrow ? W - 16 : W - dx - 8;
      const amp = clamp(1 - (soft ? 0.12 : 0.62) * Math.min(1, k * 1.1), 0.1, 1);
      text(f, `neurons alive near the probe: ${total ? Math.round((alive / total) * 100) : 100}%`, dx, dy + 6, { size: 11.5, weight: 700, a: 0.92 });
      text(f, `signal strength: ${Math.round(amp * 100)}% of day one`, dx, dy + 24, { size: 11.5, weight: 700, a: 0.92 });
      text(f, '(schematic: the trend, not a measurement)', dx, dy + 40, { size: 10, a: 0.45 });
      if (!narrow || H - (dy + 40) > 90) {
        text(f, 'stiffness (Young’s modulus, log scale)', dx, dy + 64, { size: 10.5, weight: 700, a: 0.8 });
        MAT.forEach(([n, e], i) => {
          const y = dy + 74 + i * 22, w = ((Math.log10(e) - 2.5) / (11.5 - 2.5)) * (dw - 8);
          text(f, n, dx, y + 8, { size: 10, a: 0.7 });
          ctx.fillStyle = c.txt(0.07); ctx.fillRect(dx, y + 11, dw - 8, 5);
          ctx.fillStyle = i === 0 ? c.non : c.accent; ctx.fillRect(dx, y + 11, Math.max(3, w), 5);
          text(f, e >= 1e9 ? `${fmt(e / 1e9, 1)} GPa` : e >= 1e6 ? `${fmt(e / 1e6, 0)} MPa` : `${fmt(e / 1e3, 0)} kPa`, dx + dw - 8, y + 8, { size: 10, weight: 700, align: 'right', a: 0.85 });
        });
      }
    },
  };
}

// 5 · see through the electrode
function clearWidget() {
  let transparent = 1;
  const controls = segmented(['Opaque gold contacts', 'Transparent graphene'], (i) => { transparent = i; }, 1);
  const r = rng(17);
  const cells = Array.from({ length: 170 }, () => ({ x: r(), y: r(), ph: r() * 6, rate: 0.3 + r() * 0.9 }));
  const pads = [];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) pads.push({ u: 0.17 + i * 0.22, v: 0.2 + j * 0.3 });
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 540;
      const pw = narrow ? W - 16 : W * 0.6, ph = narrow ? H * 0.6 : H - 16, x0 = 8, y0 = 8;
      roundRect(ctx, x0, y0, pw, ph, 12); ctx.fillStyle = c.wc ? '#26332b' : '#08110c'; ctx.fill();
      ctx.save(); roundRect(ctx, x0, y0, pw, ph, 12); ctx.clip();
      const ps = Math.min(pw, ph) * 0.085;
      const under = (x, y) => pads.some((p) => Math.abs(x - (x0 + p.u * pw)) < ps && Math.abs(y - (y0 + p.v * ph)) < ps);
      let seen = 0, hidden = 0;
      cells.forEach((cell) => {
        const x = x0 + cell.x * pw, y = y0 + cell.y * ph, a = Math.max(0, Math.sin(f.t * cell.rate * 2 + cell.ph)) ** 6;
        const blocked = !transparent && under(x, y);
        if (blocked) { hidden++; return; }
        seen++;
        ctx.fillStyle = withAlpha('#4cff9a', 0.25 + 0.7 * a); ctx.beginPath(); ctx.arc(x, y, 2.4 + 1.6 * a, 0, TAU); ctx.fill();
        if (a > 0.3) glow(ctx, x, y, 12, '#4cff9a', 0.4 * a);
      });
      // the contacts and their traces
      pads.forEach((p, i) => {
        const x = x0 + p.u * pw, y = y0 + p.v * ph;
        if (transparent) {
          ctx.strokeStyle = 'rgba(210,225,255,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x - ps, y - ps, ps * 2, ps * 2);
          ctx.fillStyle = 'rgba(210,225,255,0.07)'; ctx.fillRect(x - ps, y - ps, ps * 2, ps * 2);
          ctx.strokeStyle = 'rgba(210,225,255,0.3)'; ctx.beginPath(); ctx.moveTo(x, y - ps); ctx.lineTo(x, y0); ctx.stroke();
        } else {
          ctx.fillStyle = c.wc ? '#c9a24a' : '#d8b25a'; ctx.fillRect(x - ps, y - ps, ps * 2, ps * 2);
          ctx.strokeStyle = c.wc ? '#c9a24a' : '#d8b25a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - ps); ctx.lineTo(x, y0); ctx.stroke();
        }
        void i;
      });
      ctx.restore();
      text(f, 'two-photon view of cortex, calcium indicator (green)', x0 + 10, y0 + 16, { size: 10, color: 'rgba(220,235,225,0.75)' });
      // ── readout
      const dx = narrow ? 8 : pw + 18, dy = narrow ? ph + 28 : 14, dw = narrow ? W - 16 : W - dx - 8;
      const total = cells.length;
      text(f, `neurons you can see: ${seen} of ${total}`, dx, dy + 6, { size: 12, weight: 700, color: transparent ? c.non : c.inv });
      ctx.fillStyle = c.txt(0.08); ctx.fillRect(dx, dy + 14, dw - 6, 8); ctx.fillStyle = transparent ? c.non : c.inv; ctx.fillRect(dx, dy + 14, (dw - 6) * (seen / total), 8);
      text(f, transparent ? 'light passes through: one layer of graphene absorbs only 2.3 %' : 'light stops at the metal: the neurons beneath are hidden', dx, dy + 40, { size: 10.5, a: 0.75 });
      // the two recordings that run together
      const ty = dy + 62, th = narrow ? 34 : 46;
      const trace = (label, y, fn, col, on) => {
        text(f, label, dx, y - 4, { size: 10, a: 0.6 });
        ctx.strokeStyle = on ? col : c.txt(0.18); ctx.lineWidth = on ? 1.5 : 1; ctx.beginPath();
        const n = Math.floor(dw - 8);
        for (let i = 0; i <= n; i++) { const tau = f.t - 3 + (i / n) * 3, v = on ? fn(tau) : 0; const yy = y + th / 2 - v * th * 0.45; i ? ctx.lineTo(dx + i, yy) : ctx.moveTo(dx + i, yy); }
        ctx.stroke();
      };
      const burst = (tau) => Math.max(0, Math.sin(tau * 2.6)) ** 8;
      trace('calcium signal (optical)', ty, (tau) => burst(tau) * 1.0 - 0.4 + 0.03 * noiseTable[Math.floor(tau * 80) & 4095], c.non, !!transparent);
      trace('voltage (electrical)', ty + th + 22, (tau) => 0.55 * burst(tau + 0.1) * spikeShape(((tau * 2.6) % 1) * 2) * 2 + 0.05 * noiseTable[Math.floor(tau * 300) & 4095], c.accent, true);
      if (!transparent && !narrow) text(f, 'no optical signal under the metal', dx, ty + 16, { size: 10, color: c.inv });
      if (!narrow) text(f, transparent ? 'both measured at once, from the same neurons' : 'only the electrical trace survives', dx, ty + 2 * th + 40, { size: 10.5, weight: 700, a: 0.85 });
    },
  };
}

// 6 · how many electrodes, and what they cost in power
function scaleWidget() {
  const PTS = [
    { y: 1957, n: 1, l: 'tungsten microelectrode' }, { y: 1993, n: 4, l: 'tetrode' }, { y: 1997, n: 100, l: 'Utah array' },
    { y: 2017, n: 960, l: 'Neuropixels 1.0 (sites)' }, { y: 2019, n: 3072, l: 'Neuralink threads' }, { y: 2021, n: 5120, l: 'Neuropixels 2.0 (sites)' },
  ];
  let year = 2035, dbl = 7, uw = 1;
  const controls = document.createElement('div');
  controls.append(slider('Year', 2025, 2050, 1, year, (v) => `${v}`, (v) => { year = v; }).el);
  controls.append(slider('Power per channel', 0, 1, 0.01, 0.5, (v) => `${fmt(0.1 * 1000 ** v, 1)} µW`, (v) => { uw = 0.1 * 1000 ** v; }).el);
  return {
    controls,
    draw(f) {
      const { ctx, W, H, c } = f;
      const narrow = W < 560;
      const L = 50, R = narrow ? W - 14 : W * 0.66, T = 24, B = H - (narrow ? 118 : 56);
      const x = (yr) => L + ((yr - 1955) / (2052 - 1955)) * (R - L), y = (n) => B - (Math.log10(n) / 8) * (B - T);
      ctx.strokeStyle = c.txt(0.1); ctx.lineWidth = 1;
      for (let e = 0; e <= 8; e += 2) { ctx.beginPath(); ctx.moveTo(L, y(10 ** e)); ctx.lineTo(R, y(10 ** e)); ctx.stroke(); text(f, e === 0 ? '1' : e === 2 ? '100' : e === 4 ? '10 k' : e === 6 ? '1 M' : '100 M', L - 6, y(10 ** e) + 3, { size: 9.5, align: 'right', a: 0.5 }); }
      for (const yr of [1960, 1980, 2000, 2020, 2040]) { text(f, `${yr}`, x(yr), B + 14, { size: 9.5, align: 'center', a: 0.5 }); ctx.beginPath(); ctx.moveTo(x(yr), T); ctx.lineTo(x(yr), B); ctx.stroke(); }
      text(f, 'electrodes on one device', 6, 14, { size: 10, a: 0.55 });
      // the doubling-time trend through the first point
      const trend = (yr) => Math.pow(2, (yr - 1957) / dbl);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
      for (let yr = 1957; yr <= 2050; yr += 1) { const v = trend(yr); const py = y(clamp(v, 1, 1e8)); yr === 1957 ? ctx.moveTo(x(yr), py) : ctx.lineTo(x(yr), py); }
      ctx.stroke(); ctx.setLineDash([]);
      text(f, `doubling every ${dbl} years`, x(1962), y(1e4) - 4, { size: 10.5, weight: 700, color: c.accent });
      PTS.forEach((p) => { ctx.fillStyle = c.non; ctx.beginPath(); ctx.arc(x(p.y), y(p.n), 5, 0, TAU); ctx.fill(); glow(ctx, x(p.y), y(p.n), 14, c.non, 0.35); });
      PTS.forEach((p, i) => { if (i % 2 === 0 || !narrow) text(f, p.l, x(p.y) + (i > 3 ? -8 : 8), y(p.n) + (i > 3 ? 16 : 3), { size: 9.5, align: i > 3 ? 'right' : 'left', a: 0.75 }); });
      const n = trend(year), px = x(year), py = y(clamp(n, 1, 1e8));
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(px, py, 6.5, 0, TAU); ctx.fill(); glow(ctx, px, py, 22, c.accent, 0.45);
      // readout
      const dx = narrow ? 10 : R + 20, dy = narrow ? B + 30 : 30;
      const mw = n * uw * 1e-3;
      text(f, `${year}, on this trend:`, dx, dy, { size: 11, a: 0.65 });
      text(f, `${n >= 1e6 ? fmt(n / 1e6, 1) + ' million' : n >= 1e3 ? fmt(n / 1e3, 0) + ' thousand' : fmt(n, 0)} electrodes`, dx, dy + 24, { size: 16, weight: 700, a: 0.95 });
      text(f, `× ${fmt(uw, 1)} µW each`, dx, dy + 44, { size: 11, a: 0.7 });
      text(f, `= ${mw >= 1000 ? fmt(mw / 1000, 1) + ' W' : fmt(mw, 1) + ' mW'} in the skull`, dx, dy + 64, { size: 15, weight: 700, color: mw > 100 ? c.inv : mw > 20 ? c.stim : c.non });
      if (!narrow) text(f, 'every doubling is a power problem for the chip', dx, dy + 90, { size: 10.5, a: 0.6 });
      text(f, 'points: published devices · dashed line: Stevenson & Kording trend', 6, H - 6, { size: 9.5, a: 0.45 });
    },
  };
}

export const WIDGETS = { field: fieldWidget, interface: interfaceWidget, size: sizeWidget, forms: formsWidget, soft: softWidget, clear: clearWidget, scale: scaleWidget };
export const CAPTIONS = {
  field: 'Schematic: the potential falls off steeply with distance, so only electrodes within about 100 µm hear a spike.',
  interface: 'Idealised: a series resistance plus a double-layer capacitance. Capacitances are textbook values per area.',
  size: 'Schematic. Neurons beneath a surface contact = 50,000 per mm³ × 2 mm of cortex × contact area.',
  forms: 'Cartoon cross-section; not to scale. Click a device.',
  soft: 'Schematic of the trend only: values are not measurements.',
  clear: 'Cartoon of simultaneous two-photon imaging and electrical recording.',
  scale: 'Electrode counts are the published ones; the doubling time is the trend reported by Stevenson & Kording (2011).',
};
