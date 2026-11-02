/**
 * Generates the PWA icons in /public from the SVG design in icon-svg.mjs
 * using the Playwright Chromium already used for end-to-end tests.
 *   npm run icons
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { iconSvg } from './icon-svg.mjs';

const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

const targets = [
  { file: 'pwa-192x192.png', size: 192, opts: { padding: 0.12 } },
  { file: 'pwa-512x512.png', size: 512, opts: { padding: 0.12 } },
  { file: 'maskable-512x512.png', size: 512, opts: { padding: 0.2 } },
  { file: 'apple-touch-icon.png', size: 180, opts: { padding: 0.14 } },
];

await writeFile(pub('favicon.svg'), iconSvg({ size: 64, padding: 0.04, rounded: true }));
await writeFile(pub('logo-tile.svg'), iconSvg({ size: 512, padding: 0, background: false }));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${iconSvg({ size: t.size, ...t.opts })}</body></html>`,
  );
  await page.screenshot({ path: pub(t.file), omitBackground: false, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', t.file);
}
await browser.close();
