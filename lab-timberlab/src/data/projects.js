/**
 * Projects — the most important content on the site.
 * In WordPress: Custom Post Type "project" with fields matching these keys.
 *
 * Imagery: temporary Unsplash photography (loads on any online machine).
 * Replace `src` with the client's photography; if an image fails to load,
 * a designed local placeholder is swapped in automatically (see modules/images.js).
 */
const u = (id, w = 1800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const projects = [
  {
    slug: 'tampines-quiet-grid',
    number: '01',
    title: 'The Quiet Grid',
    propertyType: 'HDB',
    homeType: '4-Room Resale',
    location: 'Tampines',
    direction: 'Warm minimal',
    year: 'Completed —', // PLACEHOLDER
    summary: 'A resale flat re-planned around one long line of joinery, so the living, dining and study read as a single, calm room.',
    brief: 'The owners wanted a home that felt larger than its floor area, with space to work from home and host family on weekends, without the clutter that usually comes with both.',
    response: 'We removed a non-structural partition, extended the kitchen counter into a dining ledge, and ran a single wall of oak-veneer storage the full length of the flat. Everything has a place, so the surfaces can stay empty.',
    details: ['Full-height oak veneer joinery', 'Micro-cement feature wall', 'Concealed cove lighting', 'Large-format porcelain floor'],
    cover: u('photo-1600210492486-724fe5c67fb0'),
    gallery: [
      { src: u('photo-1600607687939-ce8a6c25118c'), alt: 'Living area with continuous joinery', size: 'wide' },
      { src: u('photo-1600566753086-00f18fb6b3ea'), alt: 'Dining ledge detail', size: 'tall' },
      { src: u('photo-1600573472591-ee6b68d14c68'), alt: 'Kitchen looking towards the living room', size: 'square' },
      { src: u('photo-1600121848594-d8644e57abab'), alt: 'Master bedroom', size: 'wide' },
    ],
    before: u('photo-1502672260266-1c1ef2d93688'),
    after: u('photo-1600210492486-724fe5c67fb0'),
  },
  {
    slug: 'punggol-north-light',
    number: '02',
    title: 'North Light',
    propertyType: 'BTO',
    homeType: '5-Room',
    location: 'Punggol',
    direction: 'Soft contemporary',
    year: 'Completed —',
    summary: 'A new BTO flat with a north-facing living room, planned so that the daylight reaches the deepest corner of the kitchen.',
    brief: 'A young couple with a first home and a clear wish list: a proper kitchen for cooking, a bedroom that felt like a hotel, and nothing that would date quickly.',
    response: 'We kept the palette to three materials and let the plan do the work. A glazed kitchen partition borrows light, and the bedroom is wrapped in a single tone of limewash.',
    details: ['Glazed steel kitchen partition', 'Limewash bedroom walls', 'Fluted oak headboard wall', 'Terrazzo vanity top'],
    cover: u('photo-1616486338812-3dadae4b4ace'),
    gallery: [
      { src: u('photo-1615873968403-89e068629265'), alt: 'Kitchen with glazed partition', size: 'wide' },
      { src: u('photo-1616594039964-ae9021a400a0'), alt: 'Bedroom in limewash', size: 'tall' },
      { src: u('photo-1600494603989-9650cf6ddd3d'), alt: 'Bathroom vanity', size: 'square' },
    ],
    before: u('photo-1493809842364-78817add7ffc'),
    after: u('photo-1616486338812-3dadae4b4ace'),
  },
  {
    slug: 'novena-terrace-house',
    number: '03',
    title: 'Terrace, Re-read',
    propertyType: 'Landed',
    homeType: 'Terrace House',
    location: 'Novena',
    direction: 'Modern tropical',
    year: 'Completed —',
    summary: 'An inter-terrace house opened up around its air-well, so every level shares the same shaft of light.',
    brief: 'A three-generation family wanted to stay in the house they had lived in for decades, but with the plan re-thought for how they live now.',
    response: 'Ground floor walls came down, the stair was rebuilt as a lighter steel and timber element, and the air-well became a planted court that all the rooms look into.',
    details: ['Steel and timber stair', 'Planted internal court', 'Full-height sliding screens', 'Honed granite flooring'],
    cover: u('photo-1600047509807-ba8f99d2cdde'),
    gallery: [
      { src: u('photo-1600585154340-be6161a56a0c'), alt: 'Ground floor living court', size: 'wide' },
      { src: u('photo-1618221195710-dd6b41faaea6'), alt: 'Family room', size: 'square' },
      { src: u('photo-1615874959474-d609969a20ed'), alt: 'Stair detail', size: 'tall' },
    ],
    before: u('photo-1513694203232-719a280e022f'),
    after: u('photo-1600047509807-ba8f99d2cdde'),
  },
  {
    slug: 'river-valley-apartment',
    number: '04',
    title: 'One Long Room',
    propertyType: 'Condominium',
    homeType: '3-Bedroom',
    location: 'River Valley',
    direction: 'Quiet luxury',
    year: 'Completed —',
    summary: 'A condominium apartment reorganised as one continuous living space, with the bedrooms tucked behind a wall of walnut.',
    brief: 'The client entertains often and wanted the apartment to feel like a single generous room, while keeping the private spaces genuinely private.',
    response: 'Two smaller rooms merged into the living space; a walnut wall with flush doors hides the bedroom wing. Lighting is layered and mostly indirect.',
    details: ['Walnut veneer wall with flush doors', 'Stone-clad island', 'Indirect layered lighting', 'Wool carpet in bedrooms'],
    cover: u('photo-1556228453-efd6c1ff04f6'),
    gallery: [
      { src: u('photo-1556912172-45b7abe8b7e1'), alt: 'Kitchen island', size: 'wide' },
      { src: u('photo-1522708323590-d24dbb6b0267'), alt: 'Living room', size: 'square' },
      { src: u('photo-1505691938895-1758d7feb511'), alt: 'Bedroom', size: 'tall' },
    ],
    before: u('photo-1554995207-c18c203602cb'),
    after: u('photo-1556228453-efd6c1ff04f6'),
  },
  {
    slug: 'bishan-family-flat',
    number: '05',
    title: 'Room to Grow',
    propertyType: 'HDB',
    homeType: 'Executive Maisonette',
    location: 'Bishan',
    direction: 'Playful classic',
    year: 'Completed —',
    summary: 'A maisonette for a family of five, with storage designed to grow with the children rather than be replaced.',
    brief: 'Three children, two working parents, and a maisonette that had not been touched in twenty years.',
    response: 'The lower floor became one open family level. Upstairs, each bedroom got a modular built-in system that adapts from cot to study desk.',
    details: ['Modular children\'s joinery', 'Arched openings', 'Chequered terrazzo entry', 'Painted timber panelling'],
    cover: u('photo-1560448204-e02f11c3d0e2'),
    gallery: [
      { src: u('photo-1560185007-cde436f6a4d0'), alt: 'Family kitchen', size: 'wide' },
      { src: u('photo-1583847268964-b28dc8f51f92'), alt: 'Living room', size: 'tall' },
      { src: u('photo-1560448075-bb485b067938'), alt: 'Study nook', size: 'square' },
    ],
    before: u('photo-1484154218962-a197022b5858'),
    after: u('photo-1560448204-e02f11c3d0e2'),
  },
  {
    slug: 'sengkang-bto-studio',
    number: '06',
    title: 'Small, Exact',
    propertyType: 'BTO',
    homeType: '3-Room',
    location: 'Sengkang',
    direction: 'Japandi',
    year: 'Completed —',
    summary: 'A compact flat where every centimetre was drawn, so a small home never feels like a compromise.',
    brief: 'A single owner, a modest budget and an ambition for the flat to feel like a considered, calm retreat.',
    response: 'Joinery does the heavy lifting: a platform bed with storage below, a fold-away desk and a kitchen that reads as furniture.',
    details: ['Platform bed with storage', 'Fold-away oak desk', 'Furniture-style kitchen', 'Washi paper pendant lighting'],
    cover: u('photo-1595526114035-0d45ed16cfbf'),
    gallery: [
      { src: u('photo-1616594039964-ae9021a400a0'), alt: 'Platform bed', size: 'wide' },
      { src: u('photo-1616486338812-3dadae4b4ace'), alt: 'Living corner', size: 'square' },
    ],
    before: u('photo-1493809842364-78817add7ffc'),
    after: u('photo-1595526114035-0d45ed16cfbf'),
  },
];

export const getProject = (slug) => projects.find((p) => p.slug === slug) || projects[0];
export const nextProject = (slug) => {
  const i = projects.findIndex((p) => p.slug === slug);
  return projects[(i + 1) % projects.length];
};
