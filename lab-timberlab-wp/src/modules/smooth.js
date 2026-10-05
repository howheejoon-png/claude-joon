import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initSmoothScroll() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return null;
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
  // Anchor links
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    // Only intercept links pointing at a section on this very page.
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || url.host !== location.host) return;
    const target = url.hash && document.getElementById(url.hash.slice(1));
    if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: 0, duration: 1.4 }); }
  });
  return lenis;
}
