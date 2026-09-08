// Capture the hero mid-playback (desktop + mobile) to check the video under the type
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'] });
for (const [w, h, name] of [[1440, 900, 'vid-desktop'], [390, 844, 'vid-mobile']]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 })).newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => { const v = document.querySelector('.hero__video'); return v ? { ready: v.classList.contains('is-ready'), paused: v.paused, t: v.currentTime, src: v.currentSrc, w: v.videoWidth } : 'no video element'; });
  console.log(name, JSON.stringify(st));
  await page.screenshot({ path: `shots/${name}.png` });
}
await browser.close();
