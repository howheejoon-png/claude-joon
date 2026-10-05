/**
 * L.A.B by Timberlab — front-end entry.
 *
 * WordPress renders all content; this bundle is responsible for motion,
 * interaction and the 3D process scene only. Every behaviour below is a no-op
 * when its markup is absent, so one bundle serves every template.
 */
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/pages.css';
import './styles/wp.css';

import { initImageFallbacks } from './modules/images.js';
import { initSmoothScroll } from './modules/smooth.js';
import { initReveals, heroIntro, ScrollTrigger } from './modules/motion.js';
import { initCounters } from './modules/counter.js';
import { initHeader } from './behaviour/header.js';
import { initHeroVideo } from './behaviour/hero.js';
import { initServices } from './behaviour/services.js';
import { initFilter } from './behaviour/filter.js';
import { initBeforeAfter } from './behaviour/before-after.js';
import { initEnquiry } from './behaviour/enquiry.js';
import { initProcess } from './behaviour/process.js';

function boot() {
  initImageFallbacks();
  initHeader();
  initSmoothScroll();
  initHeroVideo();
  initServices();
  initFilter();
  initBeforeAfter();
  initEnquiry();
  initProcess();

  const grain = document.createElement('div');
  grain.className = 'grain';
  grain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grain);

  // Line splitting measures text, so wait for fonts before revealing.
  const run = () => {
    initReveals();
    initCounters();
    heroIntro(document.querySelector('.hero, .page-hero, .pd-hero, .contact-page'));
    ScrollTrigger.refresh();
  };
  document.fonts?.ready ? document.fonts.ready.then(run) : run();

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();
