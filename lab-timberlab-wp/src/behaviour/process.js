import gsap from 'gsap';
import { ScrollTrigger } from '../modules/motion.js';

/**
 * Drives the "From plan to place" section: scroll progress moves both the step
 * text and the 3D scene. Three.js is only fetched when the section nears the
 * viewport, and the section degrades to a static plan if WebGL is unavailable.
 */
export function initProcess() {
  const section = document.getElementById('process');
  if (!section) return;

  const host = section.querySelector('.process__canvas');
  const fallback = section.querySelector('.process__fallback');
  const bar = section.querySelector('.process__progress .bar i');
  const label = section.querySelector('[data-step-label]');
  const steps = [...section.querySelectorAll('.step')];
  const track = section.querySelector('.process__track');
  const count = Math.max(1, steps.length);

  // The section scrolls in over the first quarter; the steps share the rest.
  const ENTER = 0.25;
  const span = (1 - ENTER) / count;

  let scene = null;
  let loaded = false;

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      scene?.setProgress(p);

      const idx = Math.min(count - 1, Math.max(0, Math.floor((p - ENTER) / span)));
      steps.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      if (label) label.textContent = String(idx + 1).padStart(2, '0');
      if (bar) bar.style.transform = `scaleX(${Math.max(0, (p - ENTER) / (1 - ENTER))})`;
    },
  });

  const load = async () => {
    if (loaded || !host) return;
    loaded = true;
    try {
      const { createPlanScene } = await import('../modules/planScene.js');
      scene = createPlanScene(host, { onFail: () => fallback?.classList.add('is-on') });
      if (!scene) {
        fallback?.classList.add('is-on');
        return;
      }
      scene.setProgress(trigger.progress);
      gsap.fromTo(host, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' });
      visible.observe(section);
    } catch (err) {
      fallback?.classList.add('is-on');
    }
  };

  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      load();
      near.disconnect();
    }
  }, { rootMargin: '120% 0px' });
  near.observe(section);

  const visible = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? scene?.start() : scene?.stop()));
  }, { rootMargin: '10% 0px' });

  window.addEventListener('pagehide', () => scene?.dispose());
}
