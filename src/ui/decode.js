// Closed-loop finale HUD: neural features → decoder → a person moving a cursor
// across their communication board and selecting what they need. Each
// selection calls `onSelect` (which drives the stimulation pulse in 3D).
import { WATERCOLOR } from '../theme.js';

const CLASSES = ['left', 'right', 'select'];
const ITEMS = ['Water', 'Food', 'Nurse', 'Lights', 'Music'];
const STEP_TIME = 0.55; // seconds of sustained intent to move one item
const DWELL = 0.7; // seconds of "select" intent to choose

export function initDecode(root, { onSelect } = {}) {
  const feat = root.querySelector('.dec-features');
  const fctx = feat.getContext('2d');
  const barsEl = root.querySelector('.dec-bars');
  const boardEl = root.querySelector('.dec-board');
  const textEl = root.querySelector('.dec-text');
  const stimEl = root.querySelector('.dec-stim');

  const bars = CLASSES.map((c) => {
    const row = document.createElement('div');
    row.className = 'bar';
    row.innerHTML = `<span>${c}</span><i><b></b></i><em>0.00</em>`;
    barsEl.appendChild(row);
    return { row, fill: row.querySelector('b'), val: row.querySelector('em'), p: 0.33 };
  });

  boardEl.innerHTML = ITEMS.map((n) => `<div class="db-item"><span>${n}</span><i></i></div>`).join('');
  const cells = [...boardEl.children];

  const CH = 16, BANDS = 6;
  const features = new Float32Array(CH * BANDS);
  let cursor = 0, target = 3, move = 0, dwell = 0, stimFlash = 0, log = 'Thinking about: Lights';
  let dims = null;

  function size() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const r = feat.getBoundingClientRect();
    feat.width = Math.max(1, r.width * dpr);
    feat.height = Math.max(1, r.height * dpr);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dims = { fw: r.width, fh: r.height };
  }

  function intentProbs() {
    const raw = [0.08, 0.08, 0.08];
    raw[target < cursor ? 0 : target > cursor ? 1 : 2] += 0.75;
    for (let i = 0; i < 3; i++) raw[i] += Math.random() * 0.12;
    const s = raw[0] + raw[1] + raw[2];
    return raw.map((v) => v / s);
  }

  function update(dt) {
    if (!dims || !dims.fw) size();
    const p = intentProbs();

    // features: band power per channel; groups of channels tuned to each intent
    for (let c = 0; c < CH; c++) {
      const tuned = p[c % 3] * (c < 9 ? 1.5 : 0.6);
      for (let b = 0; b < BANDS; b++) {
        const hg = b >= 4 ? tuned * 1.5 : b < 2 ? (1 - tuned) * 0.5 : 0.25;
        const k = c * BANDS + b;
        features[k] += (Math.min(1, hg + Math.random() * 0.25) - features[k]) * Math.min(1, dt * 6);
      }
    }
    const { fw, fh } = dims;
    const cw = fw / CH, ch = fh / BANDS;
    for (let c = 0; c < CH; c++) {
      for (let b = 0; b < BANDS; b++) {
        const v = features[c * BANDS + b];
        fctx.fillStyle = WATERCOLOR ? `hsl(${30 - v * 10}, ${20 + v * 30}%, ${90 - v * 62}%)` : `hsl(38, ${10 + v * 20}%, ${9 + v * 76}%)`;
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

    // the decoded intent drives the cursor across the board
    if (best === 2 && cursor === target) {
      dwell += dt;
      if (dwell > DWELL) {
        dwell = 0;
        stimFlash = 1;
        onSelect?.();
        log = `Requested: ${ITEMS[target]} ✓`;
        cells[cursor].classList.remove('chosen');
        void cells[cursor].offsetWidth;
        cells[cursor].classList.add('chosen');
        let n;
        do n = Math.floor(Math.random() * ITEMS.length); while (n === target);
        target = n;
        setTimeout(() => (log = `Thinking about: ${ITEMS[target]}`), 1400);
      }
    } else {
      dwell = Math.max(0, dwell - dt * 2);
      move += dt;
      if (move > STEP_TIME && best !== 2) {
        move = 0;
        cursor = Math.max(0, Math.min(ITEMS.length - 1, cursor + (best === 0 ? -1 : 1)));
      }
    }
    cells.forEach((c, i) => {
      c.classList.toggle('cursor', i === cursor);
      c.classList.toggle('target', i === target);
      c.style.setProperty('--dwell', i === cursor ? (dwell / DWELL).toFixed(3) : 0);
    });
    textEl.textContent = log;

    stimFlash = Math.max(0, stimFlash - dt * 1.5);
    stimEl.style.opacity = (0.35 + stimFlash * 0.65).toFixed(2);
    stimEl.classList.toggle('firing', stimFlash > 0.3);
  }

  return { update, resize: size };
}
