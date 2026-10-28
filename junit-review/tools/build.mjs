#!/usr/bin/env node
/**
 * Assembles the single-file application.
 *
 *   src/shell.html      page skeleton with {{STYLES}}, {{ENGINE}}, {{UI}}, {{CSP}} slots
 *   src/styles.css      all styling
 *   src/engine/*.js     analysis engine (pure functions, no DOM) — concatenated in name order
 *   src/ui/*.js         rendering / interaction — concatenated in name order
 *
 * Output: junit-review.html, fully self-contained. The Content-Security-Policy
 * pins each inline <script> by its SHA-256 hash, so nothing but these exact
 * scripts can run and the page cannot open any network connection.
 *
 *   node tools/build.mjs           write junit-review.html
 *   node tools/build.mjs --check   exit 1 if junit-review.html is out of date
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = (p) => join(root, 'src', p)
const OUT = join(root, 'junit-review.html')

function concatDir(dir) {
  return readdirSync(src(dir))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => `/* ---- ${dir}/${f} ---- */\n` + readFileSync(join(src(dir), f), 'utf8').trimEnd())
    .join('\n\n')
}

const engine = `var JR = (function () {\n'use strict';\n\n${concatDir('engine')}\n})();\n`
// The UI first checks that the engine loaded; if anything fails at start-up it
// says why in the page's start-up banner instead of leaving dead buttons.
const ui = `(function () {
'use strict';

function bootFail(message) {
  var el = document.getElementById('boot-detail');
  if (el) el.textContent = message;
  document.documentElement.classList.remove('js-ready');
}

if (typeof JR === 'undefined') {
  bootFail('The analysis engine did not load in this browser. Please open the file in a current version of Microsoft Edge or Google Chrome.');
  return;
}

try {
${concatDir('ui')}
} catch (e) {
  bootFail('The page could not start in this browser (' + (e && e.message) + '). Please open the file in a current version of Microsoft Edge or Google Chrome.');
}
})();
`
const styles = readFileSync(src('styles.css'), 'utf8').trim()
const shell = readFileSync(src('shell.html'), 'utf8')

for (const [name, body] of [['engine', engine], ['ui', ui]]) {
  if (/<\/script/i.test(body)) throw new Error(`${name} contains "</script" — it would end the inline script early`)
}

const hash = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`
const csp = [
  "default-src 'none'",
  `script-src ${hash(engine)} ${hash(ui)}`,
  "style-src 'unsafe-inline'",
  'img-src data:',
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

// Replace via callbacks so "$" sequences in the sources are never interpreted.
const html = shell
  .replace('{{CSP}}', () => csp)
  .replace('{{STYLES}}', () => styles)
  .replace('{{ENGINE}}', () => engine)
  .replace('{{UI}}', () => ui)

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== html) {
    console.error('junit-review.html is out of date — run: node tools/build.mjs')
    process.exit(1)
  }
  console.log('junit-review.html is up to date')
} else {
  writeFileSync(OUT, html)
  console.log(`Wrote junit-review.html (${(html.length / 1024).toFixed(1)} KB)`)
}
