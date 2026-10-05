/**
 * If a photograph fails to load — not yet uploaded, or a broken attachment —
 * swap in a designed placeholder so the layout never collapses.
 */
const COUNT = 8;
let counter = 0;

export function initImageFallbacks() {
  const base = (window.LAB && window.LAB.assets) || '';
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback === 'done') return;
    img.dataset.fallback = 'done';
    const n = (counter++ % COUNT) + 1;
    img.src = `${base}placeholders/ph-${n}.svg`;
    img.classList.add('is-placeholder');
  }, true);
}
