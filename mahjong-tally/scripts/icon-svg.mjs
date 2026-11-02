/**
 * Original Mahjong-tile-inspired app icon, drawn with plain shapes (no fonts),
 * so it renders identically everywhere. `padding` shrinks the tile for
 * maskable icons (Android crops to a circle/squircle).
 */
export function iconSvg({ size = 512, padding = 0.14, background = true, rounded = false } = {}) {
  const s = 512;
  const inner = s * (1 - padding * 2);
  const tileW = inner * 0.74;
  const tileH = inner;
  const x = (s - tileW) / 2;
  const y = (s - tileH) / 2;
  const r = tileW * 0.16;
  const cx = s / 2;
  const cy = y + tileH * 0.47;
  const ring = tileW * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="bg" cx="0.75" cy="0.1" r="1.1">
      <stop offset="0" stop-color="#16402f"/>
      <stop offset="0.55" stop-color="#0f1412"/>
      <stop offset="1" stop-color="#0b0d0c"/>
    </radialGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fdf9ee"/>
      <stop offset="1" stop-color="#ebe2c9"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0d394"/>
      <stop offset="1" stop-color="#b98a3e"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="${s}" height="${s}" ${rounded ? `rx="${s * 0.22}"` : ''} fill="url(#bg)"/>` : ''}
  <rect x="${x}" y="${y + tileH * 0.05}" width="${tileW}" height="${tileH * 0.95}" rx="${r}" fill="#0b5a3d"/>
  <rect x="${x}" y="${y}" width="${tileW}" height="${tileH * 0.93}" rx="${r}" fill="url(#face)"/>
  <rect x="${x + tileW * 0.08}" y="${y + tileW * 0.08}" width="${tileW * 0.84}" height="${tileH * 0.93 - tileW * 0.16}" rx="${r * 0.6}" fill="none" stroke="url(#gold)" stroke-width="${tileW * 0.022}" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="#0f7a52" stroke-width="${tileW * 0.075}"/>
  <circle cx="${cx}" cy="${cy}" r="${ring * 0.62}" fill="none" stroke="url(#gold)" stroke-width="${tileW * 0.04}"/>
  <circle cx="${cx}" cy="${cy}" r="${ring * 0.28}" fill="#0f7a52"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const a = (Math.PI / 4) * i;
      return `<circle cx="${cx + Math.cos(a) * ring * 1.0}" cy="${cy + Math.sin(a) * ring * 1.0}" r="${tileW * 0.022}" fill="#fdf9ee"/>`;
    })
    .join('')}
  <rect x="${cx - tileW * 0.22}" y="${y + tileH * 0.77}" width="${tileW * 0.44}" height="${tileW * 0.05}" rx="${tileW * 0.025}" fill="url(#gold)"/>
</svg>`;
}
