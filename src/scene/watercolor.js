// Full-screen watercolor pass. The scene is rendered on a paper-colored clear,
// so color / paper = pigment transmittance. This pass then:
//   - wobbles the lookup with low-frequency noise (bleeding, uneven edges)
//   - softens with a small blur (wet-in-wet)
//   - darkens where pigment density changes fast (wet-edge pooling)
//   - modulates density with fine noise (granulation)
//   - multiplies onto a fibrous paper texture.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { PAPER } from '../theme.js';

export function watercolorPass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPaper: { value: new THREE.Color(PAPER) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uRes;
      uniform vec3 uPaper;
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      vec3 tex(vec2 uv) { return texture2D(tDiffuse, uv).rgb; }
      float dens(vec3 c) { return 1.0 - dot(c / uPaper, vec3(0.333)); }

      void main() {
        vec2 px = 1.0 / uRes;
        float aspect = uRes.x / uRes.y;
        vec2 q = vUv * vec2(aspect, 1.0);

        // bleeding: displace lookups with slow noise (drifts very slightly)
        vec2 wob = (vec2(fbm(q * 5.0 + uTime * 0.02), fbm(q * 5.0 + 9.1 - uTime * 0.02)) - 0.5) * 0.0035;
        vec2 uv = vUv + wob;

        // wet-in-wet blur
        vec3 c = tex(uv) * 0.52;
        c += tex(uv + vec2(px.x * 1.4, 0.0)) * 0.12;
        c += tex(uv - vec2(px.x * 1.4, 0.0)) * 0.12;
        c += tex(uv + vec2(0.0, px.y * 1.4)) * 0.12;
        c += tex(uv - vec2(0.0, px.y * 1.4)) * 0.12;

        // wet edges: gradient of pigment density
        float dx = dens(tex(uv + vec2(px.x * 3.0, 0.0))) - dens(tex(uv - vec2(px.x * 3.0, 0.0)));
        float dy = dens(tex(uv + vec2(0.0, px.y * 3.0))) - dens(tex(uv - vec2(0.0, px.y * 3.0)));
        float edge = clamp(length(vec2(dx, dy)) * 2.2, 0.0, 1.0);

        vec3 trans = clamp(c / uPaper, 0.0, 1.2);  // pigment transmittance
        float d = 1.0 - dot(trans, vec3(0.333));
        trans = pow(trans, vec3(1.0 + 0.9 * edge));   // pool pigment at edges
        float gran = fbm(vUv * uRes / 2.6);            // granulation
        trans = mix(trans, trans * trans, clamp((gran - 0.45) * 1.4, 0.0, 1.0) * smoothstep(0.02, 0.3, d));

        // paper: large soft mottling + fine fibers
        float mott = fbm(q * 3.0);
        float fib = fbm(vec2(q.x * 900.0, q.y * 140.0));
        vec3 paper = uPaper * (0.955 + 0.045 * mott) * (0.975 + 0.04 * fib);

        gl_FragColor = vec4(paper * trans, 1.0);
      }`,
  });
}
