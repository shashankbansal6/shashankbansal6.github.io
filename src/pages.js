// The page text that comes from config.js: the chip and link cards' specs, About, Research, Publications,
// Experience, and the game. None of it needs WebGL, so it is filled in before the 3D scene is built and is there
// even on a device where the scene cannot start.
import gsap from 'gsap';
import { CHIP, PROFILE, EXPERIENCE, RESEARCH, PUBLICATIONS, HONORS } from './config.js';
import { initTalks } from './ui/talks.js';
import { initSpikeSorter } from './game/spikesorter.js';

const $ = (s, r = document) => r.querySelector(s);
export const fmt = (v, d = 0) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export function fillPages() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  $('#honors').innerHTML = HONORS.map((h, i) => `<li data-i="${i}"><div><span>${h.year}</span>${esc(h.text)}</div></li>`).join('');
  const certDlg = $('#cert');
  // an award with a certificate image becomes a link (text and thumbnail) once the image is known to exist
  HONORS.forEach((h, i) => {
    if (!h.img) return;
    const probe = new Image();
    probe.onload = () => {
      const li = $(`#honors li[data-i="${i}"]`);
      const alt = esc(h.alt || h.text);
      li.classList.add('has-img');
      li.innerHTML = `<button type="button" class="honor-img" data-full="${h.img}" data-alt="${alt}" aria-label="View certificate larger"><img src="${h.img.replace(".jpg", "-thumb.jpg")}" alt="${alt}" loading="lazy" decoding="async" /></button>
        <div><span>${h.year}</span><button type="button" class="honor-link" data-full="${h.img}" data-alt="${alt}">${esc(h.text)} <em>View certificate ↗</em></button></div>`;
    };
    probe.src = h.img.replace(".jpg", "-thumb.jpg");
  });
  $('#honors').addEventListener('click', (e) => {
    const b = e.target.closest('.honor-img, .honor-link');
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
      <p>${esc(r.text).replace(/1,024/g, '<span class="live-count" data-to="1024">1,024</span>')}</p>
      <ul class="refs">${r.refs.map((x) => `<li><span class="kind">${x.kind}</span>${x.href ? `<a href="${x.href}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>` : `<em>${esc(x.label)}</em>`}</li>`).join('')}</ul>
    </article>`).join('');
  // "1,024 channels" counts up the first time it scrolls into view
  document.querySelectorAll('.live-count').forEach((el) => {
    if (reduced || !('IntersectionObserver' in window)) return;
    el.textContent = '0';
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const o = { v: 0 };
      gsap.to(o, { v: +el.dataset.to, duration: 2.2, ease: 'power2.out', onUpdate: () => (el.textContent = fmt(o.v)) });
    }, { threshold: 1 });
    io.observe(el);
  });
  const pubItem = (p) => `
    <li>
      <span class="year">${p.year}</span>
      <div>
        <a href="${p.href}" target="_blank" rel="noopener" class="title">${esc(p.title)}</a>
        <div class="authors">${p.authors}</div>
        <div class="venue">${esc(p.venue)}${p.pdf ? ` <a class="pdf" href="${p.pdf}" target="_blank" rel="noopener">PDF</a>` : ''}</div>
      </div>
    </li>`;
  $('#pubs').innerHTML = PUBLICATIONS.filter((p) => p.type !== 'patent').map(pubItem).join('');
  $('#patents').innerHTML = PUBLICATIONS.filter((p) => p.type === 'patent').map(pubItem).join('');
  initTalks($('#talk-list'), $('#viewer'));
  $('#timeline').innerHTML = EXPERIENCE.map((e) => `
    <li>
      <a class="logo" href="${e.url}" target="_blank" rel="noopener" aria-label="${esc(e.org)}"><img src="${e.logo}" alt="" width="36" height="36" loading="lazy" /></a>
      <div class="body">
        <div class="when">${e.when}</div>
        <h3>${esc(e.title)}</h3>
        <a class="org" href="${e.url}" target="_blank" rel="noopener">${esc(e.org)}</a>
        ${e.who ? `<div class="who">${esc(e.who)}</div>` : ''}
        ${e.email ? `<a class="mail" href="mailto:${e.email}">${e.email}</a>` : ''}
        ${e.notes?.length ? `<ul>${e.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </div>
    </li>`).join('');
  $('#year').textContent = new Date().getFullYear();
  initSpikeSorter($('#play .ss'));
}
