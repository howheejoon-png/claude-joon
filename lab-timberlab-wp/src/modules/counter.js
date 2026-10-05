import { ScrollTrigger } from './motion.js';

/**
 * Rolling number counters. Any element with data-count="12" counts up to that
 * value when it scrolls into view. Elements without a numeric data-count are
 * left untouched, so unconfirmed figures can stay as an em-dash.
 */
export function initCounters(scope = document) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scope.querySelectorAll('[data-count]').forEach((el) => {
    const raw = (el.dataset.count || '').trim();
    const target = Number(raw);
    if (raw === '' || !Number.isFinite(target)) return;
    const suffix = el.dataset.suffix || '';
    const render = (n) => { el.textContent = Math.round(n).toLocaleString('en-SG') + suffix; };
    if (reduced) { render(target); return; }
    render(0);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        const duration = 1700, start = performance.now();
        const ease = (t) => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          render(target * ease(t));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
    });
  });
}
