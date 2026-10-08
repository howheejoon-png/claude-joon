import gsap from 'gsap';
import { ScrollTrigger } from '../modules/motion.js';

/** Property-type filter on the projects index. */
export function initFilter() {
  const grid = document.querySelector('[data-grid]');
  const bar = document.querySelector('[data-filter]');
  const count = document.querySelector('[data-filter-count]');
  if (!grid || !bar) return;

  const items = [...grid.querySelectorAll('.proj')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const apply = (type, animate = true) => {
    bar.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.type === type)));
    const show = items.filter((el) => type === 'all' || el.dataset.type === type);

    const run = () => {
      // The grid is uniform, so hiding a card is enough — nothing to re-order.
      items.forEach((el) => el.classList.toggle('is-hidden', !show.includes(el)));
      if (count) {
        count.textContent = `${show.length} ${show.length === 1 ? 'project' : 'projects'}`;
      }
      ScrollTrigger.refresh();
      if (animate && !reduced) {
        gsap.fromTo(show, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' });
      }
    };

    if (animate && !reduced) {
      gsap.to(items, { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in', onComplete: run });
    } else {
      run();
    }

    const url = new URL(location.href);
    type === 'all' ? url.searchParams.delete('type') : url.searchParams.set('type', type);
    history.replaceState(null, '', url);
  };

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.pill');
    if (b) apply(b.dataset.type);
  });

  // On a property-type archive the server has already filtered; honour that.
  const initial = new URLSearchParams(location.search).get('type') || bar.dataset.active;
  const valid = [...bar.querySelectorAll('.pill')].some((b) => b.dataset.type === initial);
  apply(valid ? initial : 'all', false);
}
