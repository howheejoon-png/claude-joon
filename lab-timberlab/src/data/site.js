/**
 * Site-level content. In WordPress this becomes Theme Options / Customizer fields.
 * Anything marked PLACEHOLDER must be confirmed with L.A.B before launch.
 */
export const site = {
  name: 'L.A.B',
  legalName: 'Timberlab Pte Ltd',
  tagline: 'Design & build studio · Singapore',
  nav: [
    { label: 'Projects', href: 'projects.html' },
    { label: 'Services', href: 'services.html' },
    { label: 'Process', href: 'index.html#process' },
    { label: 'Studio', href: 'studio.html' },
    { label: 'Contact', href: 'contact.html' },
  ],
  cta: { label: 'Start a project', href: 'contact.html' },
  homeTypes: ['HDB', 'BTO', 'Condominium', 'Landed'],
  // Homepage hero: a looping ambient video over the featured project's photo (the photo is the poster/fallback).
  // Files are produced by tools/process-video.sh from the source clip. Leave `video` null to use the photo only.
  hero: {
    video: [{ src: 'video/hero.webm', type: 'video/webm' }, { src: 'video/hero.mp4', type: 'video/mp4' }],
    videoMobile: [{ src: 'video/hero-mobile.webm', type: 'video/webm' }, { src: 'video/hero-mobile.mp4', type: 'video/mp4' }],
  },
  /**
   * PLACEHOLDER figures. These are SAMPLE values so the counting animation can be
   * reviewed — they are NOT L.A.B's real numbers. Replace each `value` with the
   * confirmed figure, or set it to null to show an em-dash until it is supplied.
   */
  figures: [
    { value: 12, suffix: '+', label: 'Years in practice' },
    { value: 260, suffix: '+', label: 'Homes completed' },
    { value: 18, suffix: '', label: 'In-house team' },
  ],
  contact: {
    // PLACEHOLDER — replace with confirmed studio details
    address: ['47 Jln Pemimpin, #04-05', 'Halcyon 2, Singapore 577200'],
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=47+Jln+Pemimpin+%2304-05+Halcyon+2+Singapore+577200',
    phone: '+65 8993 8778',
    phoneHref: 'tel:+6589938778',
    email: 'sales@timberlab.sg',
    emailConfirmed: true,
    // Derived from the studio mobile number; confirm WhatsApp is active on it
    whatsapp: 'https://wa.me/6589938778',
    whatsappConfirmed: false,
    hours: [
      { days: 'Monday – Friday', time: '9am – 6pm' },
      { days: 'Saturday', time: '9am – 12pm' },
      { days: 'Sunday', time: 'Closed' },
    ],
    socials: [
      { label: 'Instagram', href: '#' },
      { label: 'Facebook', href: '#' },
      { label: 'Pinterest', href: '#' },
    ],
  },
};
