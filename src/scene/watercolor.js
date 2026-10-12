// Full-screen watercolor pass. The scene is rendered on a paper-colored clear,
// so color / paper = pigment transmittance. This pass then:
//   - wobbles the lookup with low-frequency noise (bleeding, uneven edges)
//   - softens with a small blur (wet-in-wet)
//   - darkens where pigment density changes fast (wet-edge pooling)
//   - modulates density with fine noise (granulation)
//   - multiplies onto a fibrous paper texture.
// The paper (mottling, fibers) and the granulation never move, so they are drawn once per canvas size into a
// texture instead of being recomputed for every pixel of every frame; only the slow bleeding wobble is live.
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PAPER } from '../theme.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const NOISE = /* glsl */ `
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
  }`;

export function watercolorPass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tPaper: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uPaper: { value: new THREE.Color(PAPER) },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tPaper; // r: mottling, g: fibers, b: granulation (static, one texel per pixel)
      uniform vec2 uRes;
      uniform vec3 uPaper;
      uniform float uTime;
      varying vec2 vUv;
      ${NOISE}
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
        vec3 still = texture2D(tPaper, vUv).rgb;
        float gran = still.b;                          // granulation
        trans = mix(trans, trans * trans, clamp((gran - 0.45) * 1.4, 0.0, 1.0) * smoothstep(0.02, 0.3, d));

        // paper: large soft mottling + fine fibers
        float mott = still.r;
        float fib = still.g;
        vec3 paper = uPaper * (0.955 + 0.045 * mott) * (0.975 + 0.04 * fib);

        gl_FragColor = vec4(paper * trans, 1.0);
      }`,
  });

  // the static layers, at exactly the resolution of the frame they are read into
  const uRes = pass.uniforms.uRes.value;
  const still = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, generateMipmaps: false });
  const bake = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { uRes: pass.uniforms.uRes },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform vec2 uRes;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 q = vUv * vec2(uRes.x / uRes.y, 1.0);
        gl_FragColor = vec4(fbm(q * 3.0), fbm(vec2(q.x * 900.0, q.y * 140.0)), fbm(vUv * uRes / 2.6), 1.0);
      }`,
  }));
  pass.uniforms.tPaper.value = still.texture;
  let baked = '';
  const render = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, ...rest) => {
    const key = `${readBuffer.width}x${readBuffer.height}/${uRes.x}x${uRes.y}`;
    if (key !== baked) {
      baked = key;
      still.setSize(readBuffer.width, readBuffer.height);
      renderer.setRenderTarget(still);
      bake.render(renderer);
    }
    render(renderer, writeBuffer, readBuffer, ...rest);
  };
  return pass;
}

// The final output pass for paper, with the slight saturation boost (CSS `saturate(1.05)`, applied to the sRGB
// result) done here rather than as a CSS filter on the canvas, which would cost the compositor a full-screen pass
// per frame on top of this one.
export function paperOutputPass() {
  const pass = new OutputPass();
  pass.material.fragmentShader = pass.material.fragmentShader.replace(/\}\s*$/, `
    gl_FragColor.rgb = clamp(mix(vec3(dot(gl_FragColor.rgb, vec3(0.213, 0.715, 0.072))), gl_FragColor.rgb, 1.05), 0.0, 1.0);
  }`);
  return pass;
}
