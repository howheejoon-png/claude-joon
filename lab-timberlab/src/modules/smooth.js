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
    const a = e.target.closest('a[href^="#"], a[href*="index.html#"]');
    if (!a) return;
    const hash = a.getAttribute('href').split('#')[1];
    const target = hash && document.getElementById(hash);
    if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: 0, duration: 1.4 }); }
  });
  return lenis;
}
