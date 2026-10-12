// Shared helpers for the 2D canvas figures on the Learn pages: a canvas that knows the theme colours,
// small drawing utilities, and a slider control.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmt = (v, d = 1) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d)).replace(/\.0+$/, '');

// a canvas with theme colours, a pixel-ratio-aware size and the pointer position
export function makeFig(canvas) {
  const f = { ctx: canvas.getContext('2d'), W: 0, H: 0, t: 0, c: {}, themeKey: '', mouse: { x: -1, y: -1, in: false } };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    f.W = r.width; f.H = r.height;
    canvas.width = Math.round(f.W * dpr); canvas.height = Math.round(f.H * dpr);
    f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const colors = () => {
    const cs = getComputedStyle(document.documentElement);
    const wc = document.documentElement.dataset.theme === 'watercolor';
    const ink = wc ? '42,35,30' : '236,232,224';
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    f.themeKey = document.documentElement.dataset.theme;
    f.c = {
      ink, txt: (a) => `rgba(${ink},${a})`, accent: v('--accent', '#ff5b2e'), non: v('--non', '#5eead4'),
      inv: v('--inv', '#ff6fb1'), stim: v('--stim', '#ffb547'), wc,
      paper: wc ? '#fffaf0' : '#1b1a18', onAccent: wc ? '#fffaf0' : '#0d0d0c',
    };
  };
  colors();
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); f.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, in: true }; });
  canvas.addEventListener('pointerleave', () => { f.mouse.in = false; });
  f.resize = resize;
  f.colors = colors;
  return f;
}

// uniform pseudo-random numbers so a drawing looks the same every time
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());

export function slider(label, min, max, step, value, unit, onInput) {
  const el = document.createElement('label');
  el.className = 'ctl';
  el.innerHTML = `<span class="ctl-l">${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" /><output></output>`;
  const input = el.querySelector('input');
  const out = el.querySelector('output');
  const upd = () => { out.textContent = unit(+input.value); onInput(+input.value); };
  input.addEventListener('input', upd);
  upd();
  return { el, input };
}

// a row of exclusive buttons; calls onPick(index)
export function segmented(labels, onPick, start = 0) {
  const el = document.createElement('div');
  el.className = 'seg';
  el.innerHTML = labels.map((l, i) => `<button type="button"${i === start ? ' class="on"' : ''}>${l}</button>`).join('');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = [...el.children].indexOf(b);
    [...el.children].forEach((x, k) => x.classList.toggle('on', k === i));
    onPick(i);
  });
  return el;
}

export const text = (f, s, x, y, { size = 11, weight = 500, a = 0.62, align = 'left', color, font = 'Inter, system-ui, sans-serif' } = {}) => {
  f.ctx.font = `${weight} ${size}px ${font}`;
  f.ctx.textAlign = align;
  f.ctx.fillStyle = color || f.c.txt(a);
  f.ctx.fillText(s, x, y);
};

export const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};

export const withAlpha = (hex, a) => {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
// a soft glowing dot (colour as #rrggbb)
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, a));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
