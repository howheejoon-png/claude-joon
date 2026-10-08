import { boot } from '../main.js';
import { projects } from '../data/projects.js';
import { heroIntro, gsap, ScrollTrigger } from '../modules/motion.js';

boot('projects.html');
const grid = document.querySelector('[data-grid]');
const filter = document.querySelector('[data-filter]');
const count = document.querySelector('[data-filter-count]');
const types = ['All', ...new Set(projects.map((p) => p.propertyType))];
const params = new URLSearchParams(location.search);
let active = types.includes(params.get('type')) ? params.get('type') : 'All';

// The catalogue: one square crop, one quiet caption, repeated. No numbers and
// no tags — the editorial sequence stays on the homepage.
grid.innerHTML = projects.map((p, i) => `
  <a class="proj" href="project.html?p=${p.slug}" data-type="${p.propertyType}" aria-label="${p.title}">
    <div class="frame frame--shade" data-reveal="clip"><img src="${p.cover}" alt="${p.title} — ${p.homeType}, ${p.location}" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" data-ph="${i}"></div>
    <div class="proj__meta"><h3 class="proj__title">${p.title}</h3></div>
  </a>`).join('');
filter.innerHTML = types.map((t) => `<button class="pill" role="tab" type="button" data-type="${t}" aria-selected="${t === active}">${t}</button>`).join('');

function apply(type, animate = true) {
  active = type;
  filter.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.type === type)));
  const items = [...grid.querySelectorAll('.proj')];
  const show = items.filter((el) => type === 'All' || el.dataset.type === type);
  const run = () => {
    // The grid is uniform, so hiding a card is enough — nothing to re-order.
    items.forEach((el) => el.classList.toggle('is-hidden', !show.includes(el)));
    count.textContent = `${show.length} ${show.length === 1 ? 'project' : 'projects'}`;
    ScrollTrigger.refresh();
    if (animate) gsap.fromTo(show, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' });
  };
  if (animate) gsap.to(items, { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in', onComplete: run }); else run();
  const url = new URL(location); type === 'All' ? url.searchParams.delete('type') : url.searchParams.set('type', type); history.replaceState(null, '', url);
}
filter.addEventListener('click', (e) => { const b = e.target.closest('.pill'); if (b && b.dataset.type !== active) apply(b.dataset.type); });
apply(active, false);
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('main'))); else heroIntro(document.querySelector('main'));
