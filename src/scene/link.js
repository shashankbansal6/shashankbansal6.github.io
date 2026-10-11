// Inductive link: implant coil under the scalp, wearable coil above it,
// magnetic field loops coupling them, data up and power/commands down.
import * as THREE from 'three';
import { Layer, additive, lineMat, flowLines, glowPoints, COLORS } from './materials.js';

const Y = new THREE.Vector3(0, 1, 0);

function spiral(r0, r1, turns, y, steps = 400) {
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const a = t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return pts;
}

export const LINK_GAP = 0.5;

export function buildLink(anchor) {
  const L = new Layer('link');
  const g = new THREE.Group();
  g.position.copy(anchor.p);
  g.quaternion.setFromUnitVectors(Y, anchor.n);
  L.group.add(g);
  const H = LINK_GAP;

  const coilA = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiral(0.13, 0.2, 7, -0.01)), lineMat('#ffc977', 0.9));
  const coilB = new THREE.Line(new THREE.BufferGeometry().setFromPoints(spiral(0.13, 0.2, 7, H)), lineMat('#ffc977', 0.9));
  g.add(coilA, coilB);
  L.add(coilA);
  L.add(coilB);

  // wearable housing
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 64).translate(0, H + 0.02, 0), additive('#cfe3ff', 0.07));
  g.add(puck);
  L.add(puck);
  for (const y of [H - 0.02, H + 0.06]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.003, 6, 96), additive('#e8f3ff', 0.22));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
    L.add(ring);
  }
  // decoder chip inside the wearable
  const dec = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.1).translate(0, H + 0.03, 0), additive(COLORS.violet, 0.5));
  g.add(dec);
  L.add(dec);

  // magnetic field loops in planes containing the coil axis
  const loops = [];
  for (let k = 0; k < 10; k++) {
    const phi = (k / 10) * Math.PI * 2;
    const e = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
    for (const rOut of [0.34, 0.48]) {
      const rIn = 0.03;
      const rc = (rIn + rOut) / 2, ar = (rOut - rIn) / 2;
      const ay = H / 2 + 0.1 + (rOut - 0.34) * 0.8;
      const pts = [];
      for (let s = 0; s <= 64; s++) {
        const th = (s / 64) * Math.PI * 2;
        pts.push(e.clone().multiplyScalar(rc + ar * Math.cos(th)).setY(H / 2 + ay * Math.sin(th)));
      }
      loops.push(pts);
    }
  }
  const field = flowLines(loops, { color: '#ffd38a', opacity: 0.4, speed: 0.35, freq: 5, sharp: 4 });
  g.add(field);
  L.add(field);

  // uplink data packets
  const nUp = 28;
  const up = glowPoints(new Float32Array(nUp * 3), { color: COLORS.cyan, size: 0.03, opacity: 1, twinkle: 0 });
  const upT = Float32Array.from({ length: nUp }, () => Math.random());
  const upOff = Array.from({ length: nUp }, () => new THREE.Vector2((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18));
  g.add(up);
  L.add(up);

  // downlink command packets (closed-loop stimulation)
  const nDown = 8;
  const down = glowPoints(new Float32Array(nDown * 3), { color: COLORS.amber, size: 0.05, opacity: 1, twinkle: 0 });
  g.add(down);
  L.add(down);
  let cmd = null;

  L.label('Inductive link · power ↓ data ↑', new THREE.Vector3(0.45, H / 2, 0).applyQuaternion(g.quaternion).add(g.position), 'link');
  L.label('Wearable decoder', new THREE.Vector3(0, H + 0.22, 0).applyQuaternion(g.quaternion).add(g.position), 'link');

  return {
    layer: L,
    top: () => g.localToWorld(new THREE.Vector3(0, H, 0)),
    mid: () => g.localToWorld(new THREE.Vector3(0, H / 2, 0)),
    fireDown(onArrive) {
      cmd = { t: 0, onArrive, done: false };
    },
    update(dt, power = 1) {
      if (!L.group.visible) return;
      field.material.uniforms.uSpeed.value = 0.25 + 0.2 * power;
      const a = up.geometry.attributes.position;
      for (let i = 0; i < nUp; i++) {
        upT[i] = (upT[i] + dt * 0.55) % 1;
        a.setXYZ(i, upOff[i].x * (1 - upT[i] * 0.5), upT[i] * H, upOff[i].y * (1 - upT[i] * 0.5));
      }
      a.needsUpdate = true;
      const d = down.geometry.attributes.position;
      for (let i = 0; i < nDown; i++) {
        let y = -999;
        if (cmd) {
          const t = cmd.t - i * 0.04;
          if (t >= 0 && t <= 1) y = H * (1 - t);
        }
        d.setXYZ(i, 0, y, 0);
      }
      d.needsUpdate = true;
      if (cmd) {
        cmd.t += dt * 1.6;
        if (!cmd.done && cmd.t > 1) {
          cmd.done = true;
          cmd.onArrive?.();
        }
        if (cmd.t > 1.4) cmd = null;
      }
    },
  };
}
