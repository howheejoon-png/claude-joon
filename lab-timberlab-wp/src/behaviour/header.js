/** Header scroll state, dark-section detection and the full-screen menu. */
export function initHeader() {
  const header = document.getElementById('site-header');
  const menu = document.getElementById('site-menu');
  if (!header) return;

  const btn = header.querySelector('.menu-btn');
  const close = menu?.querySelector('.menu__close');

  const setOpen = (open) => {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    btn?.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('lenis-stopped', open);
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  };

  btn?.addEventListener('click', () => setOpen(true));
  close?.addEventListener('click', () => setOpen(false));
  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // Flip the header to light type whenever a dark section sits behind it.
  // Measured against the header's own box, so the WordPress admin bar (which
  // shifts the whole page down) doesn't throw the detection off.
  const darks = [...document.querySelectorAll('[data-header="dark"]')];
  const updateDark = () => {
    if (!darks.length) return;
    const box = header.getBoundingClientRect();
    const mid = box.top + box.height / 2;
    const over = darks.some((section) => {
      const r = section.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    });
    header.classList.toggle('on-dark', over);
  };

  let last = 0;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 24);
    header.classList.toggle('is-hidden', y > last && y > 240);
    last = y;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => { updateDark(); ticking = false; });
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateDark, { passive: true });
  onScroll();
  updateDark();
}
