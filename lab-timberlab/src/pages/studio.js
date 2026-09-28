import { boot } from '../main.js';
import { heroIntro } from '../modules/motion.js';
import { initCounters } from '../modules/counter.js';
import { site } from '../data/site.js';

document.querySelector('[data-figures]').innerHTML = site.figures.map((f) => `
  <div class="figure">
    <div class="figure__val" ${Number.isFinite(f.value) ? `data-count="${f.value}" data-suffix="${f.suffix || ''}"` : ''}>—</div>
    <div class="figure__key">${f.label}</div>
  </div>`).join('');

boot('studio.html');
initCounters();
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.page-hero'))); else heroIntro(document.querySelector('.page-hero'));
