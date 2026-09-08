// Generates designed local placeholder "photographs": tonal fields with grain and an
// architectural line motif. Used only when real photography is unavailable.
import fs from 'node:fs';
const tones = [
  ['#5b544b', '#3a3632'], ['#8d8478', '#5f5850'], ['#a39a8d', '#6f665c'], ['#4a4843', '#2b2a27'],
  ['#7b7268', '#4b453f'], ['#b3aa9c', '#7e766c'], ['#66605a', '#3d3934'], ['#9a9187', '#5b554e'],
];
tones.forEach(([a, b], i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
<defs>
  <radialGradient id="g1" cx="30%" cy="20%" r="90%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
  <radialGradient id="g2" cx="85%" cy="90%" r="70%"><stop offset="0" stop-color="#f4f2ed" stop-opacity=".18"/><stop offset="1" stop-color="#f4f2ed" stop-opacity="0"/></radialGradient>
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .12 0"/></filter>
</defs>
<rect width="1600" height="1200" fill="url(#g1)"/>
<rect width="1600" height="1200" fill="url(#g2)"/>
<g stroke="#f4f2ed" stroke-opacity=".22" fill="none" stroke-width="1.5">
  <rect x="${200 + i * 30}" y="${160 + i * 20}" width="${900 - i * 40}" height="${700 - i * 30}"/>
  <path d="M${200 + i * 30} ${520 + i * 10}H${1100 - i * 10}"/>
  <path d="M${640 + i * 20} ${160 + i * 20}V${860 - i * 10}"/>
</g>
<rect width="1600" height="1200" filter="url(#n)"/>
<text x="64" y="1140" font-family="DM Mono, monospace" font-size="20" letter-spacing="3" fill="#f4f2ed" fill-opacity=".55">PROJECT PHOTOGRAPHY — PLACEHOLDER ${String(i + 1).padStart(2, '0')}</text>
</svg>`;
  fs.writeFileSync(`public/img/ph/ph-${i + 1}.svg`, svg);
});
console.log('placeholders written');
