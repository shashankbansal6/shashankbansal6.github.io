// Page chrome for the Learn worlds that have no 3D brain (sensor design, chip design): smooth scroll,
// theme switch, menu, and one animation loop that hands the scroll position to the page.
import Lenis from 'lenis';
import { initMenu } from '../src/menu.js';
import { initAnalytics } from '../src/analytics.js';

const $ = (s, r = document) => r.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function startWorld({ onResize, onFrame }) {
  const mobile = matchMedia('(max-width: 900px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const lenis = reduced || mobile || matchMedia('(pointer: coarse)').matches ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, anchors: { offset: 0 } });
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y, behavior: 'smooth' }));

  // theme (same storage key as the other pages), swapped in place with a view transition when available
  const wcNow = () => document.documentElement.dataset.theme === 'watercolor';
  const btns = [...document.querySelectorAll('.theme-switch button')];
  const sync = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === (wcNow() ? 'watercolor' : 'ink'))));
  sync();
  let switching = false;
  async function switchTheme(next) {
    if (switching || next === (wcNow() ? 'watercolor' : 'ink')) return;
    switching = true;
    const swap = async () => {
      if (next === 'watercolor') document.documentElement.dataset.theme = 'watercolor'; else delete document.documentElement.dataset.theme;
      try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
      const url = new URL(location.href); url.searchParams.set('theme', next); history.replaceState(null, '', url);
      sync();
      await Promise.race([document.fonts.ready, wait(300)]);
      onResize?.();
    };
    if (!reduced && document.startViewTransition) {
      const t = document.startViewTransition(swap);
      t.ready.catch(() => {});
      await t.finished.catch(() => {});
    } else await swap();
    switching = false;
  }
  btns.forEach((b) => b.addEventListener('click', () => switchTheme(b.dataset.set)));

  initMenu();
  initAnalytics();
  const nav = $('.nav'), menuBtn = $('.menu-btn');
  const setMenu = (open) => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!nav.classList.contains('open')); });
  $('#site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });
  document.documentElement.classList.add('theme-ready');
  $('#year') && ($('#year').textContent = new Date().getFullYear());

  let lastW = 0, lastH = 0;
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    if (lastW === w && lastH && Math.abs(h - lastH) < lastH * 0.25 && matchMedia('(pointer: coarse)').matches) return;
    lastW = w; lastH = h;
    onResize?.();
  };
  addEventListener('resize', resize);
  resize();
  document.fonts?.ready.then(() => onResize?.());

  let last = performance.now(), first = true;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lenis?.raf(now);
    onFrame(dt, lenis ? lenis.scroll : scrollY);
    if (first) { first = false; $('#loader')?.classList.add('done'); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { mobile, reduced, scrollToY, lenis };
}
