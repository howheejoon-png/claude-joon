import gsap from 'gsap';

export function initCursor() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;
  const el = document.createElement('div');
  el.className = 'cursor';
  el.innerHTML = `<div class="cursor__dot"></div><div class="cursor__ring"><span>View</span></div>`;
  document.body.appendChild(el);
  document.body.classList.add('has-cursor');
  const label = el.querySelector('.cursor__ring span');
  const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const view = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, [role="button"], label, .pill');
    if (view) { label.textContent = view.dataset.cursor || 'View'; el.classList.add('is-view'); }
    else el.classList.remove('is-view');
    el.classList.toggle('is-link', !!link && !view);
  });
  document.addEventListener('pointerleave', () => gsap.to(el, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(el, { opacity: 1, duration: 0.2 }));
}
