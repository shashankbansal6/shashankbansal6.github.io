// The "Learn" and "Explore" menus, shared by every page. Hover (mouse), tap (touch) or Enter (keyboard) opens a panel;
// Escape, an outside tap or tabbing away closes it.
const LEARN = [
  { href: '/learn/', b: 'Neuroscience', s: 'The brain, layer by layer', k: 'brain' },
  { href: '/learn/sensors/', b: 'Sensor design', s: 'Electrodes and the tissue interface', k: 'sensor' },
  { href: '/learn/chip/', b: 'Chip design', s: 'Adiabatic, neuromorphic, in-memory', k: 'chip' },
];
const EXPLORE = [
  { href: '/#research', b: 'Research', s: 'What I work on' },
  { href: '/#publications', b: 'Publications', s: 'Papers and patents' },
  { href: '/#talks', b: 'Posters & talks', s: 'Slides and posters' },
  { href: '/#experience', b: 'Experience', s: 'Path so far' },
  { href: '/#play', b: 'Play', s: 'Be the decoder' },
  { href: '/photos/', b: 'Photos', s: 'Grad school in pictures' },
  { href: '/ShashankBansal-CV.pdf', b: 'CV', s: 'PDF', cv: true },
];
const MENUS = { learn: { title: 'Learn', items: LEARN }, explore: { title: 'Explore', items: EXPLORE } };

function build(group) {
  const grid = group.querySelector('.menu-grid');
  const { title, items } = MENUS[group.dataset.menu];
  const path = location.pathname.replace(/index\.html$/, '');
  const home = path === '/';
  const here = (h) => !h.includes('#') && h === path;
  const href = (h) => (home && h.startsWith('/#') ? h.slice(1) : h);
  grid.innerHTML = `<p class="grp">${title}</p>` + items.map((it) => `<a href="${href(it.href)}"${it.cv ? ' class="cv-only"' : ''}${it.k ? ` data-k="${it.k}"` : ''}${here(it.href) ? ' aria-current="page"' : ''}>${it.k ? '<u aria-hidden="true"></u>' : ''}<b>${it.b}</b><span>${it.s}</span></a>`).join('');
  if (group.dataset.menu === 'learn' && path.startsWith('/learn/')) group.classList.add('here');
}

export function initMenu() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const groups = [...document.querySelectorAll('.menu-group')];
  groups.forEach(build);
  // only one panel is ever open: opening one closes the others straight away, so a fading panel can never catch the pointer
  const closers = new Map();
  groups.forEach((g) => {
    const btn = g.querySelector('.menu-trigger');
    let timer;
    const set = (open) => {
      clearTimeout(timer);
      if (open) closers.forEach((close, o) => o !== g && close());
      g.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    closers.set(g, () => set(false));
    const isOpen = () => g.classList.contains('open');
    g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') set(true); });
    g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') timer = setTimeout(() => set(false), 160); });
    // a mouse click while hovering must not close what the hover just opened
    btn.addEventListener('click', (e) => set(e.detail === 0 || !fine.matches ? !isOpen() : true));
    g.addEventListener('focusout', (e) => { if (!g.contains(e.relatedTarget)) set(false); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
    // choosing a tile closes the panel and keeps it shut until the pointer has left and come back
    g.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { set(false); g.classList.add('picked'); }));
    g.addEventListener('pointerleave', () => g.classList.remove('picked'));
    document.addEventListener('pointerdown', (e) => { if (!g.contains(e.target)) set(false); });
  });
}
