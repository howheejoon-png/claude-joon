import { site } from '../data/site.js';

const arrow = `<svg class="arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12L12 2M4 2h8v8"/></svg>`;

export function renderHeader(current = '') {
  const host = document.getElementById('site-header');
  if (!host) return;
  const links = site.nav.map((n) => `<a href="${n.href}" ${n.href === current ? 'aria-current="page"' : ''}>${n.label}</a>`).join('');
  host.className = 'site-header';
  host.innerHTML = `
    <div class="container">
      <a class="brand" href="index.html" aria-label="L.A.B by Timberlab — home">
        <span class="brand__mark">L<span class="dot">.</span>A<span class="dot">.</span>B</span>
        <span class="brand__by">by Timberlab</span>
      </a>
      <nav class="nav" aria-label="Primary">${links}</nav>
      <div class="header-cta">
        <a class="btn" href="${site.cta.href}"><span class="btn__dot"></span>${site.cta.label}</a>
        <button class="menu-btn" type="button" aria-controls="site-menu" aria-expanded="false"><span>Menu</span><span class="bars"></span></button>
      </div>
    </div>`;

  // Full-screen menu
  const menu = document.createElement('div');
  menu.id = 'site-menu';
  menu.className = 'menu';
  menu.setAttribute('aria-hidden', 'true');
  menu.innerHTML = `
    <div class="menu__brand"><span class="brand__mark">L<span class="dot" style="color:var(--signal)">.</span>A<span class="dot" style="color:var(--signal)">.</span>B</span></div>
    <button class="menu__close" type="button"><span>Close</span><svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" stroke-width="1.5"><path d="M1 1l12 12M13 1L1 13"/></svg></button>
    <ul class="menu__list">
      ${[{ label: 'Home', href: 'index.html' }, ...site.nav].map((n, i) => `<li><a href="${n.href}"><span><span class="idx">0${i + 1}</span>${n.label}</span></a></li>`).join('')}
    </ul>
    <div class="menu__foot">
      <div><strong>Start a project</strong><a href="contact.html">Tell us about your home ${arrow}</a></div>
      <div><strong>Contact</strong><a href="mailto:${site.contact.email}">${site.contact.email}</a><br>${site.contact.phone}</div>
    </div>`;
  document.body.appendChild(menu);

  const btn = host.querySelector('.menu-btn');
  const close = menu.querySelector('.menu__close');
  const setOpen = (open) => {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('lenis-stopped', open);
    if (window.__lenis) open ? window.__lenis.stop() : window.__lenis.start();
  };
  btn.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  // Scroll behaviour: solid after hero, hide on scroll down, show on scroll up
  let last = 0;
  const onScroll = () => {
    const y = window.scrollY;
    host.classList.toggle('is-solid', y > 24);
    host.classList.toggle('is-hidden', y > last && y > 240);
    last = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function watchDarkSections(headerEl = document.getElementById('site-header')) {
  // Flip header colour when a dark section sits behind it
  const darks = document.querySelectorAll('[data-header="dark"]');
  if (!darks.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.target.__in = e.isIntersecting; });
    headerEl.classList.toggle('on-dark', [...darks].some((d) => d.__in));
  }, { rootMargin: '-1px 0px -99% 0px' });
  darks.forEach((d) => io.observe(d));
}
