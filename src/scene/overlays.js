// Every recording modality as a fadeable 3D layer.
// Non-invasive devices are teal, invasive devices magenta.
import * as THREE from 'three';
import {
  SCALP, ANCHORS, scalpPoint, scalpNormal, scalpAbove, fibonacciDirs, hemiFrame, cortexPatch,
} from './anatomy.js';
import { Layer, additive, lineMat, glowPoints, flowLines, instancesAt, COLORS } from './materials.js';
import { rng } from '../lib/math.js';

const Y = new THREE.Vector3(0, 1, 0);
const NON = COLORS.teal;
const INV = COLORS.magenta;
const METAL = '#ffd6ec';

const isFace = (d) => d.z > 0.5 && d.y < 0.28;

function sheetMesh(frames, nu, nv, lift, material) {
  const pos = [];
  for (const f of frames) pos.push(...f.p.clone().addScaledVector(f.n, lift).toArray());
  const idx = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, material);
}

function sheetOutline(frames, nu, nv, lift, material) {
  const at = (i, j) => frames[j * nu + i].p.clone().addScaledVector(frames[j * nu + i].n, lift);
  const pts = [];
  for (let i = 0; i < nu; i++) pts.push(at(i, 0));
  for (let j = 1; j < nv; j++) pts.push(at(nu - 1, j));
  for (let i = nu - 2; i >= 0; i--) pts.push(at(i, nv - 1));
  for (let j = nv - 2; j >= 0; j--) pts.push(at(0, j));
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), material);
}

const lifted = (frames, lift) => frames.map((f) => ({ ...f, p: f.p.clone().addScaledVector(f.n, lift) }));

function rayToScalp(origin, dir) {
  const p = origin.clone();
  for (let t = 0; t < 4; t += 0.01) {
    p.copy(origin).addScaledVector(dir, t);
    const q = ((p.x - SCALP.cx) / SCALP.rx) ** 2 + ((p.y - SCALP.cy) / SCALP.ry) ** 2 + ((p.z - SCALP.cz) / SCALP.rz) ** 2;
    if (q >= 1) return p;
  }
  return p;
}

// ── scalp shell (context for non-invasive layers) ──────────────────────────
function scalpLayer() {
  const L = new Layer('scalp');
  const dirs = fibonacciDirs(9000, (d) => d.y > -0.42 && !isFace(d));
  const pts = dirs.map((d) => scalpPoint(d));
  L.add(glowPoints(pts, { color: '#7aa7c7', size: 0.012, opacity: 0.35, twinkle: 0.1 }));
  return L;
}

function eegLayer() {
  const L = new Layer('eeg');
  const dirs = fibonacciDirs(118, (d) => d.y > -0.12 && !isFace(d));
  const frames = dirs.map((d) => ({ p: scalpPoint(d), n: scalpNormal(d) }));
  const disc = new THREE.CylinderGeometry(0.05, 0.05, 0.022, 20);
  L.add(instancesAt(disc, additive(NON, 0.55), lifted(frames, 0.01), { axis: 'y' }));
  L.add(glowPoints(lifted(frames, 0.03).map((f) => f.p), { color: NON, size: 0.05, opacity: 0.9 }));
  // cap netting: connect each electrode to its nearest neighbours
  const seg = [];
  const seen = new Set();
  frames.forEach((f, i) => {
    frames
      .map((g, j) => [j, f.p.distanceToSquared(g.p)])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .forEach(([j]) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        seg.push(f.p.clone().addScaledVector(f.n, 0.01), frames[j].p.clone().addScaledVector(frames[j].n, 0.01));
      });
  });
  L.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), lineMat(NON, 0.28)));
  L.label(`EEG cap · ${frames.length} ch`, scalpPoint(new THREE.Vector3(0.3, 1, -0.1)).add(new THREE.Vector3(0, 0.25, 0)), 'non');
  return L;
}

function megLayer() {
  const L = new Layer('meg');
  const k = 1.16;
  const dirs = fibonacciDirs(210, (d) => d.y > -0.22 && !isFace(d));
  const frames = dirs.map((d) => ({ p: scalpPoint(d).sub(new THREE.Vector3(SCALP.cx, SCALP.cy, SCALP.cz)).multiplyScalar(k).add(new THREE.Vector3(SCALP.cx, SCALP.cy, SCALP.cz)), n: scalpNormal(d) }));
  L.add(instancesAt(new THREE.BoxGeometry(0.11, 0.06, 0.11), additive(NON, 0.16), frames, { axis: 'y' }));
  L.add(glowPoints(frames.map((f) => f.p), { color: NON, size: 0.035, opacity: 0.8 }));
  const shell = fibonacciDirs(5000, (d) => d.y > -0.25 && !isFace(d)).map((d) => scalpPoint(d).multiplyScalar(k * 1.04));
  L.add(glowPoints(shell, { color: NON, size: 0.01, opacity: 0.35, twinkle: 0 }));
  L.label('MEG helmet · OPM / SQUID', frames[0].p.clone().add(new THREE.Vector3(0, 0.25, 0)), 'non');
  return L;
}

function hddotLayer() {
  const L = new Layer('hddot');
  const sources = [];
  const detectors = [];
  const arcs = [];
  for (const center of [new THREE.Vector3(0, 0.4, 0.92), new THREE.Vector3(0, 0.34, -0.94)]) {
    const d0 = center.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(Y, d0).normalize();
    const t2 = new THREE.Vector3().crossVectors(d0, t1).normalize();
    const patch = [];
    for (let j = -2; j <= 2; j++) {
      for (let i = -3; i <= 3; i++) {
        const a = (i + (j & 1 ? 0.5 : 0)) * 0.11;
        const d = d0.clone().addScaledVector(t1, a).addScaledVector(t2, j * 0.1).normalize();
        const f = { p: scalpPoint(d), n: scalpNormal(d), src: (i + j) % 2 === 0 };
        patch.push(f);
        (f.src ? sources : detectors).push(f);
      }
    }
    // photon "banana" paths from every source to nearby detectors
    for (const s of patch.filter((f) => f.src)) {
      for (const d of patch.filter((f) => !f.src && f.p.distanceTo(s.p) < 0.36)) {
        const mid = s.p.clone().add(d.p).multiplyScalar(0.5).addScaledVector(s.n, -0.28);
        arcs.push(new THREE.QuadraticBezierCurve3(s.p, mid, d.p).getPoints(20));
      }
    }
  }
  const cyl = new THREE.CylinderGeometry(0.016, 0.016, 0.04, 14);
  L.add(instancesAt(cyl, additive(COLORS.red, 0.4), lifted(sources, 0.02), { axis: 'y' }));
  L.add(instancesAt(cyl, additive(NON, 0.4), lifted(detectors, 0.02), { axis: 'y' }));
  L.add(glowPoints(lifted(sources, 0.05).map((f) => f.p), { color: COLORS.red, size: 0.03, opacity: 0.9 }));
  L.add(glowPoints(lifted(detectors, 0.05).map((f) => f.p), { color: NON, size: 0.026, opacity: 0.8 }));
  L.add(flowLines(arcs, { color: '#ff8a8a', opacity: 0.55, speed: 0.5, freq: 6 }));
  L.label('HD-DOT optodes', sources[0].p.clone().add(new THREE.Vector3(0, 0.3, 0.1)), 'non');
  return L;
}

function semgLayer() {
  const L = new Layer('semg');
  const pads = [];
  const wires = [];
  for (const side of [-1, 1]) {
    const d0 = new THREE.Vector3(side * 0.8, -0.42, 0.44).normalize();
    const t = new THREE.Vector3(0, 1, 0).cross(d0).normalize();
    for (const k of [-1, 1]) {
      const d = d0.clone().addScaledVector(t, k * 0.07).normalize();
      const f = { p: scalpPoint(d).addScaledVector(scalpNormal(d), 0.015), n: scalpNormal(d) };
      pads.push(f);
      const end = new THREE.Vector3(side * 1.1, -1.7, 0.2 + k * 0.05);
      const mid = f.p.clone().addScaledVector(f.n, 0.3).add(new THREE.Vector3(0, -0.4, 0));
      wires.push(new THREE.QuadraticBezierCurve3(f.p, mid, end).getPoints(24));
    }
  }
  L.add(instancesAt(new THREE.BoxGeometry(0.13, 0.016, 0.07), additive(NON, 0.6), pads, { axis: 'y' }));
  L.add(glowPoints(pads.map((f) => f.p), { color: NON, size: 0.06, opacity: 0.8 }));
  L.add(flowLines(wires, { color: NON, opacity: 0.5, speed: -0.7, freq: 5 }));
  L.label('sEMG · jaw & face', pads[3].p.clone().add(new THREE.Vector3(0.25, -0.15, 0.1)), 'non');
  return L;
}

// ── invasive ───────────────────────────────────────────────────────────────
function gridLayer(name, anchor, n, span, elR, labelText) {
  const L = new Layer(name);
  const el = cortexPatch(anchor.side, anchor.dir, n, n, span);
  const sheet = cortexPatch(anchor.side, anchor.dir, 12, 12, span * 1.18);
  L.add(sheetMesh(sheet.frames, 12, 12, 0.02, additive(INV, 0.09)));
  L.add(sheetOutline(sheet.frames, 12, 12, 0.02, lineMat(INV, 0.7)));
  const disc = new THREE.CylinderGeometry(elR, elR, 0.008, 16);
  L.add(instancesAt(disc, additive(METAL, 0.4), lifted(el.frames, 0.024), { axis: 'y' }));
  L.add(glowPoints(lifted(el.frames, 0.03).map((f) => f.p), { color: INV, size: elR * 1.5, opacity: 0.7 }));
  L.label(labelText, el.center.p.clone().addScaledVector(el.center.n, 0.35), 'inv');
  L.center = el.center;
  L.electrodes = el.frames;
  return L;
}

function seegLayer() {
  const L = new Layer('seeg');
  const leads = [
    { target: new THREE.Vector3(-0.55, -0.42, -0.25), dir: new THREE.Vector3(-1, 0.18, -0.05) },
    { target: new THREE.Vector3(-0.5, -0.36, 0.25), dir: new THREE.Vector3(-1, 0.25, 0.15) },
    { target: new THREE.Vector3(-0.42, 0.08, 0.1), dir: new THREE.Vector3(-1, 0.35, 0.05) },
    { target: new THREE.Vector3(0.55, -0.42, -0.2), dir: new THREE.Vector3(1, 0.2, -0.1) },
    { target: new THREE.Vector3(0.12, 0.55, 0.3), dir: new THREE.Vector3(0.35, 1, 0.1) },
  ];
  const contacts = [];
  const contactFrames = [];
  for (const { target, dir } of leads) {
    dir.normalize();
    const entry = rayToScalp(target, dir).addScaledVector(dir, 0.18);
    const tube = new THREE.TubeGeometry(new THREE.LineCurve3(target, entry), 1, 0.007, 8);
    L.add(new THREE.Mesh(tube, additive(INV, 0.45)));
    for (let k = 0; k < 10; k++) {
      const p = target.clone().addScaledVector(dir, 0.02 + k * 0.06);
      contacts.push(p);
      contactFrames.push({ p, n: dir });
    }
  }
  L.add(instancesAt(new THREE.CylinderGeometry(0.013, 0.013, 0.026, 12), additive(METAL, 0.9), contactFrames, { axis: 'y' }));
  L.add(glowPoints(contacts, { color: INV, size: 0.035, opacity: 1 }));
  L.label('sEEG depth leads', leads[0].target.clone().add(new THREE.Vector3(-1.2, 0.55, 0)), 'inv');
  return L;
}

function intracorticalLayer() {
  const L = new Layer('utah');
  // Utah-style needle array, left hand-knob
  const f = hemiFrame(ANCHORS.utah.side, ANCHORS.utah.dir);
  const q = new THREE.Quaternion().setFromUnitVectors(Y, f.n);
  const plateC = f.p.clone().addScaledVector(f.n, 0.04);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.014, 0.11), additive(INV, 0.35));
  plate.position.copy(plateC);
  plate.quaternion.copy(q);
  L.add(plate);
  const needles = [];
  const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const ez = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 10; i++) {
      const p = plateC.clone().addScaledVector(ex, (i - 4.5) * 0.0105).addScaledVector(ez, (j - 4.5) * 0.0105).addScaledVector(f.n, -0.035);
      needles.push({ p, n: f.n });
    }
  }
  L.add(instancesAt(new THREE.CylinderGeometry(0.0022, 0.0006, 0.056, 5), additive(METAL, 0.8), needles, { axis: 'y' }));
  L.add(glowPoints(needles.map((n) => n.p.clone().addScaledVector(f.n, -0.026)), { color: INV, size: 0.008, opacity: 1 }));
  const ped = scalpAbove(f.p);
  L.add(flowLines([new THREE.QuadraticBezierCurve3(plateC, plateC.clone().addScaledVector(f.n, 0.25).add(new THREE.Vector3(0, 0.1, -0.15)), ped.p).getPoints(30)], { color: INV, opacity: 0.6, speed: 0.8 }));
  L.label('Utah-style array · 100 needles', plateC.clone().addScaledVector(f.n, 0.3).add(new THREE.Vector3(0, 0.12, 0)), 'inv');

  // flexible polymer threads from a coin-sized implant, right motor cortex
  const rand = rng(42);
  const rightDir = ANCHORS.utah.dir.clone().setZ(0.02);
  const rf = hemiFrame(1, rightDir);
  const coin = scalpAbove(rf.p);
  const coinC = coin.p.clone().addScaledVector(coin.n, -0.05);
  const cq = new THREE.Quaternion().setFromUnitVectors(Y, coin.n);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 48), additive('#cfe3ff', 0.22));
  disc.position.copy(coinC);
  disc.quaternion.copy(cq);
  L.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.004, 8, 64), additive('#e8f3ff', 0.8));
  ring.position.copy(coinC);
  ring.quaternion.copy(cq).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  L.add(ring);
  const targets = cortexPatch(1, rightDir, 8, 5, 0.17, 0.11).frames;
  const threads = [];
  const tips = [];
  for (const t of targets) {
    const a = rand() * Math.PI * 2;
    const start = coinC.clone()
      .addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(cq), Math.cos(a) * 0.05)
      .addScaledVector(new THREE.Vector3(0, 0, 1).applyQuaternion(cq), Math.sin(a) * 0.05)
      .addScaledVector(coin.n, -0.02);
    const surf = t.p.clone().addScaledVector(t.n, 0.01);
    const tip = t.p.clone().addScaledVector(t.n, -0.06);
    const mid = start.clone().lerp(surf, 0.5).addScaledVector(t.n, 0.08 + rand() * 0.05);
    const pts = new THREE.QuadraticBezierCurve3(start, mid, surf).getPoints(18);
    pts.push(tip);
    threads.push(pts);
    for (let k = 0; k < 4; k++) tips.push(surf.clone().lerp(tip, 0.3 + k * 0.22));
  }
  L.add(flowLines(threads, { color: '#ff9fd0', opacity: 0.6, speed: 0.9, freq: 8 }));
  L.add(glowPoints(tips, { color: INV, size: 0.012, opacity: 1 }));
  L.label('Flexible threads', coinC.clone().addScaledVector(coin.n, 0.3), 'inv');
  return L;
}

function visualArrayLayer() {
  const L = new Layer('visual_array');
  const tiles = [];
  const wires = [];
  const conn = scalpPoint(new THREE.Vector3(0, 0.62, -0.78));
  for (const side of [-1, 1]) {
    for (const d of [new THREE.Vector3(0.12, 0.2, -0.97), new THREE.Vector3(0.33, 0.0, -0.94), new THREE.Vector3(0.08, -0.12, -0.99)]) {
      const f = hemiFrame(side, d);
      const q = new THREE.Quaternion().setFromUnitVectors(Y, f.n);
      const c = f.p.clone().addScaledVector(f.n, 0.03);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.01, 0.075), additive(INV, 0.4));
      plate.position.copy(c);
      plate.quaternion.copy(q);
      L.add(plate);
      const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const ez = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) tiles.push(c.clone().addScaledVector(ex, (i - 2.5) * 0.011).addScaledVector(ez, (j - 2.5) * 0.011));
      wires.push(new THREE.QuadraticBezierCurve3(c, c.clone().addScaledVector(f.n, 0.3), conn).getPoints(24));
    }
  }
  L.add(glowPoints(tiles, { color: INV, size: 0.01, opacity: 1 }));
  L.add(flowLines(wires, { color: INV, opacity: 0.55, speed: -0.8, freq: 6 }));
  L.label('Cortical visual prosthesis', conn.clone().add(new THREE.Vector3(0, 0.3, -0.2)), 'inv');
  return L;
}

export function buildOverlays() {
  const layers = {
    scalp: scalpLayer(),
    eeg: eegLayer(),
    meg: megLayer(),
    hddot: hddotLayer(),
    semg: semgLayer(),
    ecog: gridLayer('ecog', ANCHORS.ecog, 8, 0.19, 0.012, 'ECoG grid · 64 ch'),
    uecog: gridLayer('uecog', ANCHORS.speech, 16, 0.13, 0.0042, 'High-density µECoG · 256 ch'),
    seeg: seegLayer(),
    utah: intracorticalLayer(),
    visual_array: visualArrayLayer(),
  };
  const group = new THREE.Group();
  for (const L of Object.values(layers)) {
    group.add(L.group);
    L.set(0);
  }
  return { group, layers };
}
