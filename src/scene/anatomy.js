// Procedural brain + head geometry shared by the particle brain and every
// device that has to sit on (or in) it.
//
// World axes: +x = subject's right, +y = up, +z = anterior (nose).
// Hemisphere-local directions use lx = lateral (away from midline).
import * as THREE from 'three';
import { sstep } from '../lib/math.js';

export const HEMI = { cx: 0.17, cy: 0.15, cz: 0, rx: 1.15, ry: 1.05, rz: 1.62, medial: 0.12 };
export const SCALP = { cx: 0, cy: 0.12, cz: -0.04, rx: 1.6, ry: 1.45, rz: 2.0 };

export const REGION = { NONE: 0, MOTOR: 1, VISUAL: 2, LANGUAGE: 3 };

// Unit direction in hemisphere-local space → world point on the (unfolded) cortex.
export function hemiPoint(side, lx, ly, lz, out = new THREE.Vector3()) {
  let x = lx < 0 ? lx * HEMI.medial : lx;
  x *= HEMI.rx * (1 - 0.16 * lz * lz);
  let y = ly * HEMI.ry;
  const z = lz * HEMI.rz;
  // flatter base
  if (ly < -0.2) y = -0.2 * HEMI.ry + (ly + 0.2) * HEMI.ry * 0.5;
  // temporal lobe hangs down laterally, mid-front
  const tl = sstep(0.2, 0.75, lx) * Math.exp(-((lz - 0.12) ** 2) / 0.16) * sstep(0.35, -0.45, ly);
  y -= 0.3 * tl;
  x += 0.06 * tl * HEMI.rx;
  // orbitofrontal underside lifts, occipital droops a little
  if (lz > 0.3 && ly < 0) y *= 1 - 0.35 * sstep(0.3, 0.9, lz);
  if (lz < -0.4) y -= 0.08 * sstep(-0.4, -1, lz);
  return out.set(side * (HEMI.cx + x), HEMI.cy + y, HEMI.cz + z);
}

export const hemiCenter = (side) => new THREE.Vector3(side * HEMI.cx, HEMI.cy, HEMI.cz);

// Central sulcus position (local lz) as a function of height.
export const centralSulcusZ = (ly) => -0.08 + 0.25 * (1 - Math.max(0, ly));
// Sylvian fissure height (local ly) as a function of lz.
export const sylvianY = (lz) => -0.2 + (0.6 - lz) * 0.39;

// Elliptical regions with noise-jittered borders so highlights look organic.
const ell = (a, a0, ra, b, b0, rb) => ((a - a0) / ra) ** 2 + ((b - b0) / rb) ** 2 < 1;
export function regionOf(side, lx, ly, lz, jitter = 0) {
  lz += jitter * 0.05;
  ly += jitter * 0.04;
  const cz = centralSulcusZ(ly);
  if (ly > 0.02 + jitter * 0.05 && lz - cz > 0 && lz - cz < 0.17 + jitter * 0.03) return REGION.MOTOR;
  if (lz < -0.82 - jitter * 0.06 && ly > -0.55) return REGION.VISUAL;
  if (side < 0 && lx > 0.45) {
    if (ell(lz, 0.5, 0.17, ly, -0.03, 0.2)) return REGION.LANGUAGE; // Broca
    if (ell(lz, -0.33, 0.18, ly, -0.08, 0.2)) return REGION.LANGUAGE; // Wernicke
  }
  if (lz > 0.76 + jitter * 0.06 && ly > -0.2) return REGION.LANGUAGE; // prefrontal
  return REGION.NONE;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();

// Position + outward normal + surface tangents at a local direction.
export function hemiFrame(side, dir) {
  const d = dir.clone().normalize();
  const p = hemiPoint(side, d.x, d.y, d.z);
  const up = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const t1 = new THREE.Vector3().crossVectors(up, d).normalize();
  const t2 = new THREE.Vector3().crossVectors(d, t1).normalize();
  const e = 1e-3;
  _d.copy(d).addScaledVector(t1, e).normalize();
  hemiPoint(side, _d.x, _d.y, _d.z, _a).sub(p);
  _d.copy(d).addScaledVector(t2, e).normalize();
  hemiPoint(side, _d.x, _d.y, _d.z, _b).sub(p);
  const n = new THREE.Vector3().crossVectors(_a, _b).normalize();
  if (n.dot(p.clone().sub(hemiCenter(side))) < 0) n.negate();
  const u = _a.clone().normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { p, n, u, v, dir: d, t1, t2 };
}

// A grid of frames conforming to the cortex, centred on `dir`.
// `span` is the half-width in direction space.
export function cortexPatch(side, dir, nu, nv, spanU, spanV = spanU) {
  const c = hemiFrame(side, dir);
  const out = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = nu === 1 ? 0 : (i / (nu - 1)) * 2 - 1;
      const b = nv === 1 ? 0 : (j / (nv - 1)) * 2 - 1;
      const d = c.dir.clone().addScaledVector(c.t1, a * spanU).addScaledVector(c.t2, b * spanV).normalize();
      out.push({ ...hemiFrame(side, d), i, j });
    }
  }
  return { center: c, frames: out };
}

export function scalpPoint(dir, out = new THREE.Vector3()) {
  const d = dir.clone().normalize();
  return out.set(SCALP.cx + d.x * SCALP.rx, SCALP.cy + d.y * SCALP.ry, SCALP.cz + d.z * SCALP.rz);
}

export function scalpNormal(dir) {
  const d = dir.clone().normalize();
  return new THREE.Vector3(d.x / SCALP.rx, d.y / SCALP.ry, d.z / SCALP.rz).normalize();
}

// Scalp point radially "above" a world point.
export function scalpAbove(p, lift = 1) {
  const d = new THREE.Vector3(p.x - SCALP.cx, (p.y - SCALP.cy) / lift, p.z - SCALP.cz).normalize();
  return { p: scalpPoint(d), n: scalpNormal(d), dir: d };
}

// Evenly spread directions on the sphere (Fibonacci), filtered.
export function fibonacciDirs(n, keep = () => true) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const d = new THREE.Vector3(Math.cos(g * i) * r, y, Math.sin(g * i) * r);
    if (keep(d)) out.push(d);
  }
  return out;
}

// Directions used by multiple scenes.
export const ANCHORS = {
  ecog: { side: -1, dir: new THREE.Vector3(0.88, 0.45, 0.14) },
  utah: { side: -1, dir: new THREE.Vector3(0.62, 0.78, 0.07) },
  speech: { side: -1, dir: new THREE.Vector3(0.93, -0.06, 0.36) },
};
