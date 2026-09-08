import { boot } from '../main.js';
import { services, homeTypes } from '../data/services.js';
import { steps } from '../data/process.js';
import { heroIntro } from '../modules/motion.js';

const arrow = `<svg class="arrow" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12L12 2M4 2h8v8"/></svg>`;
document.querySelector('[data-services-full]').innerHTML = services.map((s, i) => `
  <article class="svc-full" id="${s.title.toLowerCase().replace(/[^a-z]+/g, '-')}">
    <div class="svc-full__num" data-reveal="fade">${s.num}</div>
    <div class="svc-full__body">
      <h2 class="display" data-reveal="lines">${s.title}</h2>
      <p data-reveal="fade">${s.desc}</p>
      <ul data-stagger>${s.points.map(pt => `<li>${pt}</li>`).join('')}</ul>
      <a class="link" href="contact.html" data-reveal="fade">Discuss this for your home ${arrow}</a>
    </div>
    <div class="svc-full__media"><div class="frame" data-reveal="clip" data-parallax="6"><img src="${s.image}" alt="" loading="lazy" decoding="async" data-ph="${i + 1}"></div></div>
  </article>`).join('');
document.querySelector('[data-process]').innerHTML = steps.map(s => `<div class="plite"><div class="plite__num">${s.num}</div><h3>${s.title}</h3><p>${s.text}</p></div>`).join('');
document.querySelector('[data-types]').innerHTML = homeTypes.map((t) => `
  <div class="type"><h3 class="type__name"><small>${t.sub}</small>${t.label}</h3><p>${t.desc}</p><a class="link" href="projects.html?type=${t.key}">See ${t.label} projects ${arrow}</a></div>`).join('');
boot('services.html');
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.page-hero'))); else heroIntro(document.querySelector('.page-hero'));
