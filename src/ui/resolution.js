// "Powers of ten" resolution zoom for the sensing chapter.
// Three nested views of cortex (10 cm → 1 cm → 1 mm) joined by zoom lines.
// Each selected modality drops a block, to true scale, into the level where it
// is visible, labelled with roughly how many neurons one sample averages over.
// Live activity (slowed down): a traveling wave sweeps the 10 cm view, columns
// light up as it crosses the 1 cm view, and in the 1 mm view individual neurons
// fire sparsely; spikes travel along axons to connected neurons, which may fire
// in turn (with refractory periods). The wave raises local firing rates.
import { MODALITIES } from '../config.js';
import { rng } from '../lib/math.js';
import { tint, onTheme } from '../theme.js';

const SVG = 'http://www.w3.org/2000/svg';
const COLOR = { get non() { return tint('#5eead4'); }, get inv() { return tint('#ff6fb1'); } };
const NEURONS_PER_MM2 = 1e5; // ~16 B neocortical neurons over ~2×10⁵ mm²
const LEVELS = [
  { span: 100, label: '10 cm of cortex' },
  { span: 10, label: '1 cm' },
  { span: 1, label: '1 mm' },
];
const levelFor = (mm) => (mm >= 8 ? 0 : mm >= 0.6 ? 1 : 2);

function neurons(m) {
  if (m.id === 'intra') return '~1–10 neurons';
  const n = m.spatialMM * m.spatialMM * NEURONS_PER_MM2;
  const e = Math.floor(Math.log10(n));
  return `~${Math.round(n / 10 ** e)}×10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[e] ?? e} neurons`;
}

export function initResolution(root) {
  const W = 420;
  const box = 122, gap = (W - 3 * box) / 2, top = 20;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'zoom');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Spatial and temporal resolution of the selected modalities, shown as nested zoom levels of cortex with live neural activity');
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };
  const defs = el('defs', {});
  const uid = Math.random().toString(36).slice(2, 7);
  // moving gradient that paints the traveling wave onto the gyri
  const grad = el('linearGradient', { id: `wave-${uid}`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 40, y2: 0 }, defs);
  el('stop', { offset: '0', class: 'z-stop', 'stop-opacity': 0 }, grad);
  el('stop', { offset: '0.5', class: 'z-stop', 'stop-opacity': 0.95 }, grad);
  el('stop', { offset: '1', class: 'z-stop', 'stop-opacity': 0 }, grad);

  const rand = rng(11);
  const x0 = (i) => i * (box + gap);
  const levels = LEVELS.map((L, i) => {
    const g = el('g', { transform: `translate(${x0(i)},${top})` });
    el('text', { x: 0, y: -7, class: 'z-label' }, g).textContent = L.label;
    el('rect', { x: 0, y: 0, width: box, height: box, class: 'z-box' }, g);
    const tex = el('g', { class: 'z-tex' }, g);
    return { g, tex, blocks: null, legend: null, span: L.span };
  });

  // ── level 0: gyri + traveling wave ─────────────────────────────────────
  const gyri = [];
  for (let k = 0; k < 10; k++) {
    const y = 9 + k * 11.5;
    let d = `M 4 ${y}`;
    for (let x = 4; x <= box - 12; x += 8) d += ` Q ${x + 4} ${y + (rand() - 0.5) * 9} ${x + 8} ${y + (rand() - 0.5) * 3}`;
    gyri.push(d);
    el('path', { d }, levels[0].tex);
  }
  const waveG = el('g', { class: 'z-wave', stroke: `url(#wave-${uid})` }, levels[0].g);
  gyri.forEach((d) => el('path', { d }, waveG));

  // ── level 1: columns ───────────────────────────────────────────────────
  const cols = [];
  for (let k = 0; k < 170; k++) {
    const c = { x: 3 + rand() * (box - 6), y: 3 + rand() * (box - 6), v: 0 };
    el('circle', { cx: c.x, cy: c.y, r: 1.7 }, levels[1].tex);
    c.on = el('circle', { cx: c.x, cy: c.y, r: 2.1, class: 'z-on', 'fill-opacity': 0 }, levels[1].g);
    cols.push(c);
  }

  // ── level 2: neurons + axons ───────────────────────────────────────────
  const cells = [];
  for (let k = 0; k < 48; k++) {
    let cx, cy, ok, tries = 0;
    do {
      cx = 8 + rand() * (box - 16); cy = 8 + rand() * (box - 16);
      ok = cells.every((c) => Math.hypot(c.x - cx, c.y - cy) > 11);
    } while (!ok && ++tries < 30);
    cells.push({ x: cx, y: cy, v: 0, refr: 0, out: [] });
  }
  const axonG = el('g', { class: 'z-axons' }, levels[2].g);
  cells.forEach((c, i) => {
    const near = cells
      .map((d, j) => [j, Math.hypot(d.x - c.x, d.y - c.y)])
      .filter(([j, dist]) => j !== i && dist < 32)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [j, dist] of near) {
      c.out.push({ j, dist });
      el('line', { x1: c.x, y1: c.y, x2: cells[j].x, y2: cells[j].y }, axonG);
    }
  });
  const tri = (c, s) => `M ${c.x} ${c.y - s} L ${c.x + s * 0.87} ${c.y + s * 0.6} L ${c.x - s * 0.87} ${c.y + s * 0.6} Z`;
  cells.forEach((c) => {
    el('path', { d: tri(c, 3.4), class: 'z-neuron' }, levels[2].g);
    c.on = el('path', { d: tri(c, 4.2), class: 'z-on', 'fill-opacity': 0 }, levels[2].g);
  });
  const pulsePool = Array.from({ length: 40 }, () => el('circle', { r: 1.6, class: 'z-pulse', cx: -1000, cy: -1000 }, levels[2].g));
  let pulses = []; // { from, to, t, dur }

  // blocks + legends sit above the activity
  levels.forEach((L) => {
    L.blocks = el('g', {}, L.g);
    L.legend = el('g', { transform: `translate(0,${box + 17})` }, L.g);
  });

  // zoom source squares + lines to the next level
  const src = [];
  for (let i = 0; i < 2; i++) {
    const s = (LEVELS[i + 1].span / LEVELS[i].span) * box;
    const sx = box - s - 9, sy = box - s - 9;
    src.push({ x: sx + s / 2, y: sy + s / 2 });
    el('rect', { x: sx, y: sy, width: s, height: s, class: 'z-src' }, levels[i].g);
    const ax = x0(i) + sx, ay = top + sy, bx = x0(i + 1);
    el('line', { x1: ax + s, y1: ay, x2: bx, y2: top, class: 'z-line' });
    el('line', { x1: ax + s, y1: ay + s, x2: bx, y2: top + box, class: 'z-line' });
  }

  const time = el('g', {});
  root.appendChild(svg);

  // ── live activity ──────────────────────────────────────────────────────
  // One wave crosses the 10 cm view every PERIOD seconds (slowed ~10×). The
  // 1 cm view is the zoomed source square, so the wavefront reaches it late in
  // the sweep and crosses it quickly; the 1 mm patch sits inside that.
  const PERIOD = 5.5;
  let clock = 0;
  const fire = (c) => {
    if (c.refr > 0) return;
    c.v = 1;
    c.refr = 0.45;
    for (const o of c.out) {
      if (pulses.length >= pulsePool.length) break;
      pulses.push({ from: c, to: cells[o.j], t: 0, dur: 0.12 + o.dist * 0.012 });
    }
  };

  function tick(dt) {
    clock += dt;
    const phase = (clock % PERIOD) / PERIOD; // 0..1 across the 10 cm view
    const front = -30 + phase * (box + 60); // wavefront x in level-0 coords
    grad.setAttribute('x1', (front - 26).toFixed(1));
    grad.setAttribute('x2', (front + 26).toFixed(1));

    // wavefront in level-1 coords: the level-0 source square spans box/10
    const s0 = box / 10;
    const front1 = ((front - (src[0].x - s0 / 2)) / s0) * box;
    for (const c of cols) {
      const d = Math.abs(c.x - front1);
      const target = Math.exp(-(d * d) / 260) * 0.95;
      if (Math.random() < dt * 0.05) c.v = Math.max(c.v, 0.6); // sporadic local activity
      c.v = Math.max(target, c.v * Math.exp(-dt * 3));
      c.on.setAttribute('fill-opacity', c.v.toFixed(2));
    }

    // wave over the 1 mm patch → higher firing probability
    const s1 = box / 10;
    const front2 = ((front1 - (src[1].x - s1 / 2)) / s1) * box;
    const drive = Math.exp(-((front2 - box / 2) ** 2) / (box * box * 0.35));
    for (const c of cells) {
      c.refr = Math.max(0, c.refr - dt);
      const rate = 0.12 + 2.2 * drive; // spikes per second per neuron (slowed)
      if (Math.random() < rate * dt) fire(c);
      c.v *= Math.exp(-dt * 7);
      c.on.setAttribute('fill-opacity', c.v.toFixed(2));
    }
    // propagate along axons
    pulses = pulses.filter((p) => {
      p.t += dt / p.dur;
      if (p.t >= 1) {
        if (Math.random() < 0.38) fire(p.to);
        return false;
      }
      return true;
    });
    pulsePool.forEach((node, k) => {
      const p = pulses[k];
      if (p) {
        node.setAttribute('cx', (p.from.x + (p.to.x - p.from.x) * p.t).toFixed(1));
        node.setAttribute('cy', (p.from.y + (p.to.y - p.from.y) * p.t).toFixed(1));
      } else node.setAttribute('cx', -1000);
    });
  }

  // ── selection-dependent overlays ───────────────────────────────────────
  let lastSel = new Set();
  function update(selected) {
    lastSel = selected;
    const sel = MODALITIES.filter((m) => selected.has(m.id) && !m.offMap);
    const byLevel = [[], [], []];
    sel.forEach((m) => byLevel[levelFor(m.spatialMM)].push(m));

    byLevel.forEach((ms, li) => {
      const L = levels[li];
      L.blocks.replaceChildren();
      L.legend.replaceChildren();
      ms.forEach((m, k) => {
        const size = Math.max(3.5, (m.spatialMM / L.span) * box);
        const cx = 9 + size / 2 + k * Math.min(26, size + 8);
        const cy = 9 + size / 2 + k * 6;
        el('rect', { x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: 1.5, class: 'z-block', style: `--c:${COLOR[m.stream]}` }, L.blocks);
        const row = el('g', { transform: `translate(0,${k * 42})` }, L.legend);
        el('rect', { x: 0, y: -9, width: 9, height: 9, rx: 1.5, class: 'z-block', style: `--c:${COLOR[m.stream]}` }, row);
        el('text', { x: 14, y: 0, class: 'z-name' }, row).textContent = m.name;
        el('text', { x: 14, y: 17, class: 'z-count' }, row).textContent = neurons(m);
      });
    });

    // temporal dot plot: one row per modality on a shared log axis
    time.replaceChildren();
    const maxLegend = Math.max(1, ...byLevel.map((l) => l.length));
    const ty = top + box + 17 + maxLegend * 42 + 14;
    const ax0 = 150, ax1 = W - 8;
    const tX = (ms) => ax0 + ((Math.log10(ms) + 2) / 6) * (ax1 - ax0);
    el('text', { x: 0, y: ty, class: 'z-label' }, time).textContent = 'One sample spans';
    const axisY = ty + 20;
    for (const [ms, t] of [[0.01, '10µs'], [1, '1ms'], [100, '100ms'], [10000, '10s']]) {
      el('text', { x: tX(ms), y: axisY - 5, class: 'z-tick', 'text-anchor': 'middle' }, time).textContent = t;
    }
    const rowH = 18;
    const rowsH = Math.max(1, sel.length) * rowH;
    for (const ms of [0.01, 1, 100, 10000]) el('line', { x1: tX(ms), x2: tX(ms), y1: axisY, y2: axisY + rowsH + 4, class: 'z-grid' }, time);
    el('rect', { x: tX(0.5), y: axisY, width: tX(2) - tX(0.5), height: rowsH + 4, class: 'z-spikeband' }, time);
    sel.forEach((m, k) => {
      const y = axisY + 12 + k * rowH;
      el('text', { x: 0, y: y + 4, class: 'z-name' }, time).textContent = m.name;
      el('line', { x1: ax0, x2: tX(m.temporalMS), y1: y, y2: y, class: 'z-bar', style: `--c:${COLOR[m.stream]}` }, time);
      el('circle', { cx: tX(m.temporalMS), cy: y, r: 4.5, class: 'z-dot', style: `--c:${COLOR[m.stream]}` }, time);
    });
    el('text', { x: tX(1), y: axisY + rowsH + 20, class: 'z-tick', 'text-anchor': 'middle' }, time).textContent = 'shaded: one spike (~1 ms)';
    svg.setAttribute('viewBox', `0 0 ${W} ${axisY + rowsH + 26}`);
    requestAnimationFrame(fit);
  }

  // shrink the whole figure (not the panel) when it would not fit in the window
  function fit() {
    const card = root.closest('.card');
    if (!card || !svg.isConnected) return;
    svg.style.maxHeight = 'none';
    const limit = parseFloat(getComputedStyle(card).maxHeight);
    const over = card.scrollHeight - (Number.isFinite(limit) ? Math.min(limit, card.clientHeight) : card.clientHeight);
    svg.style.maxHeight = over > 1 ? `${Math.max(120, svg.getBoundingClientRect().height - over)}px` : 'none';
  }
  addEventListener('resize', fit);

  onTheme(() => update(lastSel)); // re-tint the blocks and bars

  return { update, tick };
}
