// Closed-loop finale HUD: neural features → decoder → cursor + decoded text,
// with a callback each time an action is "selected" (drives stimulation).
const CLASSES = ['left', 'right', 'up', 'down', 'select'];
const PHRASES = [
  'hello from the motor cortex',
  'decoded on chip in real time',
  'one microwatt per channel',
  'closing the loop',
];

export function initDecode(root, { onSelect } = {}) {
  const feat = root.querySelector('.dec-features');
  const fctx = feat.getContext('2d');
  const out = root.querySelector('.dec-output');
  const octx = out.getContext('2d');
  const barsEl = root.querySelector('.dec-bars');
  const textEl = root.querySelector('.dec-text');
  const stimEl = root.querySelector('.dec-stim');

  const bars = CLASSES.map((c) => {
    const row = document.createElement('div');
    row.className = 'bar';
    row.innerHTML = `<span>${c}</span><i><b></b></i><em>0.00</em>`;
    barsEl.appendChild(row);
    return { row, fill: row.querySelector('b'), val: row.querySelector('em'), p: 0.2 };
  });

  const CH = 16, BANDS = 6;
  const features = new Float32Array(CH * BANDS);
  const targets = [[0.15, 0.5], [0.85, 0.5], [0.5, 0.15], [0.5, 0.85]];
  const cursor = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  let target = 1;
  let dwell = 0;
  let phrase = 0, chars = 0, typeAcc = 0;
  let stimFlash = 0;
  let dims = null;

  function size() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    for (const [c, ctx] of [[feat, fctx], [out, octx]]) {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, r.width * dpr);
      c.height = Math.max(1, r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    dims = {
      fw: feat.getBoundingClientRect().width, fh: feat.getBoundingClientRect().height,
      ow: out.getBoundingClientRect().width, oh: out.getBoundingClientRect().height,
    };
  }

  function intentProbs() {
    const [tx, ty] = targets[target];
    const dx = tx - cursor.x, dy = ty - cursor.y;
    const near = Math.hypot(dx, dy) < 0.06;
    const raw = [
      Math.max(0, -dx), Math.max(0, dx), Math.max(0, -dy), Math.max(0, dy),
      near ? 0.6 : 0.02,
    ].map((v) => v * 6 + 0.08 + Math.random() * 0.06);
    const s = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => v / s);
  }

  function update(dt) {
    if (!dims) size();
    // features: band power per channel, a few channels tuned to the intent
    const p = intentProbs();
    for (let c = 0; c < CH; c++) {
      const tuned = p[c % 4] * (c < 8 ? 1.4 : 0.6);
      for (let b = 0; b < BANDS; b++) {
        const hg = b >= 4 ? tuned * 1.6 : b < 2 ? (1 - tuned) * 0.5 : 0.25;
        const k = c * BANDS + b;
        features[k] += (Math.min(1, hg + Math.random() * 0.25) - features[k]) * Math.min(1, dt * 6);
      }
    }
    const { fw, fh } = dims;
    const cw = fw / CH, ch = fh / BANDS;
    for (let c = 0; c < CH; c++) {
      for (let b = 0; b < BANDS; b++) {
        const v = features[c * BANDS + b];
        fctx.fillStyle = `hsl(38, ${10 + v * 20}%, ${9 + v * 76}%)`;
        fctx.fillRect(c * cw + 1, (BANDS - 1 - b) * ch + 1, cw - 2, ch - 2);
      }
    }

    // decoder bars
    let best = 0;
    bars.forEach((bar, i) => {
      bar.p += (p[i] - bar.p) * Math.min(1, dt * 8);
      if (bar.p > bars[best].p) best = i;
    });
    bars.forEach((bar, i) => {
      bar.fill.style.width = `${(bar.p * 100).toFixed(1)}%`;
      bar.val.textContent = bar.p.toFixed(2);
      bar.row.classList.toggle('win', i === best);
    });

    // cursor dynamics driven by decoded velocity
    const vx = (bars[1].p - bars[0].p) * 1.4;
    const vy = (bars[3].p - bars[2].p) * 1.4;
    cursor.vx += (vx - cursor.vx) * Math.min(1, dt * 5);
    cursor.vy += (vy - cursor.vy) * Math.min(1, dt * 5);
    cursor.x = Math.min(0.95, Math.max(0.05, cursor.x + cursor.vx * dt + (Math.random() - 0.5) * 0.002));
    cursor.y = Math.min(0.95, Math.max(0.05, cursor.y + cursor.vy * dt + (Math.random() - 0.5) * 0.002));
    const [tx, ty] = targets[target];
    if (Math.hypot(tx - cursor.x, ty - cursor.y) < 0.06) {
      dwell += dt;
      if (dwell > 0.45) {
        dwell = 0;
        stimFlash = 1;
        onSelect?.();
        let n;
        do n = (Math.random() * targets.length) | 0; while (n === target);
        target = n;
      }
    } else dwell = Math.max(0, dwell - dt);

    const { ow, oh } = dims;
    octx.clearRect(0, 0, ow, oh);
    octx.strokeStyle = 'rgba(120,170,220,0.15)';
    octx.strokeRect(0.5, 0.5, ow - 1, oh - 1);
    targets.forEach(([x, y], i) => {
      octx.beginPath();
      octx.arc(x * ow, y * oh, 10, 0, Math.PI * 2);
      octx.strokeStyle = i === target ? '#ffb547' : 'rgba(255,255,255,0.18)';
      octx.lineWidth = i === target ? 2 : 1;
      octx.stroke();
      if (i === target && dwell > 0) {
        octx.beginPath();
        octx.arc(x * ow, y * oh, 10, -Math.PI / 2, -Math.PI / 2 + (dwell / 0.45) * Math.PI * 2);
        octx.strokeStyle = '#3ef0ff';
        octx.lineWidth = 3;
        octx.stroke();
      }
    });
    octx.beginPath();
    octx.arc(cursor.x * ow, cursor.y * oh, 5, 0, Math.PI * 2);
    octx.fillStyle = '#3ef0ff';
    octx.shadowColor = '#3ef0ff';
    octx.shadowBlur = 14;
    octx.fill();
    octx.shadowBlur = 0;

    // decoded text, typed out
    typeAcc += dt;
    const str = PHRASES[phrase];
    if (typeAcc > (chars >= str.length ? 2.2 : 0.07 + Math.random() * 0.05)) {
      typeAcc = 0;
      if (chars >= str.length) {
        phrase = (phrase + 1) % PHRASES.length;
        chars = 0;
      } else chars++;
    }
    textEl.textContent = PHRASES[phrase].slice(0, chars);

    stimFlash = Math.max(0, stimFlash - dt * 1.5);
    stimEl.style.opacity = (0.35 + stimFlash * 0.65).toFixed(2);
    stimEl.classList.toggle('firing', stimFlash > 0.3);
  }

  return { update, resize: size };
}
