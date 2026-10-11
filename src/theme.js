// Theme switch: "ink" (default dark) or "watercolor" (pigment on paper).
// The inline script in index.html sets <html data-theme> before anything loads;
// everything that hard-codes a color routes it through `tint()` so one source
// palette serves both looks.
import * as THREE from 'three';

export const THEME = document.documentElement.dataset.theme === 'watercolor' ? 'watercolor' : 'ink';
export const WATERCOLOR = THEME === 'watercolor';

export const PAPER = '#f2ead9';
export const INK = '#2a231e';

// Known neon → pigment pairs (cerulean, viridian, alizarin, sienna…).
const PIGMENTS = {
  '#3ef0ff': '#2f6f9f', // cyan → cerulean
  '#5eead4': '#2f7f74', // teal → viridian
  '#ff4fa3': '#b0365f', // magenta → alizarin crimson
  '#ff6fb1': '#b0365f',
  '#a78bfa': '#5b4b8a', // violet → dioxazine
  '#ffb547': '#b9772a', // amber → raw sienna
  '#ff5a5a': '#b8402f', // red → cadmium red deep
  '#e8f3ff': '#4a5560',
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

export const BLENDING = WATERCOLOR ? THREE.NormalBlending : THREE.AdditiveBlending;

export function setTheme(next) {
  try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
  const url = new URL(location.href);
  url.searchParams.set('theme', next);
  location.href = url.toString();
}
