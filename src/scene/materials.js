import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const COLORS = {
  cyan: '#3ef0ff',
  teal: '#5eead4',
  magenta: '#ff4fa3',
  violet: '#a78bfa',
  amber: '#ffb547',
  red: '#ff5a5a',
  white: '#e8f3ff',
};

// Shared clock uniform so every shader animates together.
export const uTime = { value: 0 };
export const uPixelRatio = { value: Math.min(window.devicePixelRatio, 2) };

export function additive(color, opacity = 1, extra = {}) {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...extra,
  });
  m.userData.base = opacity;
  return m;
}

export function lineMat(color, opacity = 1) {
  const m = new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  m.userData.base = opacity;
  return m;
}

// Soft round glowing sprites, size in world units (perspective attenuated).
export function glowPoints(positions, { color = COLORS.cyan, size = 0.05, opacity = 1, twinkle = 0.3, colors } = {}) {
  const geo = new THREE.BufferGeometry();
  const arr = positions instanceof Float32Array ? positions : new Float32Array(positions.flatMap((p) => [p.x, p.y, p.z]));
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const n = arr.length / 3;
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) rand[i] = Math.random();
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  if (colors) geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime, uPixelRatio,
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uOpacity: { value: opacity },
      uTwinkle: { value: twinkle },
    },
    defines: colors ? { USE_ACOLOR: '' } : {},
    vertexShader: /* glsl */ `
      attribute float aRand;
      #ifdef USE_ACOLOR
      attribute vec3 aColor;
      #endif
      uniform float uTime, uSize, uPixelRatio, uTwinkle;
      uniform vec3 uColor;
      varying float vA;
      varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        if (mv.z > -0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        vA = 1.0 - uTwinkle + uTwinkle * sin(uTime * 2.0 + aRand * 31.0);
        #ifdef USE_ACOLOR
        vC = aColor;
        #else
        vC = uColor;
        #endif
        gl_PointSize = min(uSize * uPixelRatio * 600.0 / -mv.z, 64.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vA;
      varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = pow(smoothstep(0.5, 0.0, d), 1.6);
        gl_FragColor = vec4(vC, a * vA * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.userData.base = opacity;
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Line segments with dashes flowing along them (photons, field lines, wires).
// `polylines` is an array of Vector3 arrays.
export function flowLines(polylines, { color = COLORS.cyan, opacity = 1, speed = 0.6, freq = 4, sharp = 3 } = {}) {
  const pos = [];
  const ts = [];
  for (const line of polylines) {
    let total = 0;
    const acc = [0];
    for (let i = 1; i < line.length; i++) acc.push((total += line[i].distanceTo(line[i - 1])));
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      ts.push(acc[i - 1], acc[i]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(ts, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSpeed: { value: speed },
      uFreq: { value: freq },
      uSharp: { value: sharp },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      varying float vT;
      void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uTime, uSpeed, uFreq, uSharp;
      varying float vT;
      void main() {
        float f = fract(vT * uFreq - uTime * uSpeed);
        float a = 0.18 + 0.82 * pow(f, uSharp);
        gl_FragColor = vec4(uColor, a * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.userData.base = opacity;
  const seg = new THREE.LineSegments(geo, mat);
  seg.frustumCulled = false;
  return seg;
}

// Thin tubes with the same flowing-dash look, readable from further away.
export function flowTubes(curves, { radius = 0.004, color = COLORS.magenta, opacity = 1, speed = 0.8, freq = 6, sharp = 2 } = {}) {
  const geo = mergeGeometries(curves.map((c) => new THREE.TubeGeometry(c, 64, radius, 5, false)));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uSpeed: { value: speed },
      uFreq: { value: freq },
      uSharp: { value: sharp },
    },
    vertexShader: /* glsl */ `
      varying float vT;
      void main() {
        vT = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uTime, uSpeed, uFreq, uSharp;
      varying float vT;
      void main() {
        float f = fract(vT * uFreq - uTime * uSpeed);
        float a = 0.25 + 0.75 * pow(f, uSharp);
        gl_FragColor = vec4(uColor, a * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  mat.userData.base = opacity;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// A named layer whose materials fade together.
export class Layer {
  constructor(name) {
    this.name = name;
    this.group = new THREE.Group();
    this.group.name = name;
    this.mats = [];
    this.value = -1;
    this.labels = [];
  }
  // Registers obj's materials for fading; parents it only if it has no parent
  // yet (so objects nested in a transformed sub-group stay where they are).
  add(obj) {
    if (!obj.parent) this.group.add(obj);
    obj.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.userData.base === undefined) m.userData.base = m.uniforms?.uOpacity?.value ?? m.opacity;
        if (!this.mats.includes(m)) this.mats.push(m);
      }
    });
    return obj;
  }
  label(text, position, cls = '') {
    this.labels.push({ text, position: position.clone(), cls });
  }
  set(v) {
    if (Math.abs(v - this.value) < 1e-4) return;
    this.value = v;
    this.group.visible = v > 0.004;
    for (const m of this.mats) {
      const o = m.userData.base * v;
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = o;
      else m.opacity = o;
    }
  }
}

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

// Instanced mesh placed at frames, local `axis` aligned to each normal.
export function instancesAt(geometry, material, frames, { axis = 'z', scale = 1 } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, frames.length);
  frames.forEach((f, i) => {
    _q.setFromUnitVectors(axis === 'z' ? Z : Y, f.n);
    _s.setScalar(f.scale ?? scale);
    _m.compose(f.p, _q, _s);
    mesh.setMatrixAt(i, _m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
