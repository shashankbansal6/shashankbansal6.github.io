// Learn: the same particle brain as the journey page, but each cortical region is a "dive".
// Scrolling peels the head back layer by layer (scalp → surface → inside); every layer names the
// paper that first described what its sensor sees, and the 3D device labels are clickable.
import '../src/fonts.css';
import '../src/menu.css';
import '../src/styles.css';
import 'lenis/dist/lenis.css';
import '../src/watercolor.css';
import './learn.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import Lenis from 'lenis';
import { adaptiveScale } from '../src/perf.js';
import { fitCards } from '../src/phone.js';

import { sstep, damp, lerp } from '../src/lib/math.js';
import { hemiFrame, ANCHORS } from '../src/scene/anatomy.js';
import { buildBrain } from '../src/scene/brain.js';
import { buildOverlays } from '../src/scene/overlays.js';
import { uTime, uPixelRatio, glowPoints } from '../src/scene/materials.js';
import { WATERCOLOR, PAPER, applyTheme, themed } from '../src/theme.js';
import { watercolorPass } from '../src/scene/watercolor.js';
import { initMenu } from '../src/menu.js';
import { initAnalytics } from '../src/analytics.js';
import { REGIONS, BEATS, FOUNDATIONS } from './content.js';
import { initPopVec } from './popvec.js';
import { esc, link, refsHTML } from './refs.js';
import { worldsNext, initDock } from './worlds-nav.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const mobile = matchMedia('(max-width: 900px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── renderer / scene ─────────────────────────────────────────────────────────
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let dpr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
renderer.setPixelRatio(dpr);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.005, 200);
const root = new THREE.Group();
scene.add(root);

const brain = buildBrain(mobile ? 60000 : 125000);
root.add(brain.points);
const wash = (() => {
  const src = brain.points.geometry.attributes.position;
  const n = 900;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const pal = ['#34507a', '#34507a', '#4f86b8', '#4f86b8', '#b8687c', '#c99a55'].map((h) => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * src.count * 0.8);
    pos.set([src.getX(k), src.getY(k), src.getZ(k)], i * 3);
    pal[Math.floor(Math.random() * pal.length)].toArray(col, i * 3);
  }
  const w = glowPoints(pos, { size: 0.46, opacity: 0.08, twinkle: 0, colors: col });
  root.add(w);
  return w;
})();
themed(() => { wash.visible = WATERCOLOR; });
const { group: overlayGroup, layers } = buildOverlays();
root.add(overlayGroup);
overlayGroup.traverse((o) => (o.renderOrder = Math.max(o.renderOrder, 2)));
{
  const n = 1800;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(14 + Math.random() * 40);
    a.set([v.x, v.y, v.z], i * 3);
  }
  const dust = glowPoints(a, { color: '#57534a', size: 0.09, opacity: 0.7, twinkle: 0.5 });
  scene.add(dust);
  themed(() => {
    dust.material.uniforms.uColor.value.set(WATERCOLOR ? '#8a7d6a' : '#57534a');
    dust.material.uniforms.uOpacity.value = WATERCOLOR ? 0.35 : 0.7;
  });
}

// ── post-processing: one pipeline per theme, built on first use ───────────────
let composer = null;
let bloom = null;
let wc = null;
const pipelines = {};
const clearColor = (hex, linearize) => {
  const c = new THREE.Color(hex);
  renderer.setClearColor(linearize ? c.convertSRGBToLinear() : c, 1);
};
function buildPipeline(wcTheme) {
  if (wcTheme) {
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    const pass = watercolorPass();
    c.addPass(pass);
    c.addPass(new OutputPass());
    return { composer: c, wc: pass, bloom: null };
  }
  if (mobile) return { composer: null, wc: null, bloom: null };
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));
  c.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { gl_FragColor = min(texture2D(tDiffuse, vUv), vec4(1.0)); }',
  }));
  const b = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.0, 0.55);
  c.addPass(b);
  c.addPass(new OutputPass());
  return { composer: c, wc: null, bloom: b };
}
function sizePipeline() {
  const w = innerWidth, h = innerHeight;
  composer?.setSize(w, h);
  bloom?.resolution.set(w / 2, h / 2);
  wc?.uniforms.uRes.value.set(w * dpr, h * dpr);
}
themed(() => {
  const key = WATERCOLOR ? 'wc' : 'ink';
  pipelines[key] ||= buildPipeline(WATERCOLOR);
  ({ composer, wc, bloom } = pipelines[key]);
  clearColor(WATERCOLOR ? PAPER : '#0d0d0c', !!composer);
  sizePipeline();
});

// ── camera views per beat ────────────────────────────────────────────────────
const view = (target, offset, sx = 0, sy = 0, mobileZoom = 1.3) => ({
  target: target.clone(),
  off: new THREE.Spherical().setFromVector3(offset.clone().multiplyScalar(mobile ? mobileZoom : 1)),
  sx: mobile ? 0 : sx,
  sy: mobile ? Math.max(sy, 0.16) : sy,
});
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ecog = layers.ecog;
const ecogN = ecog.center.n;
const motorT = ecog.center.p.clone().lerp(V3(-0.75, 0.95, 0.05), 0.35);
const motorOff = ecogN.clone().multiplyScalar(0.8).add(V3(0, 0.55, 0.35));
const utah = hemiFrame(ANCHORS.utah.side, ANCHORS.utah.dir);
const utahOff = utah.n.clone().add(V3(0.1, 0.35, 0.45));
const visT = V3(0, 0.15, -1.45);
const visOff = V3(-2.7, 2.1, -4.1);
const spT = layers.uecog.center.p;
const spOff = layers.uecog.center.n.clone().add(V3(0.05, 0.15, 0.45));
const HI = { motor: [1, 0, 0], visual: [0, 1, 0], language: [0, 0, 1] };

// per beat: where the camera sits and what is drawn. The card's side decides which way the brain shifts.
const SCENES = {
  'm-scalp': { t: motorT, o: motorOff.clone().setLength(7.2), st: { ov: { eeg: 1, scalp: 0.55 }, brain: 0.55 } },
  'm-surface': { t: motorT, o: motorOff.clone().setLength(4.5), st: { ov: { ecog: 1 }, brain: 1 } },
  'm-inside': { t: utah.p.clone(), o: utahOff.clone().setLength(2.3), st: { ov: { utah: 1 }, brain: 0.8 } },
  'm-neurons': { t: utah.p.clone().addScaledVector(utah.n, -0.04), o: utahOff.clone().setLength(1.25), st: { ov: { utah: 1 }, brain: 0.3, activity: 1 } },
  'v-scalp': { t: visT, o: visOff.clone().multiplyScalar(1.3), st: { ov: { hddot: 1, scalp: 0.55 }, brain: 0.55 } },
  'v-surface': { t: visT, o: visOff.clone(), st: { ov: { visual_array: 1 }, brain: 1 } },
  'v-inside': { t: V3(0, 0.1, -1.75), o: visOff.clone().multiplyScalar(0.5), st: { ov: { visual_array: 1 }, brain: 0.4, activity: 1 } },
  'l-scalp': { t: spT, o: spOff.clone().setLength(8.6), st: { ov: { hddot: 1, scalp: 0.4 }, brain: 0.55 } },
  'l-map': { t: spT, o: spOff.clone().setLength(5.6), st: { ov: {}, brain: 1 } },
  'l-surface': { t: spT, o: spOff.clone().setLength(3.4), st: { ov: { uecog: 1 }, brain: 1 } },
  'l-deep': { t: V3(-0.5, -0.1, 0.05), o: V3(-4.4, 1.1, 1.8), st: { ov: { seeg: 1, uecog: 0.25 }, brain: 0.8 } },
};
const heroZoom = mobile ? 1 : Math.min(0.92, Math.max(0.68, 1.3 / (innerWidth / innerHeight)));
const STAGES = {
  hero: { view: view(V3(0, 0.05, 0), V3(6.0, 2.2, 4.4).multiplyScalar(heroZoom), 0.22, mobile ? 0.24 : 0), state: { drag: 1, activity: 0.7 } },
  outro: { view: view(V3(0, 0, 0), V3(6, 1.8, 8.5), 0.22), state: { brain: 0.5, activity: 0.3 } },
};
for (const b of BEATS) {
  const sc = SCENES[b.id];
  STAGES[b.id] = { view: view(sc.t, sc.o, b.side === 'left' ? 0.2 : -0.2), state: { hi: HI[b.region].map((v) => v * (sc.st.brain < 0.5 ? 0.6 : 1)), drag: 0, ...sc.st } };
}

const LAYER_KEYS = Object.keys(layers);
const SCALARS = ['brain', 'drag', 'activity'];
const DEFAULTS = { brain: 1, activity: 0.4 };
function stateVector(st) {
  const ov = st.ov || {};
  const v = {};
  for (const k of SCALARS) v[k] = st[k] ?? DEFAULTS[k] ?? 0;
  for (const k of LAYER_KEYS) v[`ov_${k}`] = ov[k] ?? 0;
  const hi = st.hi || [0, 0, 0];
  v.h0 = hi[0]; v.h1 = hi[1]; v.h2 = hi[2];
  return v;
}

// ── DOM: stages built from content ───────────────────────────────────────────
const regionNo = {};
const journey = $('#journey');
BEATS.forEach((b) => {
  regionNo[b.region] = (regionNo[b.region] || 0) + 1;
  const R = REGIONS[b.region];
  const sec = document.createElement('section');
  sec.className = 'stage beat';
  sec.id = `s-${b.id}`;
  sec.dataset.stage = b.id;
  sec.dataset.rail = b.step;
  sec.innerHTML = `
    <div class="card ${b.side}">
      <p class="kicker"><span>${R.name.split(' ')[0].toUpperCase().slice(0, 3)} ${regionNo[b.region]}</span>${esc(b.depth)}</p>
      <h2>${esc(b.title)}</h2>
      <p>${esc(b.text)}</p>
      ${b.widget === 'popvec' ? '<canvas class="popvec" aria-label="Population vector: each neuron fires most for its preferred direction"></canvas>' : ''}
      ${refsHTML(b)}
    </div>`;
  journey.appendChild(sec);
});
const sections = [...document.querySelectorAll('.stage')].map((el) => ({
  el, id: el.dataset.stage, cards: [...el.querySelectorAll('.card')], anchor: 0, half: 1, vis: 0,
  beat: BEATS.find((b) => b.id === el.dataset.stage),
}));
const popvec = sections.filter((s) => s.beat?.widget === 'popvec').map((s) => ({ s, w: initPopVec($('.popvec', s.el)) }));

// hero: pick a region
$('#regions').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<button type="button" data-r="${k}" class="reg ${k}"><b>${r.name}</b><span>${r.tagline}</span></button>`).join('')
  + '<a class="reg sensor" href="/learn/sensors/"><b>Sensor design</b><span>Electrodes and the tissue interface</span></a>'
  + '<a class="reg chip" href="/learn/chip/"><b>Chip design</b><span>Adiabatic, neuromorphic, in-memory</span></a>';
$('#next').innerHTML = worldsNext('brain');
initDock('brain');
let hoverRegion = null;
$('#regions').addEventListener('pointerover', (e) => { hoverRegion = e.target.closest('.reg')?.dataset.r ?? null; });
$('#regions').addEventListener('pointerleave', () => { hoverRegion = null; });
$('#regions').addEventListener('click', (e) => {
  const k = e.target.closest('.reg')?.dataset.r;
  const s = sections.find((x) => x.beat?.region === k);
  if (s) scrollToY(s.anchor);
});

// foundations
const F = FOUNDATIONS;
$('#foundations').innerHTML = `
  <p class="kicker">${F.kicker}</p>
  <h2>${esc(F.title)}</h2>
  <div class="topic-body">
    <div class="prose">
      ${F.blocks.map(([h, t]) => `<h3>${esc(h)}</h3><p>${esc(t)}</p>`).join('')}
      <ul class="tags">${F.tags.map(([n, k, mine]) => `<li class="${k}">${esc(n)}${mine ? '<span class="star" title="I work with this">★</span>' : ''}</li>`).join('')}</ul>
      <p class="tagkey"><span class="star">★</span> modalities I work with</p>
    </div>
    <aside class="papers">
      <h3>Start with these papers</h3>
      <ol>${F.papers.map((p) => `<li><span class="yr">${p.year}</span><div><a href="${p.href}" target="_blank" rel="noopener">${esc(p.title)} ↗</a><div class="by">${esc(p.by)} · ${esc(p.venue)}</div><p>${esc(p.why)}</p></div></li>`).join('')}</ol>
    </aside>
  </div>`;
$('#year').textContent = new Date().getFullYear();

// ── layout / anchors ─────────────────────────────────────────────────────────
const contentEl = $('.content');
let keys = [];
function layout() {
  const vh = innerHeight;
  fitCards(mobile, sections.flatMap((x) => x.cards));
  for (const s of sections) {
    if (s.beat) s.el.style.height = `${mobile ? 150 : 170}vh`;
    const top = s.el.getBoundingClientRect().top + scrollY;
    s.half = s.el.offsetHeight / 2;
    s.anchor = s.id === 'hero' ? 0 : top + s.half - vh / 2;
  }
  const contentTop = contentEl.getBoundingClientRect().top + scrollY;
  keys = sections.map((s) => ({ at: s.anchor, stage: STAGES[s.id] }));
  keys.push({ at: contentTop + vh * 0.2, stage: STAGES.outro });
}

const lenis = reduced || mobile || matchMedia('(pointer: coarse)').matches ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: 0 } });
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y, behavior: 'smooth' }));

const rail = $('.rail');
sections.forEach((s) => {
  const li = document.createElement('li');
  li.innerHTML = `<span>${s.el.dataset.rail}</span><i></i>`;
  li.addEventListener('click', () => scrollToY(s.anchor));
  rail.appendChild(li);
  s.rail = li;
});

// the layer stepper under the nav: which region you are in and how deep you have peeled
const stepsEl = $('#steps');
let stepsFor = '';
function renderSteps(active) {
  const key = active.beat ? `${active.beat.region}:${active.id}` : '';
  if (key === stepsFor) return;
  stepsFor = key;
  if (!active.beat) { stepsEl.classList.remove('show'); return; }
  const mine = sections.filter((s) => s.beat?.region === active.beat.region);
  const i = mine.indexOf(active);
  stepsEl.innerHTML = `<span class="sr">${REGIONS[active.beat.region].name}</span><ol>${mine.map((s, j) => `<li class="${j < i ? 'done' : j === i ? 'on' : ''}"><button type="button" data-id="${s.id}">${esc(s.beat.step)}</button></li>`).join('')}</ol>`;
  stepsEl.classList.add('show');
}
stepsEl.addEventListener('click', (e) => {
  const s = sections.find((x) => x.id === e.target.closest('button')?.dataset.id);
  if (s) scrollToY(s.anchor);
});

// ── clickable 3D device labels ───────────────────────────────────────────────
const hotsEl = $('#hots');
const pop = $('#pop');
const hots = [];
sections.forEach((s) => (s.beat?.hot || []).forEach((h) => {
  const L = layers[h.layer];
  const lab = L.labels[h.index || 0];
  if (!lab) return;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `hot ${lab.cls}`;
  el.innerHTML = `<i></i>${esc(h.title)}<b aria-hidden="true">↗</b>`;
  hotsEl.appendChild(el);
  const item = { el, sec: s, layer: L, pos: lab.position, op: 0, def: h };
  el.addEventListener('click', (e) => { e.stopPropagation(); openPop(item); });
  hots.push(item);
}));
let popFor = null;
function openPop(it) {
  popFor = it;
  pop.innerHTML = `<button type="button" class="pop-x" aria-label="Close">×</button><h4>${esc(it.def.title)}</h4><p>${esc(it.def.text)}</p>${it.def.links.length ? `<p class="then">Read</p><ul class="refs2">${it.def.links.map(link).join('')}</ul>` : ''}`;
  pop.hidden = false;
  const r = it.el.getBoundingClientRect();
  const w = Math.min(340, innerWidth - 24);
  pop.style.width = `${w}px`;
  pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left))}px`;
  pop.style.top = `${Math.min(innerHeight - 260, r.bottom + 10)}px`;
}
const closePop = () => { pop.hidden = true; popFor = null; };
pop.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('.pop-x')) closePop(); });
document.addEventListener('click', closePop);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
addEventListener('scroll', () => { if (popFor) closePop(); }, { passive: true });
const hv = new THREE.Vector3();

// ── theme switch (in place, via View Transitions when available) ─────────────
const themeBtns = [...document.querySelectorAll('.theme-switch button')];
const syncSwitch = () => themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === (WATERCOLOR ? 'watercolor' : 'ink'))));
syncSwitch();
let switching = false;
async function switchTheme(next) {
  if (switching || next === (WATERCOLOR ? 'watercolor' : 'ink')) return;
  switching = true;
  const swap = async () => {
    applyTheme(next);
    syncSwitch();
    await Promise.race([document.fonts.ready, wait(350)]);
    layout();
    if (composer) composer.render(0.016); else renderer.render(scene, camera);
  };
  if (!reduced && document.startViewTransition) {
    const t = document.startViewTransition(swap);
    t.ready.catch(() => {});
    await t.finished.catch(() => {});
  } else await swap();
  switching = false;
}
themeBtns.forEach((b) => b.addEventListener('click', () => switchTheme(b.dataset.set)));
initMenu();
initAnalytics();
const navEl = $('.nav');
const menuBtn = $('.menu-btn');
const setMenu = (open) => { navEl.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!navEl.classList.contains('open')); });
$('#site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });
document.documentElement.classList.add('theme-ready');

// ── drag to rotate (the brain is the subject on the hero only) ────────────────
let yaw = 0, pitch = 0, yawVel = 0, dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || cur.drag < 0.3) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yawVel = (e.clientX - lastX) * 0.006;
  yaw += yawVel;
  pitch = Math.max(-0.5, Math.min(0.5, pitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX; lastY = e.clientY;
});
const endDrag = () => (dragging = false);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ── resize ───────────────────────────────────────────────────────────────────
let lastW = 0, lastH = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  if (lastW === w && lastH && Math.abs(h - lastH) < lastH * 0.25 && matchMedia('(pointer: coarse)').matches) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  sizePipeline();
  camera.aspect = w / h;
  uPixelRatio.value = dpr * Math.max(0.7, h / 900);
  layout();
  popvec.forEach((p) => p.w.resize());
}
addEventListener('resize', resize);
resize();

// ── main loop ────────────────────────────────────────────────────────────────
const cur = stateVector(STAGES.hero.state);
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camOff = new THREE.Spherical();
const shift = { x: 0, y: 0 };
let intro = reduced ? 1 : 0;
let first = true;
const clock = new THREE.Timer();
const tmpV = new THREE.Vector3();

function sample(scroll) {
  let i = 0;
  while (i < keys.length - 1 && scroll > keys[i + 1].at) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const raw = b === a ? 0 : Math.max(0, Math.min(1, (scroll - a.at) / (b.at - a.at)));
  const t = sstep(0.18, 0.82, raw);
  const va = a.stage.view, vb = b.stage.view;
  const target = va.target.clone().lerp(vb.target, t);
  const off = new THREE.Spherical(
    Math.exp(lerp(Math.log(va.off.radius), Math.log(vb.off.radius), t)),
    lerp(va.off.phi, vb.off.phi, t),
    va.off.theta + Math.atan2(Math.sin(vb.off.theta - va.off.theta), Math.cos(vb.off.theta - va.off.theta)) * t,
  );
  const sa = stateVector(a.stage.state), sb = stateVector(b.stage.state);
  const st = {};
  for (const k in sa) st[k] = lerp(sa[k], sb[k], t);
  return { target, off, sx: lerp(va.sx, vb.sx, t), sy: lerp(va.sy, vb.sy, t), st };
}

const scaleDown = adaptiveScale({ start: dpr, min: 1, apply: (q) => { dpr = q; renderer.setPixelRatio(q); lastW = 0; resize(); } });
function frame(time) {
  scaleDown(time);
  clock.update(time);
  const dt = Math.max(0, Math.min(0.05, clock.getDelta()));
  uTime.value += dt;
  if (wc) wc.uniforms.uTime.value = uTime.value;
  lenis?.raf(time);
  const scroll = window.scrollY;
  const w = innerWidth, h = innerHeight;

  const s = sample(scroll);
  // hovering a region button on the hero lights that region up
  const hh = hoverRegion ? HI[hoverRegion] : null; // (the chip button has no brain region)
  if (hh) { const k = sections[0].vis; s.st.h0 = lerp(s.st.h0, hh[0], k); s.st.h1 = lerp(s.st.h1, hh[1], k); s.st.h2 = lerp(s.st.h2, hh[2], k); }
  const lam = first ? 1e6 : 5;
  for (const k in s.st) cur[k] = first ? s.st[k] : damp(cur[k], s.st[k], lam, dt);
  if (first) { camTarget.copy(s.target); camOff.copy(s.off); }
  camTarget.x = damp(camTarget.x, s.target.x, 6, dt);
  camTarget.y = damp(camTarget.y, s.target.y, 6, dt);
  camTarget.z = damp(camTarget.z, s.target.z, 6, dt);
  camOff.radius = Math.exp(damp(Math.log(camOff.radius), Math.log(s.off.radius), 6, dt));
  camOff.phi = damp(camOff.phi, s.off.phi, 6, dt);
  camOff.theta += Math.atan2(Math.sin(s.off.theta - camOff.theta), Math.cos(s.off.theta - camOff.theta)) * (1 - Math.exp(-6 * dt));
  shift.x = damp(shift.x, s.sx, 6, dt);
  shift.y = damp(shift.y, s.sy, 6, dt);

  intro = Math.min(1, intro + dt * 0.45);
  const ease = 1 - (1 - intro) ** 3;
  tmpV.setFromSpherical(new THREE.Spherical(camOff.radius * (1 + 0.9 * (1 - ease)), camOff.phi - 0.25 * (1 - ease), camOff.theta + 0.6 * (1 - ease)));
  camPos.copy(camTarget).add(tmpV);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.setViewOffset(w, h, -shift.x * w, shift.y * h, w, h);

  if (!dragging) {
    yawVel *= 0.94;
    yaw += yawVel;
    if (cur.drag < 0.5) { yaw = damp(yaw, 0, 3, dt); pitch = damp(pitch, 0, 3, dt); }
  }
  const sway = reduced ? 0 : Math.sin(uTime.value * 0.18) * 0.35 * cur.drag;
  root.rotation.set(pitch * cur.drag, yaw + sway, 0);
  canvas.className = cur.drag > 0.5 && !mobile ? (dragging ? 'grabbing' : 'grab') : '';

  for (const k of LAYER_KEYS) layers[k].set(cur[`ov_${k}`]);
  const u = brain.material.uniforms;
  u.uHi.value.set(cur.h0, cur.h1, cur.h2);
  u.uOpacity.value = cur.brain;
  if (wash) wash.material.uniforms.uOpacity.value = 0.08 * cur.brain;
  u.uActivity.value = cur.activity;
  u.uRipple.value = -1;

  // cards, rail, stepper
  let active = sections[0];
  let best = Infinity;
  for (const sec of sections) {
    const d = Math.abs(scroll - sec.anchor) / sec.half;
    sec.vis = sec.id === 'hero' ? 1 - sstep(0.15, 0.6, scroll / h) : 1 - sstep(0.62, 0.92, d);
    for (const card of sec.cards) {
      const loose = card.classList.contains('flow');
      card.style.opacity = loose ? '1' : sec.vis.toFixed(3);
      card.style.pointerEvents = loose || sec.vis > 0.3 ? 'auto' : 'none';
    }
    if (d < best) { best = d; active = sec; }
  }
  const pastJourney = scroll > keys[keys.length - 1].at - h * 0.5;
  sections.forEach((sec) => sec.rail.classList.toggle('on', sec === active && !pastJourney));
  rail.classList.toggle('hide', pastJourney || scroll < h * 0.3);
  $('.hero-inner').style.opacity = sections[0].vis.toFixed(3);
  renderSteps(pastJourney ? sections[0] : active);
  popvec.forEach((p) => { if (p.s.vis > 0.01) p.w.step(dt); });

  // hotspots follow their 3D points
  root.updateMatrixWorld();
  for (const it of hots) {
    const target = it.sec.vis * Math.min(1, it.layer.value);
    it.op += (target - it.op) * 0.18;
    if (it.op < 0.02) { it.el.style.opacity = '0'; it.el.style.pointerEvents = 'none'; continue; }
    hv.copy(it.pos).applyMatrix4(root.matrixWorld).project(camera);
    const x = (hv.x * 0.5 + 0.5) * w;
    const y = (-hv.y * 0.5 + 0.5) * h;
    // on phones the card covers the lower third, so labels there would sit on top of its text
    if (hv.z > 1 || (mobile && y > h * 0.4)) { it.el.style.opacity = '0'; it.el.style.pointerEvents = 'none'; continue; }
    it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    it.el.style.opacity = it.op.toFixed(3);
    it.el.style.pointerEvents = it.op > 0.5 ? 'auto' : 'none';
  }

  if (composer) composer.render(dt);
  else renderer.render(scene, camera);

  if (first) {
    first = false;
    $('#loader').classList.add('done');
  }
  requestAnimationFrame(frame);
}

// deep link: ?at=m-inside (a beat id), or a raw scroll offset
const at = new URLSearchParams(location.search).get('at');
function jumpToParam() {
  if (!at) return;
  const sec = sections.find((x) => x.id === at);
  const y = sec ? sec.anchor : Number(at) || 0;
  intro = 1;
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}
jumpToParam();
document.fonts?.ready.then(() => { layout(); jumpToParam(); });
requestAnimationFrame(frame);

if (import.meta.env.DEV) window.__learn = { scene, camera, brain, cur, layers, keys: () => keys, sections, STAGES };
