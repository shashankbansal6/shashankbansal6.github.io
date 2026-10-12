// Population-vector demo, drawn as a diagram you can read in five seconds.
//   left  : the hand moves in a direction (dashed, grey). Each of 8 neurons "votes" with an arrow in its
//           own favourite direction, as long as its current firing rate. The thick arrow is the sum.
//   right : the same 8 neurons as bars. The neuron whose favourite direction matches the movement fires
//           fastest; the one facing the other way falls silent (cosine tuning, Georgopoulos 1982).
// Point anywhere on the canvas to steer the hand. Left alone, it sweeps around by itself.
const GLYPH = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

export function initPopVec(canvas) {
  const ctx = canvas.getContext('2d');
  const N = 8;
  // favourite directions are evenly spaced, in screen coordinates (y down), starting at "right"
  const pref = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);
  const gain = [1, 0.92, 1.05, 0.88, 1, 0.94, 1.06, 0.9];
  let W = 0, H = 0, th = -0.6, aim = null, idle = 0, ink = '42,35,30', accent = '#c4561f', clock = 0, styled = -1;
  const rate = pref.map(() => 0);
  const spike = pref.map(() => 0);

  function resize() {
    const dpr = Math.min(devicePixelRatio, 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const dial = () => ({ cx: W * 0.26, cy: H * 0.5, R: Math.min(H * 0.37, W * 0.2) });
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    const { cx, cy } = dial();
    aim = Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx);
    idle = 0;
  };
  canvas.addEventListener('pointermove', point);
  canvas.addEventListener('pointerdown', point);
  canvas.addEventListener('pointerleave', () => { aim = null; });

  function style() {
    const cs = getComputedStyle(document.documentElement);
    accent = cs.getPropertyValue('--accent').trim() || accent;
    ink = document.documentElement.dataset.theme === 'watercolor' ? '42,35,30' : '236,232,224';
  }
  const arrow = (x0, y0, x1, y1, head, color, width) => {
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * head * 0.6, y1 - Math.sin(a) * head * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(a - 0.4) * head, y1 - Math.sin(a - 0.4) * head);
    ctx.lineTo(x1 - Math.cos(a + 0.4) * head, y1 - Math.sin(a + 0.4) * head);
    ctx.closePath(); ctx.fill();
  };

  function step(dt) {
    if (!W) { resize(); if (!W) return; }
    clock += dt;
    if (clock - styled > 1) { styled = clock; style(); }
    if (aim === null) { idle += dt; th += dt * (0.55 + 0.2 * Math.sin(clock * 0.4)); }
    else { let d = aim - th; d = Math.atan2(Math.sin(d), Math.cos(d)); th += d * Math.min(1, dt * 9); }
    const { cx, cy, R } = dial();
    const txt = (a) => `rgba(${ink},${a})`;
    ctx.clearRect(0, 0, W, H);

    // firing rates: cosine tuning around each neuron's favourite direction
    let px = 0, py = 0;
    for (let i = 0; i < N; i++) {
      const goal = Math.max(0, 0.12 + 0.88 * Math.cos(th - pref[i])) * gain[i];
      rate[i] += (goal - rate[i]) * Math.min(1, dt * 14);
      if (Math.random() < rate[i] * dt * 22) spike[i] = 1; // a flash for each spike
      spike[i] *= 0.82;
      px += rate[i] * Math.cos(pref[i]); py += rate[i] * Math.sin(pref[i]);
    }

    // ── left: the hand and the votes ──
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = txt(0.62);
    ctx.fillText('THE HAND MOVES', cx, 14);
    ctx.strokeStyle = txt(0.2); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = txt(0.55);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(th) * R, cy + Math.sin(th) * R); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = txt(0.85);
    ctx.beginPath(); ctx.arc(cx + Math.cos(th) * R, cy + Math.sin(th) * R, 5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < N; i++) {
      const len = rate[i] * R * 0.92;
      ctx.globalAlpha = 0.35 + 0.65 * rate[i];
      arrow(cx, cy, cx + Math.cos(pref[i]) * len, cy + Math.sin(pref[i]) * len, 7, accent, 2);
      ctx.globalAlpha = 1;
    }
    const mag = Math.hypot(px, py) || 1;
    arrow(cx, cy, cx + (px / mag) * R * 1.02, cy + (py / mag) * R * 1.02, 12, `rgb(${ink})`, 3.4);
    ctx.fillStyle = `rgb(${ink})`; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = txt(0.62);
    ctx.fillText('thick arrow = sum of the votes', cx, H - 6);

    // ── right: the neurons ──
    const bx = W * 0.6, bw = W - bx - 12, rowH = (H - 40) / N;
    ctx.textAlign = 'left'; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.fillStyle = txt(0.62);
    ctx.fillText('FIRING RATE OF 8 NEURONS', bx - 22, 14);
    for (let i = 0; i < N; i++) {
      const y = 26 + i * rowH + rowH / 2;
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = accent; ctx.textAlign = 'center';
      ctx.fillText(GLYPH[i], bx - 12, y + 4.5);
      ctx.fillStyle = txt(0.09);
      ctx.fillRect(bx, y - rowH * 0.28, bw, rowH * 0.56);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.55 + 0.45 * rate[i];
      ctx.fillRect(bx, y - rowH * 0.28, bw * Math.min(1, rate[i]), rowH * 0.56);
      ctx.globalAlpha = 1;
      if (spike[i] > 0.1) {
        ctx.fillStyle = `rgb(${ink})`; ctx.globalAlpha = spike[i];
        ctx.beginPath(); ctx.arc(bx + bw * Math.min(1, rate[i]) + 6, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'left'; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = txt(0.62);
    ctx.fillText('arrow = favourite direction', bx - 22, H - 6);
  }
  new ResizeObserver(resize).observe(canvas);
  return { step, resize };
}
