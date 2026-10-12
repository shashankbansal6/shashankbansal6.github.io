// Sensing-landscape panel: modality toggles (two streams) that place each sensor on the
// brain, a one-line description of the one you are pointing at, and the spatial × temporal
// resolution map. The four modalities the author works with (`mine`) are starred.
import { MODALITIES } from '../config.js';
import { initResolution } from './resolution.js';


export function initModalities(root, onChange) {
  const selected = new Set(['eeg', 'meg', 'intra']);
  const zoom = initResolution(root.querySelector('.res-zoom'));
  const info = root.querySelector('.mod-info');

  const cols = {
    non: root.querySelector('[data-stream="non"] .chips'),
    inv: root.querySelector('[data-stream="inv"] .chips'),
  };
  const buttons = {};
  for (const m of MODALITIES) {
    const b = document.createElement('button');
    b.className = `chip ${m.stream}${m.mine ? ' mine' : ''}`;
    b.type = 'button';
    b.innerHTML = `${m.name}${m.mine ? '<span class="star" title="I work with this" aria-label="I work with this">★</span>' : ''}`;
    b.addEventListener('click', () => toggle(m));
    b.addEventListener('pointerenter', () => describe(m));
    b.addEventListener('focus', () => describe(m));
    cols[m.stream].appendChild(b);
    buttons[m.id] = b;
  }

  function describe(m) {
    info.innerHTML = `<b>${m.full}</b>${m.mine ? ' <span class="mine-tag">★ I work with this</span>' : ''}<span>${m.measures}. ${m.spatial} · ${m.temporal}</span>`;
  }

  function render() {
    for (const m of MODALITIES) {
      const on = selected.has(m.id);
      buttons[m.id].classList.toggle('on', on);
      buttons[m.id].setAttribute('aria-pressed', String(on));
    }
    zoom.update(selected);
  }

  function toggle(m) {
    if (selected.has(m.id)) selected.delete(m.id);
    else selected.add(m.id);
    describe(m);
    render();
    onChange(selected);
  }

  describe(MODALITIES.find((m) => m.id === 'eeg'));
  render();
  onChange(selected);

  return {
    selected,
    update: (dt) => zoom.tick(dt),
  };
}
