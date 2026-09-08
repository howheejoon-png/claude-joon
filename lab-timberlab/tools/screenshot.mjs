// Usage: node tools/screenshot.mjs <url> <label> [width] [height] [scrollTo]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const [url = 'http://localhost:5173/', label = 'shot', w = '1440', h = '900', scrollTo = 'full'] = process.argv.slice(2);
const dir = path.resolve('shots'); fs.mkdirSync(dir, { recursive: true });
let n = 1; while (fs.existsSync(path.join(dir, `${label}-${n}.png`))) n++;
const out = path.join(dir, `${label}-${n}.png`);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 700, hasTouch: +w < 700 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(800);
if (scrollTo === 'full') {
  // scroll through so lazy reveals + ScrollTriggers fire, then capture full page
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 500) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(90); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: true });
} else {
  await page.evaluate((s) => { let y; if (s.startsWith('#')) { const [id, off] = s.split('+'); y = document.querySelector(id).getBoundingClientRect().top + window.scrollY + (+off || 0); } else y = +s; window.scrollTo(0, y); }, scrollTo);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: out });
}
console.log(out);
await browser.close();
