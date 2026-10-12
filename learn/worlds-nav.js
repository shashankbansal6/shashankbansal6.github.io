// "Three worlds" navigation shared by the Learn pages: a pill switcher for the hero and a row of tiles at the end.
import { WORLDS } from './content.js';
import { esc } from './refs.js';
import './dock.css';

export const worldSwitch = (current) => `<nav class="w-switch" aria-label="Learn worlds">${WORLDS.map((w) => `<a href="${w.href}" data-k="${w.k}"${w.id === current ? ' aria-current="page"' : ''}><u aria-hidden="true"></u>${esc(w.name)}</a>`).join('')}</nav>`;

export const worldsNext = (current) => `
  <p class="kicker">Keep going</p>
  <h2>Three ways to learn how a brain interface works</h2>
  <div class="w-tiles">${WORLDS.map((w) => `<a class="w-tile${w.id === current ? ' here' : ''}" data-k="${w.k}" href="${w.href}"${w.id === current ? ' aria-current="page"' : ''}>
    <u aria-hidden="true"></u><b>${esc(w.name)}</b><span>${esc(w.line)}</span><i aria-hidden="true">${w.id === current ? 'You are here' : 'Open →'}</i></a>`).join('')}</div>`;

// the same three worlds as small icons in the top right: they zoom out of the hero switcher once it scrolls away
export function initDock(current) {
  const dock = document.createElement('nav');
  dock.className = 'w-dock';
  dock.setAttribute('aria-label', 'Switch Learn page');
  dock.innerHTML = WORLDS.map((w) => `<a href="${w.href}" data-k="${w.k}" data-name="${esc(w.name)}" aria-label="${esc(w.name)}"${w.id === current ? ' aria-current="page"' : ''}><u aria-hidden="true"></u></a>`).join('');
  document.body.appendChild(dock);
  let on = false;
  const check = () => {
    const now = scrollY > innerHeight * 0.55;
    if (now !== on) { on = now; dock.classList.toggle('on', on); }
  };
  addEventListener('scroll', check, { passive: true });
  check();
}
