/**
 * Services — PLACEHOLDER wording.
 * The business is confirmed as a full-service interior design and design-and-build firm.
 * Individual service names and descriptions below are proposed, not confirmed.
 * In WordPress: CPT "service" or a repeater on the Services page.
 */
const u = (id, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const services = [
  {
    num: '01',
    title: 'Interior design',
    desc: 'Concept, spatial planning and detailed design for the whole home, from the first sketch to the last drawer pull.',
    points: ['Concept and mood direction', 'Layout and spatial planning', 'Material and colour palettes', 'Detailed drawings'],
    image: u('photo-1600607687939-ce8a6c25118c'),
  },
  {
    num: '02',
    title: 'Design & build',
    desc: 'One team carries the design through construction, so decisions on paper and decisions on site never disagree.',
    points: ['Single point of responsibility', 'Transparent costing', 'Coordinated trades', 'Quality checks at each stage'],
    image: u('photo-1600585154340-be6161a56a0c'),
  },
  {
    num: '03',
    title: 'Renovation',
    desc: 'Full and partial renovations for HDB, BTO, condominium and landed homes, handled within the relevant guidelines.',
    points: ['Hacking and re-planning', 'Wet works and flooring', 'Electrical and plumbing', 'Painting and finishing'],
    image: u('photo-1616486338812-3dadae4b4ace'),
  },
  {
    num: '04',
    title: 'Custom carpentry',
    desc: 'Joinery designed for the specific room and the specific person, made to measure rather than off the shelf.',
    points: ['Full-height wardrobes', 'Kitchen systems', 'Feature walls and panelling', 'Built-in furniture'],
    image: u('photo-1556912172-45b7abe8b7e1'),
  },
  {
    num: '05',
    title: 'Project management',
    desc: 'Schedules, site supervision and communication, so you know what is happening and when, without chasing.',
    points: ['Programme and milestones', 'Site supervision', 'Progress updates', 'Handover and defects'],
    image: u('photo-1600047509807-ba8f99d2cdde'),
  },
];

export const homeTypes = [
  { key: 'HDB', label: 'HDB', sub: 'Resale flats', desc: 'Re-planning older flats around how you live today, within HDB renovation guidelines.' },
  { key: 'BTO', label: 'BTO', sub: 'New flats', desc: 'Getting a bare unit right the first time, with a plan that will still make sense in ten years.' },
  { key: 'Condominium', label: 'Condominium', sub: 'Private apartments', desc: 'Working with the building\'s rules and structure to make an apartment feel like it was designed for you.' },
  { key: 'Landed', label: 'Landed', sub: 'Terrace, semi-D, bungalow', desc: 'Larger interventions across levels, courtyards and gardens, coordinated as one project.' },
];
