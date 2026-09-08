import { boot } from '../main.js';
import { getProject, nextProject } from '../data/projects.js';
import { heroIntro } from '../modules/motion.js';

/** Project detail template — in WordPress: single-project.php reading CPT fields. */
const slug = new URLSearchParams(location.search).get('p');
const p = getProject(slug);
const nx = nextProject(p.slug);
document.title = `${p.title} — L.A.B by Timberlab`;

document.querySelector('[data-crumb]').textContent = p.title;
document.querySelector('[data-title]').innerHTML = `${p.title}`;
document.querySelector('[data-meta]').innerHTML = [
  ['Property', p.propertyType], ['Home type', p.homeType], ['Location', p.location], ['Design direction', p.direction], ['Year', p.year],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
document.querySelector('[data-cover]').innerHTML = `<img src="${p.cover}" alt="${p.title}" fetchpriority="high" data-ph="0">`;
document.querySelector('[data-summary]').textContent = p.summary;
document.querySelector('[data-brief]').textContent = p.brief;
document.querySelector('[data-response]').textContent = p.response;
document.querySelector('[data-gallery]').innerHTML = p.gallery.map((g, i) => `
  <figure class="g-${g.size}"><div class="frame" data-reveal="clip" data-parallax="6"><img src="${g.src}" alt="${g.alt}" loading="lazy" decoding="async" data-ph="${i + 1}"></div>
  <figcaption><span>${g.alt}</span><span>${String(i + 1).padStart(2, '0')} / ${String(p.gallery.length).padStart(2, '0')}</span></figcaption></figure>`).join('');
document.querySelector('[data-details]').innerHTML = p.details.map((d, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${d}</li>`).join('');

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
