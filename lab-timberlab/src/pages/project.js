import { boot } from '../main.js';
import { getProject, nextProject } from '../data/projects.js';
import { heroIntro } from '../modules/motion.js';

/** Project detail template — in WordPress: single-lab_project.php reading CPT fields. */
const slug = new URLSearchParams(location.search).get('p');
const p = getProject(slug);
const nx = nextProject(p.slug);
const known = (v) => v && !/to be confirmed|to be supplied|tbc/i.test(v) && v !== '—';
document.title = `${p.title} — L.A.B by Timberlab`;

document.querySelector('[data-title]').textContent = p.title;
document.querySelector('[data-strap]').textContent = [p.propertyType, p.location].filter(known).join(' · ');
document.querySelector('[data-cover]').innerHTML = `<img src="${p.hero || p.cover}" alt="${p.title}" fetchpriority="high" data-ph="0">`;
document.querySelector('[data-summary]').textContent = p.summary;
document.querySelector('[data-meta]').innerHTML = [
  ['Property', p.propertyType], ['Home type', p.homeType], ['Location', p.location], ['Design direction', p.direction], ['Year', p.year],
].filter(([, v]) => known(v)).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

// Group the photographs first: a wide one runs on its own, two upright ones sit
// side by side. Doing this before the prose means a paragraph can never break
// up a pair.
const blocks = [];
let buffer = [];
p.gallery.forEach((g, i) => {
  const one = { ...g, i };
  if (g.size === 'wide') {
    if (buffer.length) { blocks.push(buffer); buffer = []; }
    blocks.push([one]);
    return;
  }
  buffer.push(one);
  if (buffer.length === 2) { blocks.push(buffer); buffer = []; }
});
if (buffer.length) blocks.push(buffer);

// The story is told between the photographs, not stacked above them.
const says = [];
if (known(p.brief)) says.push(['The brief', p.brief]);
if (known(p.response)) says.push(['The response', p.response]);

const say = ([h, t]) => `<div class="pd-flow__say measure" data-reveal="fade"><h2>${h}</h2><p>${t}</p></div>`;
const shot = (g) => `<div class="frame" data-reveal="clip"><img src="${g.src}" alt="${g.alt}" loading="lazy" decoding="async" data-ph="${g.i + 1}"></div>`;

// Space the paragraphs evenly through the photographs, so a short gallery does
// not leave one stranded at the end.
const step = Math.max(2, Math.floor(blocks.length / (says.length + 1)));
const out = [];
blocks.forEach((block, b) => {
  if (b % step === 0 && says.length) out.push(say(says.shift()));
  out.push(block.length > 1
    ? `<div class="pd-flow__pair">${block.map((g) => `<figure class="g-${g.size}">${shot(g)}</figure>`).join('')}</div>`
    : `<figure class="pd-flow__full">${shot(block[0])}</figure>`);
});
// Anything the run of photographs was too short to carry still gets said.
says.forEach((s2) => out.push(say(s2)));
document.querySelector('[data-flow]').innerHTML = out.join('');

document.querySelector('[data-details]').innerHTML = p.details.map((d, i2) => `<li><span>${String(i2 + 1).padStart(2, '0')}</span>${d}</li>`).join('');

// Before / after
const ba = document.querySelector('[data-ba]');
if (p.before && p.after) {
  ba.querySelector('[data-ba-before]').src = p.before;
  const after = ba.querySelector('[data-ba-after]'); after.src = p.after;
  const handle = ba.querySelector('[data-ba-handle]');
  const range = ba.querySelector('input');
  const set = (v) => { after.style.clipPath = `inset(0 0 0 ${v}%)`; handle.style.left = `${v}%`; };
  range.addEventListener('input', () => set(range.value));
  set(50);
} else {
  ba.closest('section').remove(); // no "before" photography for this project
}

// Next project
const next = document.querySelector('[data-next]');
next.href = `project.html?p=${nx.slug}`;
next.innerHTML = `<div class="frame frame--shade frame--tint" data-parallax="10"><img src="${nx.cover}" alt="" loading="lazy" data-ph="6"></div>
  <div class="container next__inner"><div class="label">Next project — ${nx.propertyType} · ${nx.location}</div><h2 class="display">${nx.title}</h2></div>`;

boot('projects.html');
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.pd-hero'))); else heroIntro(document.querySelector('.pd-hero'));
