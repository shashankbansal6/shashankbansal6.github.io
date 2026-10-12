// Paper lists shared by the brain dives, the chip dive and the device popovers.
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const link = (p) => `<li><span class="yr">${p.year}</span><a href="${p.href}" target="_blank" rel="noopener">${esc(p.title)} ↗</a><span class="by">${esc(p.by)}</span></li>`;

const labLink = (p) => `<li><span class="yr">${p.year}</span><a href="${p.href}" target="_blank" rel="noopener">${esc(p.title)} ↗</a><span class="by"><b class="labtag">${esc(p.lab)}</b>${p.me ? '<b class="metag">★ I’m an author</b>' : ''}${esc(p.by)}</span></li>`;

// the card body below a beat's text: the paper that first described it, work from the labs I work
// with, and further reading
export function refsHTML(b) {
  const f = b.first;
  return `${f ? `<div class="first ${f.kind}">
      <span class="badge">${f.kind === 'first' ? 'First described' : 'Landmark paper'}</span>
      <a href="${f.href}" target="_blank" rel="noopener">${esc(f.title)} ↗</a>
      <div class="by">${esc(f.by)} · ${esc(f.venue)} · ${f.year}</div>
      <p>${esc(f.note)}</p>
    </div>` : ''}
    ${b.labs?.length ? `<p class="then lab">From the labs I work with</p><ul class="refs2 labs">${b.labs.map(labLink).join('')}</ul>` : ''}
    ${b.modern?.length ? `<p class="then">Then read</p><ul class="refs2">${b.modern.map(link).join('')}</ul>` : ''}`;
}
