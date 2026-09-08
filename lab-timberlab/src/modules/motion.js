import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Split an element's text into lines wrapped for masked reveals. Keeps inline <em>/<i>. */
export function splitLines(el) {
  if (el.dataset.split === 'done') return [...el.querySelectorAll('.split-line > span')];
  const html = el.innerHTML;
  // wrap words in spans (preserve inline tags)
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const wrapWords = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(' '));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrapWords(n);
    });
  };
  wrapWords(tmp);
  el.innerHTML = tmp.innerHTML;
  const words = [...el.querySelectorAll('.w')];
  const lines = [];
  let top = null;
  words.forEach((w) => {
    const t = w.offsetTop;
    if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
    lines[lines.length - 1].push(w);
  });
  // rebuild: each line -> .split-line > span (must preserve em wrappers => use cloneNode of range)
  const out = [];
  el.innerHTML = '';
  lines.forEach((ws) => {
    const line = document.createElement('span'); line.className = 'split-line';
    const inner = document.createElement('span');
    ws.forEach((w, i) => {
      const em = w.closest('em, i');
      let node = w.cloneNode(true);
      if (em) { const e = document.createElement('em'); e.appendChild(node); node = e; }
      inner.appendChild(node);
      if (i < ws.length - 1) inner.appendChild(document.createTextNode(' '));
    });
    line.appendChild(inner);
    el.appendChild(line);
    el.appendChild(document.createTextNode(' '));
    out.push(inner);
  });
  el.dataset.split = 'done';
  return out;
}

export function initReveals(scope = document) {
  const items = scope.querySelectorAll('[data-reveal]');
  items.forEach((el) => {
    const type = el.dataset.reveal;
    if (reduced()) { el.classList.add('is-in'); if (type === 'lines') return; el.style.opacity = 1; return; }
    if (type === 'lines') {
      const spans = splitLines(el);
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => spans.forEach((s, i) => setTimeout(() => s.classList.add('is-in'), i * 90)),
      });
    } else if (type === 'clip') {
      el.classList.add('frame--reveal');
      ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-in') });
    } else {
      const delay = Number(el.dataset.delay || 0);
      gsap.set(el, { opacity: 0, y: 24 });
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1, delay, ease: 'power3.out' }),
      });
    }
  });
  // Parallax images
  if (!reduced()) {
    scope.querySelectorAll('.frame[data-parallax]').forEach((frame) => {
      const img = frame.querySelector('img');
      const amt = Number(frame.dataset.parallax) || 10;
      gsap.fromTo(img, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
  // Stagger groups
  scope.querySelectorAll('[data-stagger]').forEach((group) => {
    const kids = [...group.children];
    if (reduced()) return;
    gsap.set(kids, { opacity: 0, y: 20 });
    ScrollTrigger.create({ trigger: group, start: 'top 88%', once: true, onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }) });
  });
}

/** Hero intro: run once on load */
export function heroIntro(hero) {
  if (!hero) return;
  const title = hero.querySelector('[data-hero-title]');
  const spans = title ? splitLines(title) : [];
  const fades = hero.querySelectorAll('[data-hero-fade]');
  const frame = hero.querySelector('[data-hero-frame]');
  if (reduced()) { spans.forEach(s => s.classList.add('is-in')); fades.forEach(f => f.style.opacity = 1); frame?.classList.add('is-in'); return; }
  gsap.set(fades, { opacity: 0, y: 16 });
  const tl = gsap.timeline({ delay: 0.15 });
  tl.add(() => spans.forEach((s, i) => setTimeout(() => s.classList.add('is-in'), i * 110)), 0);
  tl.to(fades, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out' }, 0.5);
  if (frame) { frame.classList.add('frame--reveal'); tl.add(() => frame.classList.add('is-in'), 0.25); }
}

export { gsap, ScrollTrigger };
