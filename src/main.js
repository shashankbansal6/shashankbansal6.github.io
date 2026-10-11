import './styles.css';
import 'lenis/dist/lenis.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import Lenis from 'lenis';
import gsap from 'gsap';

import { CHIP, MODALITIES, PROFILE, EXPERIENCE, RESEARCH, PUBLICATIONS, HONORS, totalPowerMW } from './config.js';
import { sstep, damp, lerp } from './lib/math.js';
import { scalpAbove } from './scene/anatomy.js';
import { buildBrain } from './scene/brain.js';
import { buildOverlays } from './scene/overlays.js';
import { buildPathway } from './scene/pathway.js';
import { buildChip } from './scene/chip.js';
import { buildLink, LINK_GAP } from './scene/link.js';
import { uTime, uPixelRatio, glowPoints } from './scene/materials.js';
import { Gen, Scope } from './ui/signals.js';
import { initModalities } from './ui/modalities.js';
import { initDecode } from './ui/decode.js';
import { initLabels } from './ui/labels.js';
import { initSpikeSorter } from './game/spikesorter.js';
import { WATERCOLOR, PAPER, tint, applyTheme, themed, onTheme } from './theme.js';
import { watercolorPass } from './scene/watercolor.js';

import './watercolor.css'; // every rule is scoped to [data-theme='watercolor']

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const mobile = matchMedia('(max-width: 900px)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);

// ── renderer / scene ─────────────────────────────────────────────────────────
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const dpr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
renderer.setPixelRatio(dpr);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.005, 200);
const root = new THREE.Group();
scene.add(root);

const brain = buildBrain(mobile ? 60000 : 125000);
root.add(brain.points);
// watercolor underpainting: large, faint washes scattered over the cortex (paper theme only)
const wash = (() => {
  const src = brain.points.geometry.attributes.position;
  const n = 900;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  // indigo, cerulean, rose madder, yellow ochre — weighted toward the cool blues
  const pal = ['#34507a', '#34507a', '#4f86b8', '#4f86b8', '#b8687c', '#c99a55'].map((h) => new THREE.Color(h));
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * src.count * 0.8); // cortex particles come first
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
const ecog = layers.ecog;
const chipAnchor = scalpAbove(ecog.center.p.clone().add(new THREE.Vector3(0.25, 0.45, -0.4)));
const chip = buildChip(chipAnchor);
const pathway = buildPathway(ecog, chipAnchor);
const link = buildLink(chipAnchor);
root.add(chip.layer.group, pathway.layer.group, link.layer.group);
// hardware paints over the brain (matters for normal-blended watercolor)
for (const g of [overlayGroup, pathway.layer.group, link.layer.group]) g.traverse((o) => (o.renderOrder = Math.max(o.renderOrder, 2)));
chip.layer.set(0);
pathway.layer.set(0);
link.layer.set(0);

// distant dust for depth
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
    // paint every frame through the watercolor pass (cheap enough for mobile too)
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, camera));
    const pass = watercolorPass();
    c.addPass(pass);
    c.addPass(new OutputPass());
    return { composer: c, wc: pass, bloom: null };
  }
  if (mobile || new URLSearchParams(location.search).get('bloom') === '0') return { composer: null, wc: null, bloom: null };
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));
  // Thousands of additive particles push HDR values far above 1; clamp them so
  // the bloom's widest mip doesn't smear a grey haze across the whole screen.
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
  // The clear into a composer's render target gets sRGB-encoded and then OutputPass
  // encodes again, so pre-linearize once more to keep the page on-palette.
  clearColor(WATERCOLOR ? PAPER : '#0d0d0c', !!composer);
  sizePipeline();
});

// ── camera keyframes + scene state per chapter ───────────────────────────────
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const cn = chipAnchor.n;
let tH = new THREE.Vector3().crossVectors(cn, UP).normalize();
if (tH.dot(FWD) < 0) tH.negate();

// Narrow screens need the camera further back to fit the same subject.
const view = (target, offset, sx = 0, sy = 0, mobileZoom = 1.3) => ({
  target: target.clone(),
  off: new THREE.Spherical().setFromVector3(offset.clone().multiplyScalar(mobile ? mobileZoom : 1)),
  sx: mobile ? 0 : sx,
  sy: mobile ? Math.max(sy, 0.16) : sy,
});
const ecogN = ecog.center.n;
const motorT = ecog.center.p.clone().lerp(new THREE.Vector3(-0.75, 0.95, 0.05), 0.35);

// Wide desktop screens: bring the hero camera closer so the brain fills more of the view.
const heroZoom = mobile ? 1 : Math.min(0.92, Math.max(0.68, 1.3 / (innerWidth / innerHeight)));

const STAGES = {
  hero: { view: view(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(6.0, 2.2, 4.4).multiplyScalar(heroZoom), 0.22, mobile ? 0.24 : 0), state: { drag: 1, activity: 0.7 } },
  landscape: { view: view(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(-6.4, 3.4, 8.0), 0.02), state: { drag: 1, manual: true } },
  motor: { view: view(motorT, ecogN.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, 0.55, 0.35)).setLength(4.5), -0.2), state: { hi: [1, 0, 0], ov: { ecog: 1, utah: 1 } } },
  visual: { view: view(new THREE.Vector3(0, 0.15, -1.45), new THREE.Vector3(-2.7, 2.1, -4.1), 0.2), state: { hi: [0, 1, 0], ov: { visual_array: 1, hddot: 1, scalp: 0.5 } } },
  language: { view: view(layers.uecog.center.p, layers.uecog.center.n.clone().add(new THREE.Vector3(0.05, 0.15, 0.45)).setLength(4.4), -0.2), state: { hi: [0, 0, 1], ov: { uecog: 1, hddot: 0.6, scalp: 0.35 } } },
  signals: { view: view(ecog.center.p.clone().lerp(chipAnchor.p, 0.45), ecogN.clone().add(new THREE.Vector3(0, 0.3, 0.7)).setLength(2.0), 0.18), state: { hi: [0.7, 0, 0], ov: { ecog: 1 }, sig: 1, chip: 1, brain: 0.9 } },
  chip: { view: view(chipAnchor.p, cn.clone().add(tH.clone().multiplyScalar(0.3)).add(UP.clone().multiplyScalar(0.12)).setLength(0.44), -0.17, 0, 2.2), state: { sig: 1, chip: 1, brain: 0.3, hover: 1 } },
  link: { view: view(chipAnchor.p.clone().addScaledVector(cn, LINK_GAP / 2), tH.clone().add(cn.clone().multiplyScalar(0.3)).add(UP.clone().multiplyScalar(0.15)).setLength(1.45), 0.18), state: { ov: { ecog: 0.3 }, sig: 0.6, chip: 1, link: 1, brain: 0.5 } },
  decode: { view: view(new THREE.Vector3(-0.75, 0.65, 0.05), new THREE.Vector3(-4.6, 2.6, 3.6), 0, 0.17), state: { hi: [0.6, 0, 0], ov: { ecog: 1 }, sig: 1, chip: 1, link: 1, loop: 1 } },
  outro: { view: view(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 1.8, 8.5), 0.22), state: { brain: 0.5, activity: 0.3 } },
};

const LAYER_KEYS = Object.keys(layers);
const SCALARS = ['brain', 'chip', 'sig', 'link', 'loop', 'drag', 'activity', 'hover'];
const DEFAULTS = { brain: 1, activity: 0.4 };
let manualOverlays = {};

function stateVector(st) {
  const ov = st.manual ? manualOverlays : st.ov || {};
  const v = {};
  for (const k of SCALARS) v[k] = st[k] ?? DEFAULTS[k] ?? 0;
  for (const k of LAYER_KEYS) v[`ov_${k}`] = ov[k] ?? 0;
  const hi = st.hi || [0, 0, 0];
  v.h0 = hi[0]; v.h1 = hi[1]; v.h2 = hi[2];
  return v;
}

// ── DOM: sections, anchors, rail ─────────────────────────────────────────────
const sections = [...document.querySelectorAll('.stage')].map((el) => ({
  el, id: el.dataset.stage, cards: [...el.querySelectorAll('.card')], anchor: 0, half: 1, vis: 0,
}));
const contentEl = $('.content');
let keys = [];

function layout() {
  const vh = innerHeight;
  for (const s of sections) {
    const top = s.el.getBoundingClientRect().top + scrollY;
    s.half = s.el.offsetHeight / 2;
    s.anchor = s.id === 'hero' ? 0 : top + s.half - vh / 2;
  }
  const contentTop = contentEl.getBoundingClientRect().top + scrollY;
  keys = sections.map((s) => ({ at: s.anchor, stage: STAGES[s.id] }));
  keys.push({ at: contentTop + vh * 0.2, stage: STAGES.outro });
}

const rail = $('.rail');
sections.forEach((s) => {
  const li = document.createElement('li');
  li.innerHTML = `<span>${s.el.dataset.rail}</span><i></i>`;
  li.addEventListener('click', () => scrollToY(s.anchor));
  rail.appendChild(li);
  s.rail = li;
});

// ── smooth scroll ─────────────────────────────────────────────────────────────
const lenis = reduced ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: 0 } });
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y }));
document.querySelectorAll('a[href="#s-landscape"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToY(sections.find((s) => s.id === 'landscape').anchor);
  }),
);

// ── UI modules ────────────────────────────────────────────────────────────────
const modalities = initModalities($('#s-landscape'), (sel) => {
  manualOverlays = {};
  let non = false;
  for (const id of sel) {
    const m = MODALITIES.find((x) => x.id === id);
    manualOverlays[m.overlay] = 1;
    if (m.stream === 'non' && m.id !== 'meg') non = true;
  }
  if (non) manualOverlays.scalp = 0.7;
});

const sigChannels = Array.from({ length: 12 }, (_, i) => ({ gen: new Gen('neural', i * 0.37), color: '' }));
themed(() => sigChannels.forEach((ch, i) => {
  ch.color = WATERCOLOR ? `hsl(${200 + i * 7}, 45%, ${28 + (i % 3) * 5}%)` : `hsl(${185 + i * 8}, 95%, ${62 + (i % 3) * 6}%)`;
}));
const sigScope = new Scope($('.sig-scope'), sigChannels, { pxPerSec: 110, gain: 0.55 });

let ripple = -1;
const decode = initDecode($('#s-decode'), {
  onSelect: () => {
    if (cur.loop < 0.5) return;
    link.fireDown(() => pathway.fireStim(() => (ripple = 0)));
  },
});
brain.material.uniforms.uRippleCenter.value.copy(ecog.center.p);

const labels = initLabels($('#labels'), [...Object.values(layers), link.layer], root, camera);

// chip stats + specs from config
const fmt = (v, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const statTargets = {
  channels: [CHIP.channels, 0],
  ppc: [CHIP.powerPerChannelUW, 1],
  nef: [CHIP.nef, 1],
  total: [totalPowerMW(), 2],
};
let statsShown = false;
function showStats() {
  statsShown = true;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const [v, d] = statTargets[el.dataset.count];
    const o = { v: 0 };
    gsap.to(o, { v, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v, d)) });
  });
}
$('.chip-note').textContent = `Test setup: ${CHIP.testbed}.`;
$('.link-specs').innerHTML = `
  <dt>Power</dt><dd class="down">↓ inductive, wearable → implant</dd>
  <dt>Data</dt><dd class="up">↑ backscatter, implant → wearable</dd>
  <dt>Implant</dt><dd>no battery, no percutaneous wires</dd>`;

// about, research, publications, experience
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const linkList = PROFILE.links.map((l) => `<a href="${l.href}">${l.label}</a>`).join('') + `<a href="mailto:${PROFILE.email}">Email</a>`;
$('#profile-links').innerHTML = linkList;
$('#footer-links').innerHTML = linkList;
$('#honors').innerHTML = HONORS.map((h) => `<li class="${h.img ? 'has-img' : ''}">
  ${h.img ? `<button type="button" class="honor-img" data-full="${h.img}" data-alt="${esc(h.alt || h.text)}" aria-label="View certificate larger"><img src="${h.img}" alt="${esc(h.alt || h.text)}" loading="lazy" onerror="this.closest('button').remove()" /></button>` : ''}
  <div><span>${h.year}</span>${esc(h.text)}</div></li>`).join('');
const certDlg = $('#cert');
$('#honors').addEventListener('click', (e) => {
  const b = e.target.closest('.honor-img');
  if (!b) return;
  $('img', certDlg).src = b.dataset.full;
  $('img', certDlg).alt = b.dataset.alt;
  certDlg.showModal();
});
certDlg.addEventListener('click', () => certDlg.close());
$('#pillars').innerHTML = RESEARCH.map((r, i) => `
  <article>
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <h3>${esc(r.title)}</h3>
    <p>${esc(r.text)}</p>
    <ul class="refs">${r.refs.map((x) => `<li><span class="kind">${x.kind}</span>${x.href ? `<a href="${x.href}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>` : `<em>${esc(x.label)}</em>`}</li>`).join('')}</ul>
  </article>`).join('');
const pubItem = (p) => `
  <li>
    <span class="year">${p.year}</span>
    <div>
      <a href="${p.href}" target="_blank" rel="noopener" class="title">${esc(p.title)}</a>
      <div class="authors">${p.authors}</div>
      <div class="venue">${esc(p.venue)}</div>
    </div>
  </li>`;
$('#pubs').innerHTML = PUBLICATIONS.filter((p) => p.type !== 'patent').map(pubItem).join('');
$('#patents').innerHTML = PUBLICATIONS.filter((p) => p.type === 'patent').map(pubItem).join('');
$('#timeline').innerHTML = EXPERIENCE.map((e) => `
  <li>
    <a class="logo" href="${e.url}" target="_blank" rel="noopener" aria-label="${esc(e.org)}"><img src="${e.logo}" alt="" width="36" height="36" loading="lazy" /></a>
    <div class="body">
      <div class="when">${e.when}</div>
      <h3>${esc(e.title)}</h3>
      <a class="org" href="${e.url}" target="_blank" rel="noopener">${esc(e.org)}</a>
      ${e.who ? `<div class="who">${esc(e.who)}</div>` : ''}
      ${e.notes?.length ? `<ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    </div>
  </li>`).join('');
$('#year').textContent = new Date().getFullYear();
initSpikeSorter($('#play .ss'));
// ── theme switch ──────────────────────────────────────────────────────────────
// No reload: freeze the current 3D frame in an overlay, dip the page text, swap every
// material/pipeline/stylesheet to the other theme in place (scroll position, camera and
// chapter untouched), then fade the frozen frame out over the live new one.
const themeBtns = [...document.querySelectorAll('.theme-switch button')];
const syncSwitch = () => themeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === (WATERCOLOR ? 'watercolor' : 'ink'))));
syncSwitch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrames = (n = 2) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
let switching = false;
async function switchTheme(next) {
  if (switching || next === (WATERCOLOR ? 'watercolor' : 'ink')) return;
  switching = true;
  const html = document.documentElement;
  const xf = $('#xfade');
  if (!reduced) {
    // freeze this frame (a WebGL canvas can only be copied in the same task it was drawn)
    if (composer) composer.render(0); else renderer.render(scene, camera);
    xf.width = canvas.width;
    xf.height = canvas.height;
    xf.getContext('2d').drawImage(canvas, 0, 0);
    xf.style.transition = 'none';
    xf.style.opacity = '1';
    html.classList.add('theme-dip');
    await wait(260);
  }
  // keep whatever is mid-screen exactly where it was, even though fonts change the layout
  const anchor = document.elementFromPoint(innerWidth / 2, innerHeight * 0.4)?.closest('.block, .stage, .footer');
  const before = anchor?.getBoundingClientRect().top ?? 0;
  const y0 = scrollY;
  applyTheme(next);
  syncSwitch();
  await Promise.race([document.fonts.ready, wait(350)]);
  layout();
  const delta = anchor ? anchor.getBoundingClientRect().top - before : 0;
  if (Math.abs(delta) > 1) {
    if (lenis) lenis.scrollTo(y0 + delta, { immediate: true, force: true });
    else window.scrollTo(0, y0 + delta);
  }
  await nextFrames(2); // let the new pipeline draw (and compile) before revealing it
  html.classList.remove('theme-dip');
  xf.style.transition = 'opacity 0.9s ease';
  xf.style.opacity = '0';
  await wait(reduced ? 0 : 950);
  switching = false;
}
themeBtns.forEach((b) => b.addEventListener('click', () => switchTheme(b.dataset.set)));
// warm the other theme's faces so the first switch never waits on the network
(window.requestIdleCallback || setTimeout)(() => {
  ['400 1em "Newsreader"', 'italic 400 1em "Newsreader"', '500 1em "Newsreader"', '400 1em "Noto Serif Devanagari"', '500 1em "Space Grotesk"', '400 1em "Noto Sans Devanagari"']
    .forEach((f) => document.fonts.load(f, 'Aa अ').catch(() => {}));
});
document.documentElement.classList.add('theme-ready');

// ── interaction: drag to rotate, hover chip blocks ───────────────────────────
let yaw = 0, pitch = 0, yawVel = 0, dragging = false, lastX = 0, lastY = 0;
const pointer = new THREE.Vector2(-9, -9);
const raycaster = new THREE.Raycaster();
const tip = $('#chip-tip');
let pointerPx = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse' || cur.drag < 0.3) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerPx = { x: e.clientX, y: e.clientY };
  if (!dragging) return;
  yawVel = (e.clientX - lastX) * 0.006;
  yaw += yawVel;
  pitch = Math.max(-0.5, Math.min(0.5, pitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX;
  lastY = e.clientY;
});
const endDrag = () => (dragging = false);
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => pointer.set(-9, -9));

function updateHover() {
  if (cur.hover < 0.6 || mobile) {
    chip.hover(null);
    tip.classList.remove('on');
    return false;
  }
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(chip.picks, false)[0];
  const b = hit?.object.userData.block;
  chip.hover(b?.id ?? null);
  if (b) {
    tip.innerHTML = `<strong><i style="background:${b.color}"></i>${b.label}</strong><ul>${b.lines().map((l) => `<li>${l}</li>`).join('')}</ul>`;
    const x = Math.min(pointerPx.x + 18, innerWidth - 300);
    tip.style.transform = `translate(${x}px, ${pointerPx.y + 18}px)`;
    tip.classList.add('on');
  } else tip.classList.remove('on');
  return !!b;
}

// ── resize ────────────────────────────────────────────────────────────────────
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  sizePipeline();
  camera.aspect = w / h;
  uPixelRatio.value = dpr * Math.max(0.7, h / 900);
  layout();
  modalities.resize();
  sigScope.resize();
  decode.resize();
}
addEventListener('resize', resize);
resize();

// ── main loop ─────────────────────────────────────────────────────────────────
const cur = stateVector(STAGES.hero.state);
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const camOff = new THREE.Spherical();
let shift = { x: 0, y: 0 };
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

function frame(time) {
  clock.update(time);
  const dt = Math.max(0, Math.min(0.05, clock.getDelta()));
  uTime.value += dt;
  if (wc) wc.uniforms.uTime.value = uTime.value;
  lenis?.raf(time);
  const scroll = window.scrollY;
  const w = innerWidth, h = innerHeight;

  // scene state from scroll
  const s = sample(scroll);
  const lam = first ? 1e6 : 5;
  for (const k in s.st) cur[k] = first ? s.st[k] : damp(cur[k], s.st[k], lam, dt);
  if (first) {
    camTarget.copy(s.target);
    camOff.copy(s.off);
  }
  camTarget.x = damp(camTarget.x, s.target.x, 6, dt);
  camTarget.y = damp(camTarget.y, s.target.y, 6, dt);
  camTarget.z = damp(camTarget.z, s.target.z, 6, dt);
  camOff.radius = Math.exp(damp(Math.log(camOff.radius), Math.log(s.off.radius), 6, dt));
  camOff.phi = damp(camOff.phi, s.off.phi, 6, dt);
  camOff.theta += Math.atan2(Math.sin(s.off.theta - camOff.theta), Math.cos(s.off.theta - camOff.theta)) * (1 - Math.exp(-6 * dt));
  shift.x = damp(shift.x, s.sx, 6, dt);
  shift.y = damp(shift.y, s.sy, 6, dt);

  // intro dolly
  intro = Math.min(1, intro + dt * 0.45);
  const ease = 1 - (1 - intro) ** 3;
  tmpV.setFromSpherical(new THREE.Spherical(camOff.radius * (1 + 0.9 * (1 - ease)), camOff.phi - 0.25 * (1 - ease), camOff.theta + 0.6 * (1 - ease)));
  camPos.copy(camTarget).add(tmpV);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.setViewOffset(w, h, -shift.x * w, shift.y * h, w, h);

  // drag rotation only while the brain is the subject; idle sway in hero
  if (!dragging) {
    yawVel *= 0.94;
    yaw += yawVel;
    if (cur.drag < 0.5) {
      yaw = damp(yaw, 0, 3, dt);
      pitch = damp(pitch, 0, 3, dt);
    }
  }
  const sway = reduced ? 0 : Math.sin(uTime.value * 0.18) * 0.35 * cur.drag;
  root.rotation.set(pitch * cur.drag, yaw + sway, 0);
  canvas.className = cur.drag > 0.5 && !mobile ? (dragging ? 'grabbing' : 'grab') : '';

  // apply state
  for (const k of LAYER_KEYS) layers[k].set(cur[`ov_${k}`]);
  chip.layer.set(cur.chip);
  pathway.layer.set(cur.sig);
  link.layer.set(cur.link);
  const u = brain.material.uniforms;
  u.uHi.value.set(cur.h0, cur.h1, cur.h2);
  u.uOpacity.value = cur.brain;
  if (wash) wash.material.uniforms.uOpacity.value = 0.08 * cur.brain;
  u.uActivity.value = cur.activity;
  if (ripple >= 0) {
    ripple += dt;
    u.uRipple.value = ripple * 1.5;
    if (ripple > 1.4) ripple = -1;
  } else u.uRipple.value = -1;

  pathway.update(dt, 1);
  chip.update(dt, 0.6 + cur.sig * 0.6);
  link.update(dt);
  if (updateHover()) canvas.className = 'point';

  // cards, rail, per-chapter UI
  let active = sections[0];
  let best = Infinity;
  for (const sec of sections) {
    const d = Math.abs(scroll - sec.anchor) / sec.half;
    sec.vis = sec.id === 'hero' ? 1 - sstep(0.15, 0.6, scroll / h) : 1 - sstep(0.62, 0.92, d);
    for (const card of sec.cards) {
      card.style.opacity = sec.vis.toFixed(3);
      card.style.pointerEvents = sec.vis > 0.3 ? 'auto' : 'none';
    }
    if (d < best) { best = d; active = sec; }
  }
  const pastJourney = scroll > keys[keys.length - 1].at - h * 0.5;
  sections.forEach((sec) => sec.rail.classList.toggle('on', sec === active && !pastJourney));
  rail.classList.toggle('hide', pastJourney || scroll < h * 0.3);
  $('.hero-inner').style.opacity = sections[0].vis.toFixed(3);

  const vis = Object.fromEntries(sections.map((x) => [x.id, x.vis]));
  if (vis.landscape > 0.01) modalities.update(dt);
  if (vis.signals > 0.01) sigScope.step(dt);
  if (vis.decode > 0.01) decode.update(dt);
  if (vis.chip > 0.5 && !statsShown) showStats();

  root.updateMatrixWorld();
  labels.update(w, h, 1 - Math.max(vis.decode, vis.chip));

  if (composer) composer.render(dt);
  else renderer.render(scene, camera);

  if (first) {
    first = false;
    $('#loader').classList.add('done');
    if (!reduced) {
      gsap.from('.hero-inner > *', { y: 30, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.12, delay: 0.3 });
    }
  }
  requestAnimationFrame(frame);
}

// Deep link to a chapter: ?at=chip (or a raw scroll offset).
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

// Fonts change layout; re-measure once they land.
document.fonts?.ready.then(() => {
  layout();
  jumpToParam();
});
requestAnimationFrame(frame);

if (import.meta.env.DEV) window.__site = { scene, camera, renderer, brain, cur, root, keys: () => keys, sample, sections, chip, link, chipAnchor, pathway, STAGES, composer, bloom };
