import { boot } from '../main.js';
import { projects, bySlug } from '../data/projects.js';
import { services } from '../data/services.js';
import { steps } from '../data/process.js';
import { renderEnquiry } from '../components/enquiry.js';
import { site } from '../data/site.js';
import { heroIntro, gsap, ScrollTrigger } from '../modules/motion.js';

const known = (v) => v && !/to be confirmed|^—$/i.test(v);
const tags = (p) => `<ul class="proj__tags">${[p.propertyType, p.homeType, p.location, p.direction].filter(known).map((t) => `<li>${t}</li>`).join('')}</ul>`;
const projCard = (p, shape, idx, opts = {}) => `
  <a class="proj proj--${shape}" href="project.html?p=${p.slug}" aria-label="${p.title}">
    ${opts.num ? `<div class="proj__num">${p.number}<sup>${p.propertyType}</sup></div>` : ''}
    <div class="frame frame--shade" data-reveal="clip" data-parallax="${opts.parallax ?? 8}"><img src="${p.cover}" alt="${p.title} — ${p.homeType}, ${p.location}" loading="${idx === 0 ? 'eager' : 'lazy'}" decoding="async" data-ph="${idx}"></div>
    <div class="proj__meta"><h3 class="proj__title">${p.title}</h3>${tags(p)}</div>
  </a>`;

function renderHero() {
  const p = projects[0];
  const bg = document.querySelector('[data-hero-img]');
  bg.innerHTML = `<img src="${p.hero || p.cover}" alt="${p.title} — ${p.homeType}, ${p.location}" fetchpriority="high" decoding="async" data-ph="0">`;
  // Ambient hero video: muted loop over the poster photo. Skipped for reduced-motion users; the photo stays if the file is missing or fails.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (site.hero?.video && !reduced) {
    const v = document.createElement('video');
    v.className = 'hero__video'; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'metadata';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    const addSources = (list, media) => (Array.isArray(list) ? list : [{ src: list, type: 'video/mp4' }]).forEach(({ src, type }) => {
      const s = document.createElement('source'); s.src = src; s.type = type; if (media) s.media = media; v.appendChild(s);
    });
    if (site.hero.videoMobile) addSources(site.hero.videoMobile, '(max-width: 899px)');
    addSources(site.hero.video);
    const fail = () => v.remove();
    v.addEventListener('error', fail);
    v.lastElementChild.addEventListener('error', fail); // only when the last candidate source fails
    v.addEventListener('canplay', () => { v.classList.add('is-ready'); v.play().catch(fail); }, { once: true });
    bg.appendChild(v);
    // Save battery: only play while the hero is on screen
    new IntersectionObserver((es) => es.forEach((e) => { if (!v.isConnected) return; e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }), { threshold: 0.05 }).observe(bg);
  }
}

function renderWork() {
  // Six projects on the homepage, matched to the slot shapes (landscape covers → wide, portrait covers → tall)
  const a = bySlug('tampines-greenverge-fluted'), b = bySlug('sembawang-country-kitchen'), c = bySlug('varsity-park');
  const d = bySlug('tampines-greenverge-stone'), e = bySlug('tanglin-regency'), f = bySlug('tampines-greenglen-limewash');
  document.querySelector('[data-work]').innerHTML = `
    <div class="work__item work__item--a">${projCard(a, 'wide', 1, { num: true, parallax: 10 })}</div>
    <div class="work__item work__item--b">${projCard(b, 'tall', 2, { num: true })}${projCard(c, 'square', 3, { num: true })}</div>
    <div class="work__item work__item--c">${projCard(d, 'land', 4, { num: true, parallax: 10 })}</div>
    <div class="work__item work__item--d">${projCard(e, 'square', 5, { num: true })}${projCard(f, 'tall', 6, { num: true })}</div>`;
}

function renderServices() {
  const list = document.querySelector('[data-services]');
  list.innerHTML = services.map((s, i) => `
    <div class="svc ${i === 0 ? 'is-open' : ''}" data-i="${i}" tabindex="0" role="button" aria-expanded="${i === 0}">
      <div class="svc__num">${s.num}</div>
      <h3 class="svc__title">${s.title}</h3>
      <p class="svc__desc">${s.desc}</p>
      <div class="svc__more"><div><ul>${s.points.map(p => `<li>${p}</li>`).join('')}</ul></div></div>
      <span class="svc__plus" aria-hidden="true"></span>
    </div>`).join('');
  const media = document.querySelector('[data-services-media]');
  media.innerHTML = services.map((s, i) => `<img src="${s.image}" alt="" class="${i === 0 ? 'is-active' : ''}" loading="lazy" decoding="async" data-ph="${i + 2}">`).join('') + `<div class="svc-media__cap label" data-cap>${services[0].title}</div>`;
  const imgs = media.querySelectorAll('img'); const cap = media.querySelector('[data-cap]');
  const activate = (i) => {
    list.querySelectorAll('.svc').forEach((el, j) => { el.classList.toggle('is-open', i === j); el.setAttribute('aria-expanded', String(i === j)); });
    imgs.forEach((im, j) => im.classList.toggle('is-active', i === j)); cap.textContent = services[i].title;
  };
  list.querySelectorAll('.svc').forEach((el) => {
    el.addEventListener('click', () => activate(Number(el.dataset.i)));
    el.addEventListener('mouseenter', () => { if (window.matchMedia('(hover:hover)').matches) activate(Number(el.dataset.i)); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(Number(el.dataset.i)); } });
  });
}

function renderProcess() {
  document.querySelector('[data-steps]').innerHTML = steps.map((s) => `
    <div class="step"><div class="step__card">
      <div class="step__num">${s.num}</div>
      <h3 class="step__title">${s.title}</h3>
      <p>${s.text}</p>
      <ul>${s.tags.map(t => `<li>${t}</li>`).join('')}</ul>
    </div></div>`).join('');

  const section = document.getElementById('process');
  const stepEls = [...section.querySelectorAll('.step')];
  stepEls[0].classList.add('is-active');
  const canvasHost = section.querySelector('.process__canvas');
  const fallback = section.querySelector('.process__fallback');
  const bar = section.querySelector('.process__progress .bar i');
  const stepLabel = section.querySelector('[data-step-label]');
  let scene = null, loaded = false;

  const progressTrigger = ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      scene?.setProgress(p);
      const idx = Math.min(steps.length - 1, Math.max(0, Math.floor((p - 0.25) / 0.25 + 0.001)));
      stepEls.forEach((el, i) => el.classList.toggle('is-active', i === idx));
      if (bar) bar.style.transform = `scaleX(${Math.max(0, (p - 0.25) / 0.75)})`;
      if (stepLabel) stepLabel.textContent = steps[idx].num;
    },
  });

  // Lazy-load Three.js only when the section approaches
  const load = async () => {
    if (loaded) return; loaded = true;
    try {
      const { createPlanScene } = await import('../modules/planScene.js');
      scene = createPlanScene(canvasHost, { onFail: () => fallback.classList.add('is-on') });
      if (!scene) { fallback.classList.add('is-on'); return; }
      scene.setProgress(progressTrigger.progress);
      gsap.fromTo(canvasHost, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' });
      vis.observe(section);
    } catch (e) { fallback.classList.add('is-on'); }
  };
  const near = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { load(); near.disconnect(); } }, { rootMargin: '120% 0px' });
  near.observe(section);
  const vis = new IntersectionObserver((es) => { es.forEach(e => e.isIntersecting ? scene?.start() : scene?.stop()); }, { rootMargin: '10% 0px' });
  window.addEventListener('pagehide', () => scene?.dispose());
}

boot('index.html');
renderHero();
renderWork();
renderServices();
renderProcess();
renderEnquiry(document.querySelector('[data-enquiry]'));
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.hero'))); else heroIntro(document.querySelector('.hero'));
