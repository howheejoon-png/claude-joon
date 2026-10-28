#!/usr/bin/env node
// End-to-end check of the shipped page in a real browser (Playwright + Chromium).
//
//   node tests/e2e.mjs                 # needs the `playwright` package and a Chromium build
//   SHOTS_DIR=/some/dir node tests/e2e.mjs   # also save desktop / mobile / dark screenshots
//
// It serves junit-review.html from a throwaway localhost server, drives the UI
// the way a reviewer would (typing details, pasting evidence, editing,
// removing, copying), and asserts that the page never makes a network request
// beyond loading itself, never executes pasted markup, and stores nothing.
import http from 'node:http'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { ROOT } from './load-engine.mjs'

const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch (e) {
  console.error('Playwright is not available. Install it (npm i -D playwright) or run in an environment that provides it.')
  process.exit(2)
}

const FILE = join(ROOT, 'junit-review.html')
const FIX = join(ROOT, 'tests', 'fixtures')
const SHOTS = process.env.SHOTS_DIR || ''
const NOT_VERIFIED = 'Actual Code Coverage: NOT VERIFIED — JaCoCo execution evidence required.'
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(readFileSync(FILE))
}).listen(0)
const base = `http://localhost:${server.address().port}/`

const browser = await chromium.launch()
let failures = 0
async function step(name, fn) {
  try { await fn(); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n       ')) }
}

async function openPage(opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: opts.viewport || { width: 1440, height: 900 }, colorScheme: opts.dark ? 'dark' : 'light' }, opts.ctx || {}))
  if (opts.clipboard) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  const page = await context.newPage()
  const log = { requests: [], errors: [], dialogs: [] }
  page.on('request', (r) => log.requests.push(r.url()))
  page.on('pageerror', (e) => log.errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()) })
  page.on('dialog', async (d) => { log.dialogs.push(d.type() + ': ' + d.message()); await d.dismiss() })
  await page.goto(opts.url || base)
  return { page, context, log }
}

async function paste(page, text, type) {
  await page.click('#tab-evidence')
  await page.fill('#code', text)
  if (type) await page.selectOption('#input-type', type)
  await page.click('#btn-add')
}

async function settle(page) {
  await page.waitForTimeout(450)
}

const fixture = (dir) => readdirSync(join(FIX, dir)).filter((f) => f.endsWith('.txt')).sort().map((f) => readFileSync(join(FIX, dir, f), 'utf8'))

console.log('JUnit Review — end-to-end')

const { page, context, log } = await openPage({ clipboard: true })

await step('loads with no console errors, and the start-up banner is hidden', async () => {
  await settle(page)
  assert.deepEqual(log.errors, [])
  assert.equal(await page.isVisible('#boot-warning'), false)
  assert.equal(await page.textContent('#fact-tests'), '0 test classes · 0 test methods')
})

await step('JUnit code only: dashboard says coverage is NOT VERIFIED', async () => {
  await page.fill('#f-cr', 'CR-2026-0142')
  await page.fill('#f-app', 'Notification Service')
  for (const t of fixture('junit-without-jacoco')) await paste(page, t)
  await settle(page)
  assert.equal(await page.textContent('#fact-tests'), '1 test class · 8 test methods')
  await page.click('#tab-review')
  await settle(page)
  const cov = await page.textContent('#sec-coverage')
  assert.ok(cov.includes(NOT_VERIFIED))
  assert.ok((await page.textContent('#sec-conclusion')).includes('Insufficient Evidence'))
})

await step('running count and duplicate warning when the same text is pasted again', async () => {
  const t = fixture('junit-without-jacoco')[0]
  await page.click('#tab-evidence')
  await page.fill('#code', t)
  await page.click('#btn-add')
  assert.ok(await page.isVisible('#dup-warning'))
  assert.match(await page.textContent('#dup-warning'), /Identical to snippet #1/)
  await page.click('#dup-warning >> text=Cancel')
  assert.equal(await page.locator('.snippet').count(), 2)
})

await step('edit, replace and remove (with undo) individual snippets', async () => {
  await page.click('#tab-evidence')
  const first = page.locator('.snippet', { hasText: '#1' }).first()
  await first.locator('button', { hasText: 'Edit' }).click()
  assert.match(await page.textContent('#editor-title'), /Edit snippet #1/)
  const text = await page.inputValue('#code')
  await page.fill('#code', text.replace('class TemplateRendererTest', 'class TemplateRendererTest /* edited */'))
  await page.click('#btn-add')
  await settle(page)
  await page.locator('.snippet', { hasText: '#2' }).first().locator('button', { hasText: 'Remove' }).click()
  await settle(page)
  assert.equal(await page.locator('.snippet').count(), 1)
  await page.click('.toast >> text=Undo')
  await settle(page)
  assert.equal(await page.locator('.snippet').count(), 2)
  await page.locator('.snippet', { hasText: '#2' }).first().locator('button', { hasText: 'Replace' }).click()
  assert.equal(await page.inputValue('#code'), '')
  await page.fill('#code', fixture('junit-without-jacoco')[1])
  await page.click('#btn-add')
  await settle(page)
  assert.equal(await page.textContent('#fact-tests'), '1 test class · 8 test methods')
})

await step('pasted HTML and script text is shown as text and never runs', async () => {
  const evil = [
    'package evil;',
    'import org.junit.jupiter.api.Test;',
    'class XssTest {',
    '  @Test void <img src=x onerror=alert(1)>() {}',
    '  @Test void t() { String s = "<script>alert(2)</script><img src=x onerror=alert(3)>"; }',
    '}',
  ].join('\n')
  await paste(page, evil, 'test')
  await paste(page, '<?xml version="1.0"?><report name="<img src=x onerror=alert(4)>"><package name="a"><class name="a/&lt;script&gt;alert(5)&lt;/script&gt;" sourcefilename="X.java"><counter type="LINE" missed="1" covered="0"/></class></package><counter type="LINE" missed="1" covered="0"/></report>', 'jacoco')
  await page.click('#tab-enhancement')
  await page.fill('#f-cr', '<img src=x onerror=alert(6)>')
  await page.click('#tab-review')
  await settle(page)
  await page.click('#tab-report')
  await settle(page)
  await page.click('#tab-review')
  assert.deepEqual(log.dialogs, [])
  const injected = await page.evaluate(() => document.querySelectorAll('img, script:not(#engine):not(#ui), iframe, object, embed').length)
  assert.equal(injected, 0)
  assert.ok((await page.textContent('#fact-cr')).includes('<img src=x onerror=alert(6)>'))
})

await step('evidence links open the snippet viewer at the referenced line', async () => {
  await page.click('#tab-review')
  await page.locator('#sec-quality .ev-link').first().click()
  await page.waitForSelector('#viewer[open]')
  const focus = await page.locator('#viewer .cl.is-focus').count()
  assert.equal(focus, 1)
  await page.click('#viewer-close')
})

await step('copy buttons put the report on the clipboard (only when clicked)', async () => {
  await page.click('#tab-report')
  await page.click('#btn-copy-text')
  await page.waitForTimeout(200)
  const text = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(text.startsWith('JUNIT CODE COVERAGE & TEST QUALITY REVIEW'))
  await page.click('#btn-copy-tsv')
  await page.waitForTimeout(200)
  const tsv = await page.evaluate(() => navigator.clipboard.readText())
  assert.ok(tsv.split('\n').some((l) => l.startsWith('Finding ID\tStatus\tSeverity')))
})

await step('backup text restores the same workspace', async () => {
  await page.click('#btn-backup')
  const backup = await page.inputValue('#modal .modal-text')
  await page.click('#modal-actions button:has-text("Close")')
  await page.click('#btn-clear')
  await page.click('#modal-actions button:has-text("Clear everything")')
  await settle(page)
  assert.equal(await page.locator('.snippet').count(), 0)
  await page.click('#btn-restore')
  await page.fill('#modal .modal-text', backup)
  await page.click('#modal-actions button:has-text("Restore")')
  await settle(page)
  assert.equal(await page.locator('.snippet').count(), 4)
  assert.equal(await page.inputValue('#f-cr'), '<img src=x onerror=alert(6)>')
})

await step('full scenario through the UI: controller enhancement with JaCoCo and diff', async () => {
  await page.click('#btn-clear')
  await page.click('#modal-actions button:has-text("Clear everything")')
  await page.click('#tab-enhancement')
  await page.fill('#f-cr', 'CR-2026-0200')
  await page.fill('#f-app', 'Catalogue')
  for (const t of fixture('controller-only')) await paste(page, t)
  await settle(page)
  await page.click('#tab-review')
  await settle(page)
  assert.ok((await page.textContent('#sec-coverage')).includes('73.07%'))
  assert.ok((await page.textContent('#sec-uncovered')).includes('Not executed'))
  assert.ok((await page.textContent('#sec-trace')).includes('updatePrice'))
  for (const key of ['summary', 'inventory', 'quality', 'trace', 'coverage', 'uncovered', 'evidence', 'conclusion']) assert.ok(await page.isVisible('#sec-' + key), key)
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, 'desktop-dashboard.png'), fullPage: false }) }
})

await step('nothing stored, and the security policy blocks network access', async () => {
  const storage = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length)
  assert.equal(storage, 0)
  const blocked = await page.evaluate(async () => { try { await fetch('/ping'); return false } catch (e) { return true } })
  assert.equal(blocked, true)
  const other = log.requests.filter((u) => u !== base)
  assert.deepEqual(other, [])
  assert.deepEqual(log.errors.filter((e) => !/Content Security Policy|Refused to connect|Failed to fetch/.test(e)), [])
})
await context.close()

await step('works when opened directly from disk (file://)', async () => {
  const { page: p, context: c, log: l } = await openPage({ url: pathToFileURL(FILE).href })
  await p.waitForTimeout(300)
  await paste(p, fixture('jacoco-100')[2])
  await p.waitForTimeout(450)
  assert.equal(await p.textContent('#fact-tests'), '1 test class · 5 test methods')
  assert.deepEqual(l.errors, [])
  assert.deepEqual(l.requests.filter((u) => !u.startsWith('file:')), [])
  await c.close()
})

await step('if scripts cannot run (preview window, blocked scripts), the page says so instead of doing nothing', async () => {
  const { page: p, context: c } = await openPage({ url: pathToFileURL(FILE).href, ctx: { javaScriptEnabled: false } })
  assert.equal(await p.isVisible('#boot-warning'), true)
  assert.match(await p.textContent('#boot-warning'), /open that saved copy directly in a current version of Microsoft Edge or Google Chrome/)
  await c.close()
})

await step('if the analysis engine cannot load (unsupported browser), the banner names the problem', async () => {
  const { page: p, context: c } = await openPage({ url: 'about:blank' })
  const html = readFileSync(FILE, 'utf8').replace(/<script id="engine">[\s\S]*?<\/script>/, '<script id="engine"></script>').replace(/script-src [^;]+;/, "script-src 'unsafe-inline';")
  await p.setContent(html)
  await p.waitForTimeout(200)
  assert.equal(await p.isVisible('#boot-warning'), true)
  assert.match(await p.textContent('#boot-detail'), /analysis engine did not load/)
  await c.close()
})

await step('usable at phone width and in dark mode', async () => {
  for (const [name, opts] of [['mobile', { viewport: { width: 390, height: 844 } }], ['dark', { dark: true }]]) {
    const { page: p, context: c, log: l } = await openPage(opts)
    for (const t of fixture('service-heavy')) await paste(p, t)
    await p.waitForTimeout(500)
    await p.click('#tab-review')
    await p.waitForTimeout(400)
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(overflow <= 1, name + ' horizontal overflow ' + overflow)
    assert.deepEqual(l.errors, [])
    if (SHOTS) await p.screenshot({ path: join(SHOTS, name + '-dashboard.png') })
    await c.close()
  }
})

await browser.close()
server.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll end-to-end checks passed')
process.exit(failures ? 1 : 0)
