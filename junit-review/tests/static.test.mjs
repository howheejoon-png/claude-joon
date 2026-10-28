// Static checks on the shipped file: self-contained, offline, no storage, no
// HTML injection sinks, and a Content-Security-Policy that matches its scripts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ROOT } from './load-engine.mjs'

const html = readFileSync(join(ROOT, 'junit-review.html'), 'utf8')
const scripts = Array.from(html.matchAll(/<script id="(\w+)">([\s\S]*?)<\/script>/g)).map((m) => ({ id: m[1], body: m[2] }))
const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)[1]

test('the built file is up to date with the sources', () => {
  execFileSync(process.execPath, [join(ROOT, 'tools', 'build.mjs'), '--check'], { stdio: 'pipe' })
})

test('the CSP blocks every connection and pins each inline script by hash', () => {
  assert.match(csp, /default-src 'none'/)
  assert.match(csp, /connect-src 'none'/)
  assert.match(csp, /form-action 'none'/)
  assert.doesNotMatch(csp, /unsafe-eval/)
  assert.doesNotMatch(csp.split(';').find((d) => d.trim().startsWith('script-src')), /unsafe-inline/)
  assert.equal(scripts.length, 2)
  for (const s of scripts) {
    const h = createHash('sha256').update(s.body, 'utf8').digest('base64')
    assert.ok(csp.includes(`'sha256-${h}'`), 'hash for script #' + s.id)
  }
})

test('no external resources: no src/href to other hosts, no remote URLs', () => {
  assert.doesNotMatch(html, /<(script|link|img|iframe|object|embed|video|audio|source)\b[^>]*\s(src|href)=/i)
  const urls = Array.from(html.matchAll(/https?:\/\/[^\s"'<>)]+/g)).map((m) => m[0])
  // The SVG namespace identifier is a name, not a request.
  assert.deepEqual(Array.from(new Set(urls)).filter((u) => !u.startsWith('http://www.w3.org/2000/svg')), [])
})

test('no network, eval, storage or HTML-injection APIs anywhere in the code', () => {
  // Comments may name these APIs (e.g. to say they are not used); only code counts.
  const code = scripts.map((s) => s.body).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const banned = [
    /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /sendBeacon/, /\bimport\s*\(/, /\beval\s*\(/, /new\s+Function\s*\(/,
    /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /clipboard\.read/, /readText\s*\(/, /new\s+Worker\s*\(/, /serviceWorker/, /window\.open\s*\(/, /DOMParser/,
  ]
  for (const re of banned) assert.doesNotMatch(code, re, String(re))
})

test('inline event-handler attributes are not used (they would be blocked by the CSP)', () => {
  assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /\son[a-z]+\s*=/i)
})

test('text inputs opt out of spell-check services', () => {
  for (const m of html.matchAll(/<textarea\b[^>]*>/g)) assert.match(m[0], /spellcheck="false"/, m[0])
})

test('fixture inventory covers every scenario the specification lists', () => {
  const dirs = readdirSync(join(ROOT, 'tests', 'fixtures'))
  for (const d of ['controller-only', 'model-only', 'service-heavy', 'multi-class-cr', 'package-conventions', 'partial-snippets', 'duplicate-classes',
    'junit-without-jacoco', 'jacoco-100', 'jacoco-incomplete', 'missing-source-and-scope']) assert.ok(dirs.includes(d), d)
})

test('no syntax that older Edge/Chrome/Safari builds reject at parse time', () => {
  // One unsupported construct makes the whole script fail to parse, which leaves every button dead.
  const code = scripts.map((s) => s.body).join('\n')
  assert.doesNotMatch(code, /\(\?<[=!]/, 'regex lookbehind')
  assert.doesNotMatch(code, /\b\d+n\b/, 'BigInt literal')
  assert.doesNotMatch(code, /\?\?=|\|\|=|&&=/, 'logical assignment')
  assert.doesNotMatch(code, /\bstatic\s*\{/, 'class static block')
})

test('a visible start-up banner explains what to do if the scripts cannot run', () => {
  assert.match(html, /<div class="boot-warning" id="boot-warning" role="alert">/)
  assert.match(html, /\.js-ready \.boot-warning \{ display: none; \}/)
})
