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

  let last = 0;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 24);
    header.classList.toggle('is-hidden', y > last && y > 240);
    last = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Flip the header to light type while a dark section sits behind it.
  const darks = document.querySelectorAll('[data-header="dark"]');
  if (darks.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { e.target.__in = e.isIntersecting; });
      header.classList.toggle('on-dark', [...darks].some((d) => d.__in));
    }, { rootMargin: '-1px 0px -99% 0px' });
    darks.forEach((d) => io.observe(d));
  }
}
