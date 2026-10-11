// Sensing-landscape panel: modality toggles (two streams), one live data
// window per selected modality, and a spatial × temporal resolution map.
import { MODALITIES } from '../config.js';
import { Gen, Scope } from './signals.js';

const TRACE = { non: '#5eead4', inv: '#ff6fb1' };
const SVG = 'http://www.w3.org/2000/svg';
const MAX_DEFAULT = ['eeg', 'ecog'];

function channelsFor(m) {
  if (m.wave === 'hddot') return [{ gen: new Gen('hddot'), color: '#ff7a6b', color2: '#7aa8ff' }];
  const c = TRACE[m.stream];
  return [0, 1].map(() => ({ gen: new Gen(m.wave), color: c }));
}

export function initModalities(root, onChange) {
  const selected = new Set(MAX_DEFAULT);
  const list = root.querySelector('.stream-list');
  const rows = new Map(); // id → { el, scope }

  const cols = {
    non: root.querySelector('[data-stream="non"] .chips'),
    inv: root.querySelector('[data-stream="inv"] .chips'),
  };
  const buttons = {};
  for (const m of MODALITIES) {
    const b = document.createElement('button');
    b.className = `chip ${m.stream}`;
    b.type = 'button';
    b.textContent = m.name;
    b.addEventListener('click', () => toggle(m));
    cols[m.stream].appendChild(b);
    buttons[m.id] = b;
  }

  // ── resolution map ──────────────────────────────────────────────────────
  const W = 300, H = 140, pad = { l: 34, r: 8, t: 8, b: 22 };
  const sx = (ms) => pad.l + ((Math.log10(ms) + 2) / 6) * (W - pad.l - pad.r); // 10 µs … 10 s
  const sy = (mm) => H - pad.b - ((Math.log10(mm) + 2) / 4) * (H - pad.t - pad.b); // 10 µm … 100 mm
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Approximate spatial versus temporal resolution of each modality');
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };
  for (const [ms, t] of [[0.01, '10µs'], [1, '1ms'], [100, '100ms'], [10000, '10s']]) {
    el('line', { x1: sx(ms), x2: sx(ms), y1: pad.t, y2: H - pad.b, class: 'grid' });
    el('text', { x: sx(ms), y: H - 7, class: 'tick', 'text-anchor': 'middle' }).textContent = t;
  }
  for (const [mm, t] of [[0.01, '10µm'], [1, '1mm'], [100, '10cm']]) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: sy(mm), y2: sy(mm), class: 'grid' });
    el('text', { x: pad.l - 4, y: sy(mm) + 3, class: 'tick', 'text-anchor': 'end' }).textContent = t;
  }
  const dots = {};
  for (const m of MODALITIES.filter((x) => !x.offMap)) {
    const g = el('g', { class: `dot ${m.stream}`, tabindex: 0, role: 'button', 'aria-label': m.name });
    const cx = sx(m.temporalMS), cy = sy(m.spatialMM);
    el('circle', { cx, cy, r: 5 }, g);
    const right = cx < W - 80 && !m.labelLeft;
    el('text', { x: cx + (right ? 9 : -9), y: cy + 3.5, 'text-anchor': right ? 'start' : 'end' }, g).textContent = m.name;
    g.addEventListener('click', () => toggle(m));
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && toggle(m));
    dots[m.id] = g;
  }
  root.querySelector('.res-map').appendChild(svg);

  // ── stream windows ──────────────────────────────────────────────────────
  function makeRow(m) {
    const row = document.createElement('div');
    row.className = `stream-row ${m.stream}`;
    row.innerHTML = `
      <div class="sr-head">
        <strong>${m.name}</strong>
        <span class="sr-meta">${m.spatial} · ${m.temporal}</span>
        <button type="button" class="sr-close" aria-label="Remove ${m.name}">×</button>
      </div>
      <p class="sr-desc">${m.measures}. <span>${m.where}.</span></p>
      <canvas></canvas>`;
    row.querySelector('.sr-close').addEventListener('click', () => toggle(m));
    const scope = new Scope(row.querySelector('canvas'), channelsFor(m), {
      pxPerSec: m.wave === 'hddot' ? 30 : m.wave === 'spikes' ? 150 : 70,
      gain: m.wave === 'hddot' ? 0.7 : 0.4,
      grid: false,
    });
    return { el: row, scope };
  }

  function render() {
    const added = [];
    for (const m of MODALITIES) {
      const on = selected.has(m.id);
      buttons[m.id].classList.toggle('on', on);
      buttons[m.id].setAttribute('aria-pressed', String(on));
      dots[m.id]?.classList.toggle('on', on);
      if (on && !rows.has(m.id)) added.push(m.id), rows.set(m.id, makeRow(m));
      if (!on && rows.has(m.id)) {
        rows.get(m.id).el.remove();
        rows.delete(m.id);
      }
    }
    // keep rows in canonical order
    for (const m of MODALITIES) {
      const r = rows.get(m.id);
      if (r) list.appendChild(r.el);
    }
    // size new windows once they're in the DOM
    for (const id of added) rows.get(id).scope.resize();
    list.classList.toggle('empty', rows.size === 0);
    if (!rows.size) list.innerHTML = '<p class="sr-empty">Select a modality above to see its signal.</p>';
    else list.querySelector('.sr-empty')?.remove();
  }

  function toggle(m) {
    if (selected.has(m.id)) selected.delete(m.id);
    else selected.add(m.id);
    render();
    onChange(selected);
  }

  render();
  onChange(selected);

  return {
    selected,
    resize: () => rows.forEach((r) => r.scope.resize()),
    update(dt) {
      rows.forEach((r) => r.scope.step(dt));
    },
  };
}
