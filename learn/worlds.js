// Animated backdrops for the two Learn worlds that have no 3D brain: living tissue (sensor design) and a
// routed die (chip design). Both are full-screen 2D canvases, drawn calmly behind the text.
import { TAU, rng, withAlpha, glow } from './fig.js';

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const wc = document.documentElement.dataset.theme === 'watercolor';
  const v = (n, d) => cs.getPropertyValue(n).trim() || d;
  return { wc, ink: wc ? '42,35,30' : '236,232,224', accent: v('--accent', '#ff5b2e'), non: v('--non', '#5eead4'), inv: v('--inv', '#ff6fb1'), stim: v('--stim', '#ffb547'), bg: v('--bg', '#0d0d0c') };
}

function base(canvas, build) {
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  const st = { W: 0, H: 0, dpr: 1, themeKey: '', pal: palette(), scene: null };
  const resize = () => {
    const mobile = innerWidth < 760;
    st.dpr = Math.min(devicePixelRatio, mobile ? 1.25 : 1.75);
    st.W = innerWidth; st.H = innerHeight;
    canvas.width = Math.round(st.W * st.dpr); canvas.height = Math.round(st.H * st.dpr);
    st.HH = Math.round(st.H * 1.2);
    off.width = canvas.width; off.height = Math.round(canvas.height * 1.2);
    st.pal = palette(); st.themeKey = document.documentElement.dataset.theme;
    st.scene = build(st, off, mobile);
  };
  return { ctx, off, st, resize };
}

// ── sensor design: pyramidal neurons, spikes that ripple outward, and shanks that listen ──────────────
export function sensorWorld(canvas) {
  const b = base(canvas, (st, off, mobile) => {
    const r = rng(42), o = off.getContext('2d');
    o.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    const { pal } = st;
    const neurons = [];
    const N = mobile ? 5 : 9;
    for (let i = 0; i < N; i++) {
      const depth = 0.45 + 0.55 * r();
      const x = (0.04 + 0.92 * ((i + r() * 0.8) / N)) * st.W, y = st.H * (0.25 + 0.95 * r());
      const sc = (mobile ? 0.8 : 1.15) * depth * (st.H / 800);
      const segs = [];
      const branch = (x0, y0, ang, len, w, d) => {
        const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
        segs.push([x0, y0, x1, y1, w]);
        if (d > 0) for (const k of [-1, 1]) branch(x1, y1, ang + k * (0.3 + r() * 0.5), len * (0.6 + r() * 0.2), w * 0.72, d - 1);
      };
      branch(x, y - 7 * sc, -Math.PI / 2 + (r() - 0.5) * 0.4, 110 * sc, 3 * sc, 3);
      for (let k = 0; k < 3; k++) branch(x, y + 6 * sc, Math.PI / 2 + (k - 1) * 0.8 + (r() - 0.5) * 0.3, 52 * sc, 2.2 * sc, 2);
      const axon = [[x + 6 * sc, y + 6 * sc]];
      let ax = x + 6 * sc, ay = y + 6 * sc, aa = Math.PI / 2 + (r() - 0.5) * 0.9;
      for (let k = 0; k < 9; k++) { aa += (r() - 0.5) * 0.7; ax += Math.cos(aa) * 40 * sc; ay += Math.sin(aa) * 40 * sc; axon.push([ax, ay]); }
      neurons.push({ x, y, sc, depth, segs, axon, next: r() * 6, ripple: -9, pulse: -1 });
    }
    // draw the silhouettes once
    for (const n of neurons) {
      o.strokeStyle = `rgba(${pal.ink},${0.07 + 0.12 * n.depth})`; o.lineCap = 'round';
      for (const [x0, y0, x1, y1, w] of n.segs) { o.lineWidth = Math.max(0.6, w); o.beginPath(); o.moveTo(x0, y0); o.lineTo(x1, y1); o.stroke(); }
      o.lineWidth = Math.max(0.6, 1.4 * n.sc); o.beginPath(); n.axon.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.stroke();
      o.fillStyle = `rgba(${pal.ink},${0.14 + 0.2 * n.depth})`; o.beginPath(); o.arc(n.x, n.y, 7 * n.sc, 0, TAU); o.fill();
    }
    // a few shanks that listen
    const shanks = [];
    for (const u of mobile ? [0.62] : [0.17, 0.52, 0.83]) {
      const x = u * st.W, y0 = st.H * 0.12, y1 = st.H * (0.62 + 0.3 * r());
      o.strokeStyle = `rgba(${pal.ink},0.22)`; o.lineWidth = 3; o.beginPath(); o.moveTo(x, -10); o.lineTo(x, y1); o.stroke();
      const pads = [];
      for (let y = y0 + 20; y < y1 - 10; y += 34) pads.push({ x, y, v: 0 });
      o.fillStyle = `rgba(${pal.ink},0.28)`; pads.forEach((p) => o.fillRect(p.x - 3, p.y - 3, 6, 6));
      shanks.push(pads);
    }
    return { neurons, pads: shanks.flat() };
  });
  let t = 0;
  return {
    resize: b.resize,
    draw(dt, scroll, boost = 0) {
      const { st, ctx } = b;
      if (!st.scene) b.resize();
      if (st.themeKey !== document.documentElement.dataset.theme) b.resize();
      t += dt;
      const { pal } = st, sc = st.scene;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const par = -0.2 * st.H * Math.tanh(scroll / (6 * st.H));
      ctx.save(); ctx.translate(0, par * st.dpr);
      ctx.drawImage(b.off, 0, 0);
      ctx.restore();
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.save(); ctx.translate(0, par);
      for (const p of sc.pads) p.v *= 0.9;
      for (const n of sc.neurons) {
        if (t > n.next) { n.ripple = t; n.pulse = 0; n.next = t + 4 + Math.random() * 9 / (1 + boost); }
        const age = t - n.ripple;
        if (age < 1.6) {
          const rad = age * 150 * n.sc * 1.2, a = (1 - age / 1.6);
          ctx.strokeStyle = withAlpha(pal.inv, 0.5 * a); ctx.lineWidth = 1.4;
          for (const k of [0, 0.35, 0.7]) { const rr = rad - k * 36 * n.sc; if (rr > 4) { ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, TAU); ctx.stroke(); } }
          glow(ctx, n.x, n.y, 30 * n.sc * (1 + a), pal.inv, 0.55 * a);
          for (const p of sc.pads) { const d = Math.hypot(p.x - n.x, p.y - n.y); if (d < 260) p.v = Math.max(p.v, a * 0.9 / (1 + (d / (60 * n.sc + 10)) ** 2) * 2.2); }
        }
        if (n.pulse >= 0 && n.pulse < 1) {
          n.pulse += dt * 0.5;
          const f = n.pulse * (n.axon.length - 1), i = Math.min(n.axon.length - 2, Math.floor(f)), q = f - i;
          const x = n.axon[i][0] + (n.axon[i + 1][0] - n.axon[i][0]) * q, y = n.axon[i][1] + (n.axon[i + 1][1] - n.axon[i][1]) * q;
          glow(ctx, x, y, 16 * n.sc + 4, pal.accent, 0.9);
          ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(x, y, 2.4 * n.sc + 0.6, 0, TAU); ctx.fill();
        }
      }
      for (const p of sc.pads) if (p.v > 0.04) { ctx.fillStyle = withAlpha(pal.accent, Math.min(1, p.v)); ctx.fillRect(p.x - 4, p.y - 4, 8, 8); glow(ctx, p.x, p.y, 16, pal.accent, Math.min(0.8, p.v)); }
      ctx.restore();
    },
  };
}

// ── chip design: Manhattan traces on a die, with signals running along them ──────────────────────────
export function chipWorld(canvas) {
  const b = base(canvas, (st, off, mobile) => {
    const r = rng(7), o = off.getContext('2d');
    o.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    const { pal } = st;
    const G = mobile ? 24 : 30, cols = Math.ceil(st.W / G), rows = Math.ceil(st.HH / G);
    const traces = [];
    const n = mobile ? 10 : 22;
    for (let i = 0; i < n; i++) {
      let x = Math.floor(r() * cols), y = Math.floor(r() * rows), dir = r() < 0.5 ? 0 : 1;
      const pts = [[x, y]];
      const segs = 4 + Math.floor(r() * 9);
      for (let k = 0; k < segs; k++) {
        const len = 2 + Math.floor(r() * 9);
        const sg = r() < 0.5 ? -1 : 1;
        if (dir === 0) x = Math.max(0, Math.min(cols, x + sg * len)); else y = Math.max(0, Math.min(rows, y + sg * len));
        pts.push([x, y]); dir = 1 - dir;
      }
      const px = pts.map(([a, c]) => [a * G, c * G]);
      let len = 0; const cum = [0];
      for (let k = 1; k < px.length; k++) { len += Math.hypot(px[k][0] - px[k - 1][0], px[k][1] - px[k - 1][1]); cum.push(len); }
      if (len < G * 4) continue;
      traces.push({ px, cum, len, u: r(), speed: 40 + r() * 90, col: ['accent', 'non', 'stim', 'inv'][Math.floor(r() * 4)], w: 1 + (r() < 0.2 ? 1.2 : 0) });
    }
    // the static layer: faint grid dots, traces, vias and a few labelled blocks
    o.fillStyle = `rgba(${pal.ink},0.08)`;
    for (let i = 0; i <= cols; i += 1) for (let j = 0; j <= rows; j += 1) if ((i + j) % 2 === 0) o.fillRect(i * G - 0.5, j * G - 0.5, 1, 1);
    for (const t of traces) {
      o.strokeStyle = `rgba(${pal.ink},${t.w > 1 ? 0.2 : 0.13})`; o.lineWidth = t.w; o.lineJoin = 'round';
      o.beginPath(); t.px.forEach(([x, y], i) => (i ? o.lineTo(x, y) : o.moveTo(x, y))); o.stroke();
      o.fillStyle = `rgba(${pal.ink},0.25)`;
      for (const k of [0, t.px.length - 1]) { o.beginPath(); o.arc(t.px[k][0], t.px[k][1], 2.6, 0, TAU); o.fill(); }
    }
    const blocks = [['AMP', 0.08, 0.2, 5, 3], ['ADC', 0.78, 0.32, 5, 3], ['SRAM', 0.62, 0.7, 7, 4], ['LOGIC', 0.14, 0.72, 6, 3], ['RF', 0.9, 0.82, 3, 3]];
    o.font = '500 10px JetBrains Mono, monospace';
    for (const [name, u, v, bw, bh] of blocks) {
      const x = Math.round(u * cols) * G, y = Math.round(v * rows) * G;
      o.strokeStyle = `rgba(${pal.ink},0.22)`; o.lineWidth = 1; o.strokeRect(x, y, bw * G, bh * G);
      o.fillStyle = `rgba(${pal.ink},0.05)`; o.fillRect(x, y, bw * G, bh * G);
      o.fillStyle = `rgba(${pal.ink},0.4)`; o.fillText(name, x + 6, y + 14);
      for (let i = 0; i < bw * 2; i++) { o.fillStyle = `rgba(${pal.ink},0.18)`; o.fillRect(x + 6 + i * (G / 2), y + bh * G - 8, 4, 4); }
    }
    return { traces, G };
  });
  let t = 0;
  return {
    resize: b.resize,
    draw(dt, scroll, boost = 0) {
      const { st, ctx } = b;
      if (!st.scene) b.resize();
      if (st.themeKey !== document.documentElement.dataset.theme) b.resize();
      t += dt;
      const { pal } = st, sc = st.scene;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const par = -0.2 * st.H * Math.tanh(scroll / (6 * st.H));
      ctx.save(); ctx.translate(0, par * st.dpr); ctx.drawImage(b.off, 0, 0); ctx.restore();
      ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      ctx.save(); ctx.translate(0, par);
      for (const tr of sc.traces) {
        tr.u = (tr.u + (dt * tr.speed * (1 + boost)) / tr.len) % 1;
        for (let k = 0; k < 5; k++) {
          const d = ((tr.u * tr.len) - k * 7 + tr.len) % tr.len;
          let i = 1; while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
          const q = (d - tr.cum[i - 1]) / Math.max(1, tr.cum[i] - tr.cum[i - 1]);
          const x = tr.px[i - 1][0] + (tr.px[i][0] - tr.px[i - 1][0]) * q, y = tr.px[i - 1][1] + (tr.px[i][1] - tr.px[i - 1][1]) * q;
          const col = pal[tr.col], a = (1 - k / 5);
          if (k === 0) glow(ctx, x, y, 14, col, 0.8);
          ctx.fillStyle = withAlpha(col, 0.85 * a); ctx.beginPath(); ctx.arc(x, y, k === 0 ? 2.6 : 1.8 * a + 0.4, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}
