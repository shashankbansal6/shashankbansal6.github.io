// "Powers of ten" resolution zoom for the sensing chapter.
// Three nested views of cortex (10 cm → 1 cm → 1 mm) joined by zoom lines.
// Each selected modality drops a block, to true scale, into the level where it
// is visible, labelled with roughly how many neurons one sample averages over.
// A log time strip below compares each modality's sample window with a spike.
import { MODALITIES } from '../config.js';
import { rng } from '../lib/math.js';
import { tint } from '../theme.js';

const SVG = 'http://www.w3.org/2000/svg';
const COLOR = { non: tint('#5eead4'), inv: tint('#ff6fb1') };
const NEURONS_PER_MM2 = 1e5; // ~16 B neocortical neurons over ~2×10⁵ mm²

// view width in mm for each level
const LEVELS = [
  { span: 100, label: '10 cm' },
  { span: 10, label: '1 cm' },
  { span: 1, label: '1 mm' },
];

const levelFor = (mm) => (mm >= 8 ? 0 : mm >= 0.6 ? 1 : 2);

function neurons(m) {
  if (m.id === 'intra') return '~1–10 neurons';
  const n = m.spatialMM * m.spatialMM * NEURONS_PER_MM2;
  const e = Math.floor(Math.log10(n));
  const lead = Math.round(n / 10 ** e);
  return `~${lead}×10${'⁰¹²³⁴⁵⁶⁷⁸⁹'[e] ?? e} neurons`;
}

export function initResolution(root) {
  const W = 400;
  const box = 116, gap = (W - 3 * box) / 2, top = 16;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'zoom');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Spatial and temporal resolution of the selected modalities, shown as nested zoom levels of cortex');
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };

  const rand = rng(11);
  const x0 = (i) => i * (box + gap);
  const levels = LEVELS.map((L, i) => {
    const g = el('g', { transform: `translate(${x0(i)},${top})` });
    el('text', { x: 0, y: -6, class: 'z-label' }, g).textContent = L.label;
    el('rect', { x: 0, y: 0, width: box, height: box, class: 'z-box' }, g);
    const tex = el('g', { class: 'z-tex' }, g);
    if (i === 0) {
      for (let k = 0; k < 10; k++) {
        const y = 8 + k * 11;
        let d = `M 4 ${y}`;
        for (let x = 4; x <= box - 12; x += 8) d += ` Q ${x + 4} ${y + (rand() - 0.5) * 9} ${x + 8} ${y + (rand() - 0.5) * 3}`;
        el('path', { d }, tex);
      }
    } else if (i === 1) {
      for (let k = 0; k < 170; k++) el('circle', { cx: 3 + rand() * (box - 6), cy: 3 + rand() * (box - 6), r: 1.6 }, tex);
    } else {
      for (let k = 0; k < 56; k++) {
        const cx = 6 + rand() * (box - 12), cy = 6 + rand() * (box - 12);
        el('path', { d: `M ${cx} ${cy - 3} L ${cx + 2.6} ${cy + 2} L ${cx - 2.6} ${cy + 2} Z`, class: 'z-neuron' }, tex);
      }
    }
    const blocks = el('g', {}, g);
    const legend = el('g', { transform: `translate(0,${box + 14})` }, g);
    return { g, blocks, legend, span: L.span };
  });

  // zoom source squares + lines to the next level
  for (let i = 0; i < 2; i++) {
    const s = (LEVELS[i + 1].span / LEVELS[i].span) * box;
    const sx = box - s - 8, sy = box - s - 8;
    el('rect', { x: sx, y: sy, width: s, height: s, class: 'z-src' }, levels[i].g);
    const ax = x0(i) + sx, ay = top + sy, bx = x0(i + 1);
    el('line', { x1: ax + s, y1: ay, x2: bx, y2: top, class: 'z-line' });
    el('line', { x1: ax + s, y1: ay + s, x2: bx, y2: top + box, class: 'z-line' });
  }

  const time = el('g', {});
  root.appendChild(svg);

  function update(selected) {
    const sel = MODALITIES.filter((m) => selected.has(m.id) && !m.offMap);
    const byLevel = [[], [], []];
    sel.forEach((m) => byLevel[levelFor(m.spatialMM)].push(m));

    byLevel.forEach((ms, li) => {
      const L = levels[li];
      L.blocks.replaceChildren();
      L.legend.replaceChildren();
      ms.forEach((m, k) => {
        const size = Math.max(3, (m.spatialMM / L.span) * box);
        const cx = 8 + size / 2 + k * Math.min(26, size + 8);
        const cy = 8 + size / 2 + k * 6;
        el('rect', { x: cx - size / 2, y: cy - size / 2, width: size, height: size, rx: 1.5, class: 'z-block', style: `--c:${COLOR[m.stream]}` }, L.blocks);
        const row = el('g', { transform: `translate(0,${k * 22})` }, L.legend);
        el('rect', { x: 0, y: -7, width: 7, height: 7, rx: 1, class: 'z-block', style: `--c:${COLOR[m.stream]}` }, row);
        el('text', { x: 11, y: 0, class: 'z-name' }, row).textContent = `${m.name} · ${m.spatial}`;
        el('text', { x: 11, y: 11, class: 'z-count' }, row).textContent = neurons(m);
      });
    });

    // temporal dot plot: one row per modality on a shared log axis
    time.replaceChildren();
    const maxLegend = Math.max(1, ...byLevel.map((l) => l.length));
    const ty = top + box + 14 + maxLegend * 22 + 18;
    const ax0 = 84, ax1 = W - 4;
    const tX = (ms) => ax0 + ((Math.log10(ms) + 2) / 6) * (ax1 - ax0);
    el('text', { x: 0, y: ty, class: 'z-label' }, time).textContent = 'One sample spans';
    const axisY = ty + 14;
    for (const [ms, t] of [[0.01, '10 µs'], [1, '1 ms'], [100, '100 ms'], [10000, '10 s']]) {
      el('text', { x: tX(ms), y: axisY - 4, class: 'z-tick', 'text-anchor': 'middle' }, time).textContent = t;
    }
    const rows = sel.length ? sel : [];
    const rowsH = Math.max(1, rows.length) * 13;
    for (const ms of [0.01, 1, 100, 10000]) el('line', { x1: tX(ms), x2: tX(ms), y1: axisY, y2: axisY + rowsH + 4, class: 'z-grid' }, time);
    // a 1 ms spike as the reference
    el('rect', { x: tX(0.5), y: axisY, width: tX(2) - tX(0.5), height: rowsH + 4, class: 'z-spikeband' }, time);
    rows.forEach((m, k) => {
      const y = axisY + 9 + k * 13;
      el('text', { x: 0, y: y + 3, class: 'z-name' }, time).textContent = m.name;
      el('line', { x1: ax0, x2: tX(m.temporalMS), y1: y, y2: y, class: 'z-bar', style: `--c:${COLOR[m.stream]}` }, time);
      el('circle', { cx: tX(m.temporalMS), cy: y, r: 3.5, class: 'z-dot', style: `--c:${COLOR[m.stream]}` }, time);
    });
    el('text', { x: tX(1), y: axisY + rowsH + 14, class: 'z-tick', 'text-anchor': 'middle' }, time).textContent = 'a spike lasts ~1 ms';
    svg.setAttribute('viewBox', `0 0 ${W} ${axisY + rowsH + 20}`);
  }

  return { update };
}
