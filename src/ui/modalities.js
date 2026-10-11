// Sensing-landscape panel: modality toggles (two streams), one live data
// window per selected modality, and a spatial × temporal resolution map.
import { MODALITIES } from '../config.js';
import { Gen, Scope } from './signals.js';
import { initResolution } from './resolution.js';
import { tint } from '../theme.js';

const TRACE = { non: tint('#5eead4'), inv: tint('#ff6fb1') };
const MAX_DEFAULT = ['eeg', 'ecog'];

function channelsFor(m) {
  if (m.wave === 'hddot') return [{ gen: new Gen('hddot'), color: tint('#ff7a6b'), color2: tint('#7aa8ff') }];
  const c = TRACE[m.stream];
  return [0, 1].map(() => ({ gen: new Gen(m.wave), color: c }));
}

export function initModalities(root, onChange) {
  const selected = new Set(MAX_DEFAULT);
  const list = root.querySelector('.stream-list');
  const rows = new Map(); // id → { el, scope }
  const zoom = initResolution(root.querySelector('.res-zoom'));

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
    zoom.update(selected);
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
