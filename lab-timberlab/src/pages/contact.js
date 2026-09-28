import { boot } from '../main.js';
import { renderEnquiry, renderContactAlt } from '../components/enquiry.js';
import { heroIntro } from '../modules/motion.js';
renderEnquiry(document.querySelector('[data-enquiry]'));
renderContactAlt(document.querySelector('[data-contact]'), { hours: true });
boot('contact.html');
if (document.fonts?.ready) document.fonts.ready.then(() => heroIntro(document.querySelector('.contact-page'))); else heroIntro(document.querySelector('.contact-page'));
