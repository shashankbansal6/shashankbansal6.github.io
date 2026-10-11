// Theme switch: "ink" (default dark) or "watercolor" (pigment on paper).
// The inline script in index.html sets <html data-theme> before anything loads;
// everything that hard-codes a color routes it through `tint()` so one source
// palette serves both looks.
import * as THREE from 'three';

// Live bindings: importers see the new value after applyTheme(), so the whole page can
// switch between ink and watercolor without reloading.
export let THEME = document.documentElement.dataset.theme === 'watercolor' ? 'watercolor' : 'ink';
export let WATERCOLOR = THEME === 'watercolor';

export const PAPER = '#f2ead9';
export const INK = '#2a231e';

// Known neon → pigment pairs (cerulean, viridian, alizarin, sienna…).
const PIGMENTS = {
  // saturated, mutually distinct pigments so hardware reads clearly against the indigo brain
  '#3ef0ff': '#0b7f93', // cyan → peacock blue-green
  '#5eead4': '#1e8a5e', // teal → viridian green
  '#ff4fa3': '#c4155c', // magenta → alizarin crimson
  '#ff6fb1': '#c4155c',
  '#a78bfa': '#6a3fb5', // violet → dioxazine
  '#ffb547': '#d97a0f', // amber → cadmium orange
  '#ff5a5a': '#cf2b2b', // red → cadmium red
  '#e8f3ff': '#3d4a58',
  '#ffffff': PAPER,
};

const _c = new THREE.Color();
const _hsl = {};

// Map any color to a pigment-on-paper equivalent (identity in ink theme).
export function tint(color) {
  if (!WATERCOLOR) return color;
  const hex = typeof color === 'string' ? color.toLowerCase() : `#${new THREE.Color(color).getHexString()}`;
  if (PIGMENTS[hex]) return PIGMENTS[hex];
  _c.set(hex).getHSL(_hsl);
  // pastel / near-white neons become muted, mid-dark pigments
  _c.setHSL(_hsl.h, Math.min(0.55, _hsl.s * 0.6), Math.min(0.42, 0.18 + _hsl.l * 0.3));
  return `#${_c.getHexString()}`;
}

export let BLENDING = WATERCOLOR ? THREE.NormalBlending : THREE.AdditiveBlending;

const listeners = [];
// Run `fn` now and again every time the theme changes (re-tint a material, recolor a chart…).
export function themed(fn) {
  fn();
  listeners.push(fn);
}
// Run `fn` only on theme changes.
export const onTheme = (fn) => listeners.push(fn);

const remember = (next) => {
  try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
  const url = new URL(location.href);
  url.searchParams.set('theme', next);
  history.replaceState(null, '', url);
};

// Switch themes in place. The caller sequences the visual transition around this.
export function applyTheme(next) {
  if (next === THEME) return;
  THEME = next;
  WATERCOLOR = next === 'watercolor';
  BLENDING = WATERCOLOR ? THREE.NormalBlending : THREE.AdditiveBlending;
  if (WATERCOLOR) document.documentElement.dataset.theme = 'watercolor';
  else delete document.documentElement.dataset.theme;
  remember(next);
  for (const fn of listeners) fn();
}
