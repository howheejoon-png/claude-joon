// Loads the analysis engine exactly as shipped: the <script id="engine"> block
// of the built junit-review.html. It runs in this realm so that arrays and
// objects it returns compare normally with assert.deepStrictEqual.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function loadEngine() {
  const html = readFileSync(join(ROOT, 'junit-review.html'), 'utf8')
  const m = /<script id="engine">([\s\S]*?)<\/script>/.exec(html)
  if (!m) throw new Error('engine script not found in junit-review.html')
  if (!globalThis.JR) vm.runInThisContext(m[1], { filename: 'junit-review.html#engine' })
  return globalThis.JR
}
