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
const scene = () => { if (!started) { started = true; import('./main.js'); } };
// run it once the hero text has finished rising: the scene's setup is a long task and would stall that animation
setTimeout(scene, 1100);
