/**
 * Services — PLACEHOLDER wording.
 * The business is confirmed as a full-service interior design and design-and-build firm.
 * Individual service names and descriptions below are proposed, not confirmed.
 * In WordPress: CPT "service" or a repeater on the Services page.
 */
const img = (slug, n) => `img/projects/${slug}/${String(n).padStart(2, '0')}.jpg`;

export const services = [
  {
    num: '01',
    title: 'Interior design',
    desc: 'Concept, spatial planning and detailed design for the whole home, from the first sketch to the last drawer pull.',
    points: ['Concept and mood direction', 'Layout and spatial planning', 'Material and colour palettes', 'Detailed drawings'],
    image: img('tampines-greenglen-limewash', 3),
  },
  {
    num: '02',
    title: 'Design & build',
    desc: 'One team carries the design through construction, so decisions on paper and decisions on site never disagree.',
    points: ['Single point of responsibility', 'Transparent costing', 'Coordinated trades', 'Quality checks at each stage'],
    image: img('tampines-greenverge-stone', 4),
  },
  {
    num: '03',
    title: 'Renovation',
    desc: 'Full and partial renovations for HDB, BTO, condominium and landed homes, handled within the relevant guidelines.',
    points: ['Hacking and re-planning', 'Wet works and flooring', 'Electrical and plumbing', 'Painting and finishing'],
    image: img('sembawang-country-kitchen', 0),
  },
  {
    num: '04',
    title: 'Custom carpentry',
    desc: 'Joinery designed for the specific room and the specific person, made to measure rather than off the shelf.',
    points: ['Full-height wardrobes', 'Kitchen systems', 'Feature walls and panelling', 'Built-in furniture'],
    image: img('tampines-greenverge-fluted', 4),
  },
  {
    num: '05',
    title: 'Project management',
    desc: 'Schedules, site supervision and communication, so you know what is happening and when, without chasing.',
    points: ['Programme and milestones', 'Site supervision', 'Progress updates', 'Handover and defects'],
    image: img('tampines-greenverge-fluted', 3),
  },
];

export const homeTypes = [
  { key: 'HDB', label: 'HDB', sub: 'Resale flats', desc: 'Re-planning older flats around how you live today, within HDB renovation guidelines.' },
  { key: 'BTO', label: 'BTO', sub: 'New flats', desc: 'Getting a bare unit right the first time, with a plan that will still make sense in ten years.' },
  { key: 'Condominium', label: 'Condominium', sub: 'Private apartments', desc: 'Working with the building\'s rules and structure to make an apartment feel like it was designed for you.' },
  { key: 'Landed', label: 'Landed', sub: 'Terrace, semi-D, bungalow', desc: 'Larger interventions across levels, courtyards and gardens, coordinated as one project.' },
];
