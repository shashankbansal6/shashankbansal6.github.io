// HTML labels pinned to 3D points; each fades with its layer.
import * as THREE from 'three';
import { setStyle } from '../lib/dom.js';

export function initLabels(container, layers, root, camera) {
  const items = [];
  for (const L of layers) {
    for (const lab of L.labels) {
      const el = document.createElement('div');
      el.className = `label3d ${lab.cls}`;
      el.innerHTML = `<span>${lab.text}</span>`;
      container.appendChild(el);
      items.push({ el, layer: L, pos: lab.position, op: 0 });
    }
  }
  const v = new THREE.Vector3();
  return {
    update(w, h, gate = 1) {
      for (const it of items) {
        const target = it.layer.value > 0.5 ? it.layer.value * gate : 0;
        it.op += (target - it.op) * 0.15;
        if (it.op < 0.01) {
          setStyle(it.el, 'opacity', '0');
          continue;
        }
        v.copy(it.pos).applyMatrix4(root.matrixWorld).project(camera);
        if (v.z > 1) {
          setStyle(it.el, 'opacity', '0');
          continue;
        }
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        setStyle(it.el, 'transform', `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`);
        setStyle(it.el, 'opacity', it.op.toFixed(3));
      }
    },
  };
}
