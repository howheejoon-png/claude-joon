/**
 * Compiles Tailwind and inlines the result into index.html.
 *
 * The page used to load the Tailwind Play CDN, which shipped a CSS compiler to
 * every visitor and generated the stylesheet in the browser on each page load —
 * render-blocking, and the single biggest reason the site was slow to first
 * paint. This does the same work once, here, at build time.
 *
 * Run it after changing any class in index.html:  npm run build:css
 */
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const START = '<!-- tailwind:start -->'
const END = '<!-- tailwind:end -->'

const out = join(mkdtempSync(join(tmpdir(), 'tw-')), 'out.css')
execFileSync('npx', ['tailwindcss', '-i', 'tailwind.input.css', '-o', out, '--minify'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const css = readFileSync(out, 'utf8').trim()

const html = readFileSync('index.html', 'utf8')
const a = html.indexOf(START)
const b = html.indexOf(END)
if (a === -1 || b === -1) {
  throw new Error(`index.html is missing the ${START} / ${END} markers`)
}

const block = `${START}\n  <style>${css}</style>\n  ${END}`
writeFileSync('index.html', html.slice(0, a) + block + html.slice(b + END.length))

console.log(`Inlined ${(css.length / 1024).toFixed(1)} KB of CSS into index.html`)
