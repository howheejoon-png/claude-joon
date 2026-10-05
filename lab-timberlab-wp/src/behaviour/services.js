/** Services accordion with the sticky image that follows the open row. */
export function initServices() {
  const list = document.querySelector('[data-services]');
  const media = document.querySelector('[data-services-media]');
  if (!list) return;

  const rows = [...list.querySelectorAll('.svc')];
  const images = media ? [...media.querySelectorAll('img')] : [];
  const cap = media?.querySelector('[data-cap]');

  const activate = (i) => {
    rows.forEach((el, j) => {
      el.classList.toggle('is-open', i === j);
      el.setAttribute('aria-expanded', String(i === j));
    });
    images.forEach((im, j) => im.classList.toggle('is-active', i === j));
    if (cap) cap.textContent = rows[i]?.querySelector('.svc__title')?.textContent ?? '';
  };

  rows.forEach((el, i) => {
    el.addEventListener('click', () => activate(i));
    el.addEventListener('mouseenter', () => {
      if (window.matchMedia('(hover: hover)').matches) activate(i);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(i); }
    });
  });
}
