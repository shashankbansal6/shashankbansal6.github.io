// Particle brain: cortex shell with procedural gyri/sulci, cerebellum with
// folia, brainstem, and a faint interior volume. Region tags drive highlights.
import * as THREE from 'three';
import { HEMI, REGION, hemiPoint, hemiCenter, regionOf, centralSulcusZ, sylvianY } from './anatomy.js';
import { noise3 } from '../lib/noise.js';
import { rng, gaussian, sstep } from '../lib/math.js';
import { uTime, uPixelRatio, COLORS } from './materials.js';
import { tint, BLENDING, WATERCOLOR } from '../theme.js';

export function buildBrain(count = 110000) {
  const rand = rng(7);
  const pos = new Float32Array(count * 3);
  const bright = new Float32Array(count);
  const region = new Float32Array(count);
  const rnd = new Float32Array(count);
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const nCortex = Math.floor(count * 0.8);
  const nCereb = Math.floor(count * 0.12);
  const nStem = Math.floor(count * 0.03);

  let i = 0;
  const put = (p, b, r = 0) => {
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    bright[i] = b; region[i] = r; rnd[i] = rand();
    i++;
  };

  // ── cortex ────────────────────────────────────────────────────────────────
  while (i < nCortex) {
    const side = rand() < 0.5 ? -1 : 1;
    dir.set(gaussian(rand), gaussian(rand), gaussian(rand)).normalize();
    const [lx, ly, lz] = [dir.x, dir.y, dir.z];
    if (lx < -0.35 && rand() < 0.6) continue; // thin out the medial wall
    hemiPoint(side, lx, ly, lz, v);

    // folding: ridged multi-octave noise → dark sulci where |n| ≈ 0
    const f = 2.3;
    const n = noise3(v.x * f + side * 11, v.y * f, v.z * f) + 0.5 * noise3(v.x * f * 2.1, v.y * f * 2.1 + 5, v.z * f * 2.1);
    let b = sstep(0.0, 0.32, Math.abs(n));
    // named fissures
    if (ly > -0.1) b *= sstep(0.0, 0.035, Math.abs(lz - centralSulcusZ(ly)));
    if (lx > 0.45 && lz > -0.4 && lz < 0.7) b *= sstep(0.0, 0.05, Math.abs(ly - sylvianY(lz)));
    b *= 0.55 + 0.45 * sstep(-0.1, 0.4, lx); // medial wall dimmer

    // push sulci inward + give the cortex some thickness
    const depth = (1 - b) * 0.07 + rand() * 0.03;
    const c = hemiCenter(side);
    v.sub(c).multiplyScalar(1 - depth / v.length()).add(c);
    put(v, b, regionOf(side, lx, ly, lz, noise3(v.x * 3.1 + 40, v.y * 3.1, v.z * 3.1) * 1.6));
  }

  // ── cerebellum ────────────────────────────────────────────────────────────
  const cc = new THREE.Vector3(0, -0.6, -1.05);
  while (i < nCortex + nCereb) {
    dir.set(gaussian(rand), gaussian(rand), gaussian(rand)).normalize();
    v.set(dir.x * 1.0 * (1 - 0.25 * Math.max(0, dir.z)), dir.y * 0.42, dir.z * 0.6).add(cc);
    if (dir.y > 0.55) continue; // hidden under occipital lobes
    const fol = Math.abs(Math.sin(v.y * 52 + noise3(v.x * 3, v.y * 3, v.z * 3) * 4));
    const b = 0.25 + 0.75 * sstep(0.15, 0.6, fol);
    v.sub(cc).multiplyScalar(1 - (1 - b) * 0.05 - rand() * 0.02).add(cc);
    put(v, b * 0.9);
  }

  // ── brainstem ─────────────────────────────────────────────────────────────
  const s0 = new THREE.Vector3(0, -0.45, -0.35);
  const s1 = new THREE.Vector3(0, -1.75, -0.7);
  while (i < nCortex + nCereb + nStem) {
    const t = rand();
    const a = rand() * Math.PI * 2;
    const r = 0.27 - 0.1 * t;
    v.lerpVectors(s0, s1, t);
    v.x += Math.cos(a) * r;
    v.z += Math.sin(a) * r * 0.85;
    put(v, 0.45 + 0.3 * rand());
  }

  // ── faint interior volume ─────────────────────────────────────────────────
  while (i < count) {
    const side = rand() < 0.5 ? -1 : 1;
    dir.set(gaussian(rand), gaussian(rand), gaussian(rand)).normalize();
    hemiPoint(side, dir.x, dir.y, dir.z, v);
    const c = hemiCenter(side);
    v.sub(c).multiplyScalar(Math.cbrt(rand()) * 0.88).add(c);
    put(v, 0.08 + rand() * 0.1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
  geo.setAttribute('aRegion', new THREE.BufferAttribute(region, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime, uPixelRatio,
      uSize: { value: 15 },
      uOpacity: { value: 1 },
      uHi: { value: new THREE.Vector3() },
      uC1: { value: new THREE.Color(tint(COLORS.cyan)) },
      uC2: { value: new THREE.Color(tint(COLORS.violet)) },
      uC3: { value: new THREE.Color(tint(COLORS.amber)) },
      // watercolor: pale sepia in the sulci → indigo on the gyri
      uBase0: { value: new THREE.Color(WATERCOLOR ? '#a39684' : '#1a2a6c') },
      uBase1: { value: new THREE.Color(WATERCOLOR ? '#2b4673' : '#bfe6ff') },
      uRippleColor: { value: new THREE.Color(tint(COLORS.amber)) },
      uRippleCenter: { value: new THREE.Vector3() },
      uRipple: { value: -1 },
      uActivity: { value: 0.4 },
    },
    vertexShader: /* glsl */ `
      attribute float aBright, aRegion, aRand;
      uniform float uTime, uSize, uPixelRatio, uOpacity, uRipple, uActivity;
      uniform vec3 uHi, uC1, uC2, uC3, uBase0, uBase1, uRippleCenter, uRippleColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        if (mv.z > -0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        float tw = 0.78 + 0.22 * sin(uTime * 1.3 + aRand * 40.0);

        // travelling waves of "activity" + sparse spontaneous firing
        float wave = sin(position.z * 2.2 - uTime * 1.6 + position.y * 1.3) * 0.5 + 0.5;
        float fire = pow(max(0.0, sin(uTime * (0.5 + aRand) + aRand * 300.0)), 60.0) * uActivity;

        vec3 col = mix(uBase0, uBase1, aBright * (0.85 + 0.15 * wave));
        float hi = 0.0;
        vec3 hc = vec3(0.0);
        if (aRegion > 0.5 && aRegion < 1.5) { hi = uHi.x; hc = uC1; }
        else if (aRegion > 1.5 && aRegion < 2.5) { hi = uHi.y; hc = uC2; }
        else if (aRegion > 2.5) { hi = uHi.z; hc = uC3; }
        col = mix(col, hc * (0.6 + 0.7 * aBright), hi * 0.92);
        float anyHi = max(uHi.x, max(uHi.y, uHi.z));
        float dimF = mix(1.0, 0.32, anyHi * (1.0 - hi));

        float rip = 0.0;
        if (uRipple > 0.0) {
          float d = distance(position, uRippleCenter);
          rip = exp(-pow((d - uRipple) / 0.1, 2.0)) * (1.0 - smoothstep(0.2, 1.8, uRipple));
          col = mix(col, uRippleColor, rip);
        }
        #ifdef WATERCOLOR
        col *= 1.0 - fire * 0.5; // firing reads as a darker dab of pigment
        vAlpha = ((0.08 + 0.26 * aBright) * tw * dimF + fire * 0.5 + rip * 0.8 + hi * 0.3) * uOpacity;
        #else
        col += fire * vec3(0.7, 0.95, 1.0);
        vAlpha = ((0.12 + 0.5 * aBright) * tw * dimF + fire * 0.9 + rip + hi * 0.2) * uOpacity * 0.75;
        #endif
        vColor = col;
        float size = uSize * (0.55 + 0.75 * aBright) * (1.0 + hi * 0.5 + rip * 1.6 + fire * 1.4);
        gl_PointSize = min(size * uPixelRatio / -mv.z, 26.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        #ifdef WATERCOLOR
        float a = smoothstep(0.5, 0.34, d) * (0.75 + 0.45 * smoothstep(0.1, 0.45, d));
        gl_FragColor = vec4(vColor * (1.0 - 0.25 * smoothstep(0.2, 0.46, d)), a * vAlpha);
        #else
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * a * vAlpha);
        #endif
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: BLENDING,
    defines: WATERCOLOR ? { WATERCOLOR: '' } : {},
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, material };
}

export { REGION, HEMI };
