import { boot } from '../main.js';
import { renderEnquiry } from '../components/enquiry.js';
import { heroIntro } from '../modules/motion.js';
renderEnquiry(document.querySelector('[data-enquiry]'));
boot('contact.html');
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.contact-page'))); else heroIntro(document.querySelector('.contact-page'));
