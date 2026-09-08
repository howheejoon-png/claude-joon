/**
 * Image fallback: if remote photography fails (offline, blocked, or not yet supplied),
 * swap in a designed local placeholder so layouts never break.
 */
const PH_COUNT = 8;
let counter = 0;
export function initImageFallbacks() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback === 'done') return;
    img.dataset.fallback = 'done';
    const n = (img.dataset.ph ? Number(img.dataset.ph) : counter++) % PH_COUNT;
    img.src = `img/ph/ph-${n + 1}.svg`;
    img.classList.add('is-placeholder');
  }, true);
}
