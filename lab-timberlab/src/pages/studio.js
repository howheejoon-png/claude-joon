import { boot } from '../main.js';
import { heroIntro } from '../modules/motion.js';
boot('studio.html');
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.page-hero'))); else heroIntro(document.querySelector('.page-hero'));
