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
  contact: {
    // PLACEHOLDER — replace with confirmed studio details
    address: ['Studio address to be confirmed', 'Singapore'],
    phone: '+65 0000 0000',
    email: 'hello@labbytimberlab.sg',
    whatsapp: 'https://wa.me/6500000000',
    hours: 'Mon–Sat, by appointment',
    socials: [
      { label: 'Instagram', href: '#' },
      { label: 'Facebook', href: '#' },
      { label: 'Pinterest', href: '#' },
    ],
  },
};
