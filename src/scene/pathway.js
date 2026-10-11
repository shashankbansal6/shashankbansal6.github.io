// Parallel recording channels: a ribbon of traces from individual ECoG
// electrodes to the chip's edge. Signal pulses flow up each trace (pink/cyan),
// stimulation pulses flow back down (amber).
import * as THREE from 'three';
import { Layer, flowTubes, glowPoints, COLORS } from './materials.js';
import { DIE_SIZE } from './chip.js';

const N_STREAMS = 16;
const PULSES_PER = 3;

export function buildPathway(ecog, chipAnchor) {
  const L = new Layer('signals');
  const c = ecog.center;
  const cn = chipAnchor.n;

  // where the ribbon lands: the die edge that faces the grid
  const toGrid = c.p.clone().sub(chipAnchor.p);
  const inPlane = toGrid.clone().addScaledVector(cn, -toGrid.dot(cn)).normalize();
  const along = new THREE.Vector3().crossVectors(cn, inPlane).normalize();
  const edge = chipAnchor.p.clone().addScaledVector(inPlane, DIE_SIZE * 0.5).addScaledVector(cn, 0.004);

  // pick electrodes spread over the grid (every other row / column)
  const picks = ecog.electrodes.filter((f) => f.i % 2 === 0 && f.j % 2 === 0).slice(0, N_STREAMS);
  // order by position along the ribbon so traces don't cross much
  picks.sort((a, b) => a.p.dot(along) - b.p.dot(along));

  const curves = picks.map((f, k) => {
    const s = (k / (picks.length - 1) - 0.5) * DIE_SIZE * 0.75;
    const start = f.p.clone().addScaledVector(f.n, 0.03);
    const end = edge.clone().addScaledVector(along, s);
    return new THREE.CubicBezierCurve3(
      start,
      start.clone().addScaledVector(f.n, 0.16 + (k % 4) * 0.015),
      end.clone().addScaledVector(inPlane, 0.22).addScaledVector(cn, 0.03),
      end,
    );
  });
  curves.forEach((cv) => cv.arcLengthDivisions = 60);

  L.add(flowTubes(curves, { radius: 0.0035, color: COLORS.magenta, opacity: 0.7, speed: 0.9, freq: 5, sharp: 2 }));

  // signal pulses, a few per channel
  const n = curves.length * PULSES_PER;
  const colors = new Float32Array(n * 3);
  const pink = new THREE.Color('#ff7cc0');
  const cyan = new THREE.Color(COLORS.cyan);
  for (let i = 0; i < n; i++) (i % 3 === 0 ? cyan : pink).toArray(colors, i * 3);
  const up = glowPoints(new Float32Array(n * 3), { size: 0.016, opacity: 1, twinkle: 0, colors });
  const upT = Float32Array.from({ length: n }, () => Math.random());
  const upV = Float32Array.from({ length: n }, () => 0.25 + Math.random() * 0.2);
  L.add(up);

  // stimulation pulses, one per channel
  const down = glowPoints(new Float32Array(curves.length * 3), { color: COLORS.amber, size: 0.03, opacity: 1, twinkle: 0 });
  L.add(down);
  let stim = null;
  const tmp = new THREE.Vector3();

  return {
    layer: L,
    fireStim(onArrive) {
      stim = { t: 0, onArrive, done: false };
    },
    update(dt, flow = 1) {
      if (!L.group.visible) return;
      const a = up.geometry.attributes.position;
      for (let i = 0; i < n; i++) {
        upT[i] = (upT[i] + dt * upV[i] * flow) % 1;
        curves[Math.floor(i / PULSES_PER)].getPointAt(upT[i], tmp);
        a.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      a.needsUpdate = true;

      const d = down.geometry.attributes.position;
      for (let k = 0; k < curves.length; k++) {
        const t = stim ? 1 - (stim.t - (k % 4) * 0.03) : -1;
        if (t >= 0 && t <= 1) curves[k].getPointAt(t, tmp);
        else tmp.set(0, -999, 0);
        d.setXYZ(k, tmp.x, tmp.y, tmp.z);
      }
      d.needsUpdate = true;
      if (stim) {
        stim.t += dt * 1.2;
        if (!stim.done && stim.t > 1) {
          stim.done = true;
          stim.onArrive?.();
        }
        if (stim.t > 1.2) stim = null;
      }
    },
  };
}
