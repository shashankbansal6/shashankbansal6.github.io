// What the page needs the moment it paints: styles, fonts, the menu and the phone menu button.
// The 3D scene (three.js and the rest) loads right after the first paint, so text is on screen before it.
import './fonts.css';
import './menu.css';
import './styles.css';
import 'lenis/dist/lenis.css';
import './watercolor.css'; // every rule is scoped to [data-theme='watercolor']
import { initMenu } from './menu.js';
import { initAnalytics } from './analytics.js';

initMenu();
initAnalytics();

// phone menu (the three-line button)
const navEl = document.querySelector('.nav');
const menuBtn = document.querySelector('.menu-btn');
const setMenu = (open) => { navEl.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!navEl.classList.contains('open')); });
document.querySelector('#site-nav').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

let started = false;
// if the scene cannot start (no WebGL, a failed download) the page stays as it is, minus the 3D: just lift the cover
const scene = () => { if (!started) { started = true; import('./main.js').catch(() => document.querySelector('#loader')?.classList.add('done')); } };
// start as soon as the first frame is on screen. The hero text rises on the compositor (opacity and transform only),
// so the scene's setup does not stall it, and the build hands the main thread back between its steps.
requestAnimationFrame(() => setTimeout(scene, 0));
