/* Shared bootstrap — every page imports this first. */
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/sections.css';
import './styles/pages.css';

import { renderHeader, watchDarkSections } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { initImageFallbacks } from './modules/images.js';
import { initSmoothScroll } from './modules/smooth.js';
import { initReveals, ScrollTrigger } from './modules/motion.js';

export function boot(current) {
  initImageFallbacks();
  renderHeader(current);
  renderFooter();
  initSmoothScroll();
  const grain = document.createElement('div'); grain.className = 'grain'; grain.setAttribute('aria-hidden', 'true'); document.body.appendChild(grain);
  // Reveals run after fonts settle so line-splitting measures the right font
  const run = () => { initReveals(); watchDarkSections(); ScrollTrigger.refresh(); };
  if (document.fonts?.ready) document.fonts.ready.then(run); else run();
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
