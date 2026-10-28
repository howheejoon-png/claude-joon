// Engine tests. Run with:  node --test tests/
//
// The engine is loaded from the BUILT junit-review.html (the file users get),
// so these tests exercise exactly what ships. Fixtures under tests/fixtures/
// are synthetic Java projects, each with an expected.json written
// independently of the parser.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadEngine, ROOT } from './load-engine.mjs'

const JR = loadEngine()
const FIX = join(ROOT, 'tests', 'fixtures')
const KIND = { test: 'test', source: 'source', jacoco: 'jacoco', jacococsv: 'jacoco', results: 'results', scope: 'scope', summary: 'summary' }
const NOT_VERIFIED = 'Actual Code Coverage: NOT VERIFIED — JaCoCo execution evidence required.'

function loadScenario(name, opts = {}) {
  const dir = join(FIX, name)
  const files = readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()
  const snippets = files.map((f, i) => ({
    id: 's' + (i + 1), seq: i + 1, type: opts.auto ? 'auto' : KIND[f.split('-')[1]],
    text: readFileSync(join(dir, f), 'utf8'), updatedAt: i + 1, file: f,
  }))
  const expected = existsSync(join(dir, 'expected.json')) ? JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) : {}
  const A = JR.analyze({ review: Object.assign({ crRef: 'CR-TEST', appName: 'Test App' }, opts.review || {}), snippets }, { now: 'test' })
  return { A, expected, snippets, files }
}

const findings = (A, rule) => A.findings.filter((f) => f.rule === rule)
const sectionStatus = (A, key) => A.sections.find((s) => s.key === key).status
const testClass = (A, fqcn) => A.testClasses.find((t) => t.fqcn === fqcn)
const counters = (c) => (c ? [c.missed, c.covered] : null)

/* ------------------------------------------------------------------ */
describe('coverage arithmetic', () => {
  test('percentages are floored, so 99.99% never shows as 100%', () => {
    assert.equal(JR.pctText(9999, 10000), '99.99%')
    assert.equal(JR.pctText(99999, 100000), '99.99%')
    assert.equal(JR.pctText(999999, 1000000), '99.99%')
    assert.equal(JR.pctText(10000, 10000), '100.00%')
    assert.equal(JR.pctText(2, 3), '66.66%')
    assert.equal(JR.pctText(1, 3), '33.33%')
    assert.equal(JR.pctText(0, 5), '0.00%')
  })
  test('a strict 100% threshold requires zero missed', () => {
    assert.equal(JR.meetsThreshold(9999, 10000, 100), false)
    assert.equal(JR.meetsThreshold(10000, 10000, 100), true)
    assert.equal(JR.meetsThreshold(9999, 10000, 99.99), true)
    assert.equal(JR.meetsThreshold(9998, 10000, 99.99), false)
    assert.equal(JR.meetsThreshold(85, 100, 85), true)
    assert.equal(JR.meetsThreshold(84, 100, 85), false)
  })
  test('a missing or zero-total counter is N/A, not 0% or 100%', () => {
    const m = JR.metricRow({ LINE: { missed: 0, covered: 4 } }, 'BRANCH', 100)
    assert.equal(m.na, true)
    assert.equal(m.pct, 'N/A')
    assert.equal(m.meets, null)
    assert.equal(m.strict, null)
    const z = JR.metricRow({ BRANCH: { missed: 0, covered: 0 } }, 'BRANCH', 100)
    assert.equal(z.na, true)
  })
})

/* ------------------------------------------------------------------ */
describe('safe parsing of untrusted text', () => {
  test('XML entities defined in a DOCTYPE are never expanded', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE report [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]>' +
      '<report name="&b;"><counter type="LINE" missed="1" covered="2"/></report>'
    const x = JR.parseXml(bomb)
    assert.equal(x.root.attrs.name, '&b;')
    const rep = JR.parseJacocoXml(bomb)
    assert.deepEqual(rep.totals.LINE, { missed: 1, covered: 2 })
  })
  test('predefined and numeric entities decode; truncated XML is reported', () => {
    const x = JR.parseXml('<a t="&lt;b&gt; &amp; &#65;&#x42;"><b>')
    assert.equal(x.root.attrs.t, '<b> & AB')
    assert.equal(x.truncated, true)
  })
  test('braces, @Test and comment markers inside strings, text blocks and comments do not affect structure', () => {
    const src = [
      'package p;',
      'import org.junit.jupiter.api.Test;',
      'class T {',
      '  // @Test void commented() {}',
      '  String s = "} { @Test // not a comment";',
      '  String j = """',
      '      { "a": "}" }',
      '      """;',
      '  char c = \'}\';',
      '  /* } { @Test */',
      '  @Test void real() { assertEquals("}", "}"); }',
      '}',
    ].join('\n')
    const p = JR.parseJava(src)
    assert.equal(p.issues.length, 0)
    const t = p.units[0].types[0]
    assert.equal(t.name, 'T')
    assert.deepEqual(t.methods.map((m) => m.name), ['real'])
    assert.equal(t.fields.length, 3)
  })
  test('"@Test" mentioned in a production comment does not make it test code', () => {
    const d = JR.detectType('package a;\npublic class A {\n  // see @Test testSearch\n  public int f() { return 1; }\n}')
    assert.equal(d.type, 'source')
  })
  test('TSV cells cannot inject spreadsheet formulas or break rows', () => {
    assert.equal(JR.tsvCell('=HYPERLINK("http://x","y")'), '\'=HYPERLINK("http://x","y")')
    assert.equal(JR.tsvCell('+cmd'), "'+cmd")
    assert.equal(JR.tsvCell('@SUM(A1)'), "'@SUM(A1)")
    assert.equal(JR.tsvCell('-1'), '-1')
    assert.equal(JR.tsvCell('a\tb\nc'), 'a b c')
  })
  test('pasted HTML/script text stays plain data in results and reports', () => {
    const evil = 'package x;\nimport org.junit.jupiter.api.Test;\nclass EvilTest {\n  @Test void t() { String s = "<img src=x onerror=alert(1)><script>alert(2)</script>"; }\n}'
    const A = JR.analyze({ review: { crRef: '<b>CR</b>' }, snippets: [{ id: 'e', seq: 1, type: 'auto', text: evil }] }, { now: 'x' })
    const report = JR.buildTextReport(A)
    assert.ok(report.includes('<b>CR</b>')) // kept verbatim as text — the UI renders it with textContent
    assert.equal(findings(A, 'NO_ASSERTION').length, 1)
  })
})

/* ------------------------------------------------------------------ */
describe('auto-detection', () => {
  test('every fixture paste is detected as its intended input type', () => {
    const misses = []
    for (const d of readdirSync(FIX)) {
      for (const f of readdirSync(join(FIX, d)).filter((x) => x.endsWith('.txt'))) {
        const det = JR.detectType(readFileSync(join(FIX, d, f), 'utf8'))
        if (det.type !== KIND[f.split('-')[1]]) misses.push(d + '/' + f + ' → ' + det.type)
      }
    }
    assert.deepEqual(misses, [])
  })
  test('auto mode reaches the same verdict as explicitly typed pastes', () => {
    for (const d of readdirSync(FIX)) {
      const typed = loadScenario(d).A.conclusion.status
      const auto = loadScenario(d, { auto: true }).A.conclusion.status
      assert.equal(auto, typed, d)
    }
  })
})

/* ------------------------------------------------------------------ */
describe('fixture expectations (all scenarios)', () => {
  for (const name of readdirSync(FIX).sort()) {
    const { A, expected, files } = loadScenario(name)
    test(name + ': test classes, methods and frameworks', () => {
      for (const [fqcn, e] of Object.entries(expected.testClasses || {})) {
        const tc = testClass(A, fqcn)
        assert.ok(tc, 'missing test class ' + fqcn)
        assert.deepEqual(tc.methods.map((m) => m.name).sort(), e.testMethods.slice().sort(), fqcn)
        if (e.framework) assert.equal(tc.framework, e.framework, fqcn)
        for (const dis of e.disabled || []) assert.ok(tc.methods.find((m) => m.name === dis || m.methodName === dis).disabled, dis)
      }
      // Methods pasted without any class are kept as an "unnamed fragment", which expected.json does not list.
      if (expected.testClasses) assert.equal(A.testClasses.filter((t) => !t.fragment).length, Object.keys(expected.testClasses).length)
    })
    test(name + ': incomplete pastes are flagged (and complete ones are not)', () => {
      for (const p of expected.pastes || []) {
        if (p.incomplete == null) continue
        const s = A.snippets[files.indexOf(p.file)]
        assert.equal(s.incomplete, !!p.incomplete, p.file + ': ' + s.incompleteReasons.join(' '))
      }
    })
    if (expected.jacoco) {
      test(name + ': JaCoCo counters, uncovered and partly covered lines', () => {
        const J = expected.jacoco
        if (J.reportTotals) for (const [k, v] of Object.entries(J.reportTotals)) assert.deepEqual(counters(A.jacoco.totals[k]), v, 'report ' + k)
        for (const [bin, cs] of Object.entries(J.classes || {})) {
          const c = A.jacoco.classes.get(bin)
          assert.ok(c, 'class ' + bin)
          for (const k of ['INSTRUCTION', 'BRANCH', 'LINE', 'METHOD', 'CLASS']) assert.deepEqual(counters(c.counters[k]), cs[k] || null, bin + ' ' + k)
        }
        const missed = {}
        const partial = {}
        for (const g of A.uncovered) {
          const file = g.outerBinary.slice(0, g.outerBinary.lastIndexOf('/') + 1) + g.sourcefile
          const m = g.lines.filter((l) => l.kind === 'missed').map((l) => l.nr)
          const p = g.branches.filter((b) => b.cb > 0).map((b) => b.nr)
          if (m.length) missed[file] = m
          if (p.length) partial[file] = p
        }
        assert.deepEqual(missed, J.uncoveredLines || {})
        assert.deepEqual(partial, J.partialBranchLines || {})
        const allStrict = A.coverage.assessed.metrics.every((m) => m.na || m.strict)
        if (J.reportTotals) assert.equal(allStrict, J.strict100)
      })
    }
    if (expected.results) {
      test(name + ': execution results', () => {
        const t = A.execution.totals
        assert.deepEqual([t.tests, t.failed, t.errors, t.skipped], [expected.results.tests, expected.results.failures, expected.results.errors, expected.results.skipped])
        const failed = A.findings.filter((f) => f.rule === 'TEST_FAILED').map((f) => f.testClass.split('.').pop() + '.' + f.testMethod)
        assert.deepEqual(failed.sort(), expected.results.failed.map((x) => x.split('.').slice(-2).join('.')).sort())
      })
    }
    if (expected.scope && expected.scope.changedProductionClasses) {
      test(name + ': declared scope', () => {
        const prod = A.coverage.scope.productionEntries.map((e) => e.fqcn || e.simpleName).sort()
        assert.deepEqual(prod, expected.scope.changedProductionClasses.slice().sort())
        for (const [path, lines] of Object.entries(expected.scope.addedLines || {})) {
          const e = A.coverage.scope.entries.find((x) => x.path === path)
          assert.deepEqual(e.addedLines, lines, path)
        }
      })
    }
    test(name + ': expected quality issues are reported', () => {
      for (const q of expected.quality || []) {
        const hit = A.findings.find((f) => f.rule === q.issue && f.testClass === q.class &&
          (q.issue === 'MIXED_JUNIT' || q.issue === 'COMMENTED_TEST' || !q.method || (f.testMethod || '').split('.').pop() === q.method ||
            (q.issue === 'DUPLICATE_TEST' && f.evidence.length === 2)))
        assert.ok(hit, q.issue + ' ' + q.class + '.' + q.method)
      }
    })
    test(name + ': production methods with no test are identified', () => {
      for (const [fqcn, e] of Object.entries(expected.productionClasses || {})) {
        const cr = A.trace && A.trace.classRows.find((c) => c.cls.fqcn === fqcn)
        if (!cr) continue
        for (const m of e.noTestMethods || []) {
          const row = cr.methods.find((r) => r.method.sourceName === m)
          assert.ok(row, fqcn + '.' + m)
          // Called only by other methods of the same class counts as indirect; interface declarations are N/A.
          assert.ok(['No apparent test', 'Indirectly exercised', 'Not applicable'].includes(row.status), fqcn + '.' + m + ' → ' + row.status)
        }
      }
    })
  }
})

/* ------------------------------------------------------------------ */
describe('scenarios required by the specification', () => {
  test('controller-only enhancement: status-only checks, untested secured endpoint, changed-line coverage', () => {
    const { A } = loadScenario('controller-only')
    assert.equal(A.conclusion.status, JR.STATUS.FAIL)
    assert.deepEqual(findings(A, 'STATUS_ONLY').map((f) => f.testMethod).sort(), ['getProduct_returnsOk', 'shouldReturn404WhenProductMissing', 'updateProduct'])
    assert.ok(findings(A, 'NO_APPARENT_TEST').some((f) => /updatePrice/.test(f.observation)))
    assert.ok(findings(A, 'NO_ACCESS_DENIED_TEST').length)
    const ch = A.coverage.scope.changed
    assert.ok(ch.assessable)
    assert.equal(ch.pass, false)
    const api = A.trace.classRows[0].methods.find((r) => r.method.sourceName === 'getProduct')
    assert.equal(api.status, JR.TRACE.API)
  })

  test('model-only enhancement at 100%: verified figures, but scope evidence is missing', () => {
    const { A } = loadScenario('model-only')
    assert.equal(A.coverage.assessed.pass, true)
    assert.equal(sectionStatus(A, 'coverage'), JR.STATUS.PASS)
    assert.equal(A.conclusion.status, JR.STATUS.INSUFFICIENT)
    assert.equal(findings(A, 'SCOPE_MISSING').length, 1)
    assert.ok(A.conclusion.limitations.some((l) => /whole-project coverage is not inferred/.test(l)))
    assert.ok(findings(A, 'WEAK_ASSERTION').some((f) => f.testMethod === 'toString_isNotNull'))
    assert.ok(testClass(A, 'com.acme.loyalty.model.MemberTest').methods.some((m) => m.name === 'Equality.sameInstanceIsEqual'))
  })

  test('service-heavy enhancement: 9999 of 10000 instructions is 99.99%, not 100%', () => {
    const { A } = loadScenario('service-heavy')
    const c = Array.from(A.jacoco.classes.values()).find((x) => x.counters.INSTRUCTION && x.counters.INSTRUCTION.missed === 1 && x.counters.INSTRUCTION.covered === 9999)
    assert.ok(c, 'fixture class with 1 missed of 10000')
    assert.equal(JR.metricRow(c.counters, 'INSTRUCTION', 100).pct, '99.99%')
    assert.equal(JR.metricRow(c.counters, 'INSTRUCTION', 100).meets, false)
    for (const rule of ['SWALLOWED_EXCEPTION', 'SLEEP', 'DISABLED', 'DUPLICATE_TEST', 'TEST_FAILED', 'TEST_SKIPPED']) assert.ok(findings(A, rule).length, rule)
    assert.ok(findings(A, 'NO_APPARENT_TEST').some((f) => /listOpenOrders/.test(f.observation)))
    assert.ok(findings(A, 'UNVERIFIED_INTERACTION').length)
    assert.equal(A.conclusion.status, JR.STATUS.FAIL)
  })

  test('multiple classes under one CR: name-status scope, unmeasured class, JUnit 4 and mixed classes', () => {
    const { A } = loadScenario('multi-class-cr')
    const S = A.coverage.scope
    assert.deepEqual(S.missingFromJacoco.map((r) => r.name), ['com.acme.invoicing.web.InvoiceController'])
    assert.ok(S.entries.some((e) => e.change === 'D'))
    assert.ok(S.otherEntries.some((e) => /\.sql$/.test(e.path)))
    assert.equal(testClass(A, 'com.acme.invoicing.service.InvoiceServiceImplTest').framework, 'junit4')
    assert.ok(findings(A, 'MIXED_JUNIT').length)
    assert.ok(findings(A, 'NOT_RUNNABLE').length)
    // An interface with no method bodies has no bytecode, so it is not "missing" from JaCoCo.
    assert.ok(!findings(A, 'SOURCE_NOT_IN_JACOCO').some((f) => /InvoiceRepository/.test(f.sourceClass)))
    // The XML and CSV copies of the same report agree and the XML detail is kept.
    assert.equal(A.jacoco.conflicts.length, 0)
    assert.ok(Array.from(A.jacoco.classes.values()).every((c) => c.format === 'xml'))
  })

  test('different package naming conventions, Excel-copied scope and CRLF pastes', () => {
    const { A } = loadScenario('package-conventions')
    const names = A.testClasses.map((t) => t.fqcn).sort()
    assert.ok(names.includes('LegacyDateHelperTest'))
    assert.ok(names.includes('sg.gov.agency.cpf.claims.web.ClaimControllerTest'))
    assert.ok(names.includes('gov.moh.platform.common.util.text.TextNormalizerTest'))
    assert.deepEqual(A.coverage.scope.modules.map((m) => m.name).sort(), ['billing-core', 'claims-service', 'common-lib', 'legacy-tools', 'sample-app'])
    for (const tc of A.testClasses) assert.equal(tc.targetFqcns.length, 1, tc.fqcn)
  })

  test('partial snippets are analysed as far as possible and flagged', () => {
    const { A } = loadScenario('partial-snippets')
    const frag = A.testClasses.find((t) => t.fragment)
    assert.deepEqual(frag.methods.map((m) => m.name).sort(), ['declinesInvalidPanWithoutCallingAcquirer', 'requestsScaAboveThreshold'])
    assert.equal(findings(A, 'PARTIAL_SNIPPET').length, 4)
    assert.ok(A.jacoco.warnings.some((w) => /cut off/.test(w.text)))
  })

  test('duplicate pastes never double-count tests; same simple name in different packages stays separate', () => {
    const { A } = loadScenario('duplicate-classes')
    assert.equal(A.testClasses.length, 3)
    assert.equal(A.inventory.testMethods, 4 + 2 + 2)
    assert.equal(A.snippets[1].duplicateOf, 1)
    const addr = A.duplicateClasses.find((d) => d.fqcn === 'com.acme.crm.address.AddressFormatterTest')
    assert.equal(addr.kept, 3)
    assert.ok(addr.details.some((x) => x.kind === 'no-package' && x.sameBody))
    assert.equal(testClass(A, 'com.acme.crm.address.AddressFormatterTest').methods.length, 4)
  })

  test('JUnit code without JaCoCo: coverage is NOT VERIFIED', () => {
    const { A } = loadScenario('junit-without-jacoco')
    assert.equal(A.coverage.notVerifiedText, NOT_VERIFIED)
    assert.equal(sectionStatus(A, 'coverage'), JR.STATUS.INSUFFICIENT)
    assert.equal(A.conclusion.status, JR.STATUS.INSUFFICIENT)
    assert.ok(JR.buildTextReport(A).includes(NOT_VERIFIED))
    assert.ok(JR.buildTsvReport(A, 'coverage').includes(NOT_VERIFIED))
    for (const rule of ['TAUTOLOGY', 'EMPTY_TEST', 'NOT_RUNNABLE', 'COMMENTED_TEST']) assert.ok(findings(A, rule).length, rule)
  })

  test('JaCoCo at 100% with matching scope and passing results: Verified Pass', () => {
    const { A } = loadScenario('jacoco-100')
    assert.equal(A.conclusion.status, JR.STATUS.PASS)
    for (const m of A.coverage.assessed.metrics) assert.ok(m.na || m.strict, m.type)
    assert.equal(A.coverage.scope.missingFromJacoco.length, 0)
    assert.equal(A.execution.totals.passed, 18)
  })

  test('the same 100% evidence fails when a real class in scope is unmeasured', () => {
    const base = loadScenario('jacoco-100')
    const snippets = base.snippets.map((s) => (s.file.includes('scope') ? Object.assign({}, s, { text: s.text + '\ncom.acme.common.text.NewHelper\n' }) : s))
    const A = JR.analyze({ review: { crRef: 'x', appName: 'y' }, snippets }, { now: 'x' })
    assert.equal(A.conclusion.status, JR.STATUS.INSUFFICIENT)
    assert.ok(findings(A, 'SCOPE_CLASS_NOT_IN_JACOCO').length)
  })

  test('JaCoCo showing incomplete coverage: never-executed class, N/A branches, changed lines, vendor conflict', () => {
    const { A } = loadScenario('jacoco-incomplete')
    assert.equal(A.conclusion.status, JR.STATUS.FAIL)
    assert.ok(findings(A, 'CLASS_NOT_EXECUTED').some((f) => /LegacyCarrierAdapter/.test(f.sourceClass)))
    const tn = A.jacoco.classes.get('com/acme/shipping/label/TrackingNumber')
    const br = JR.metricRow(tn.counters, 'BRANCH', 100)
    assert.equal(br.na, true)
    assert.equal(br.pct, 'N/A')
    const ch = A.coverage.scope.changed
    assert.deepEqual([ch.lines.total, ch.lines.covered, ch.lines.missed], [10, 7, 3])
    assert.ok(findings(A, 'DECLARED_CONFLICT').length >= 1)
    assert.ok(A.declared.entries.every((d) => d.provenance === 'Vendor-declared'))
  })

  test('missing source and scope evidence are flagged, and coverage is not stretched to the project', () => {
    const { A } = loadScenario('missing-source-and-scope')
    assert.equal(A.trace, null)
    assert.equal(sectionStatus(A, 'trace'), JR.STATUS.INSUFFICIENT)
    assert.equal(findings(A, 'SCOPE_MISSING').length, 1)
    assert.equal(A.coverage.assessed.basis, 'report')
    assert.ok(/no enhancement scope supplied/.test(A.coverage.assessed.description))
  })

  test('console test output (Surefire and Gradle) is counted per run summary', () => {
    const { A } = loadScenario('results-text')
    assert.deepEqual(A.execution.totals, { tests: 19, passed: 15, failed: 2, errors: 0, skipped: 2 })
  })
})

/* ------------------------------------------------------------------ */
describe('robustness', () => {
  test('truncated, spliced and mangled pastes never stop the analysis', () => {
    const texts = []
    for (const d of readdirSync(FIX)) for (const f of readdirSync(join(FIX, d)).filter((x) => x.endsWith('.txt'))) texts.push(readFileSync(join(FIX, d, f), 'utf8'))
    const types = ['auto', 'test', 'source', 'jacoco', 'results', 'scope', 'summary']
    let seed = 20261028
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n }
    for (let i = 0; i < 400; i++) {
      const snippets = []
      for (let k = 0, n = 1 + rnd(4); k < n; k++) {
        let t = texts[rnd(texts.length)]
        const mode = rnd(5)
        if (mode === 0) t = t.slice(0, rnd(t.length))
        else if (mode === 1) t = t.slice(rnd(t.length))
        else if (mode === 2) { const a = rnd(t.length), b = rnd(t.length); t = t.slice(0, Math.min(a, b)) + t.slice(Math.max(a, b)) }
        else if (mode === 3) t = t.replace(/[{}()<>"]/g, (c) => (rnd(7) === 0 ? '' : c))
        snippets.push({ id: 's' + k, seq: k + 1, type: types[rnd(types.length)], text: t, updatedAt: k })
      }
      const A = JR.analyze({ review: {}, snippets }, { now: 'x' })
      JR.buildTextReport(A)
      JR.buildTsvReport(A)
      assert.ok(Object.values(JR.STATUS).includes(A.conclusion.status))
    }
  })
  test('code copied out of a single Excel cell (quoted, quotes doubled) is unwrapped', () => {
    const java = 'package a;\nimport org.junit.jupiter.api.Test;\nclass QTest {\n  @Test void t() { assertEquals("x", f()); }\n}'
    const cell = '"' + java.replace(/"/g, '""') + '"'
    assert.equal(JR.unwrapExcelCell(cell), java)
    assert.equal(JR.detectType(cell).type, 'test')
    const A = JR.analyze({ review: {}, snippets: [{ id: 'a', seq: 1, type: 'auto', text: cell }] }, { now: 'x' })
    assert.equal(A.testClasses[0].fqcn, 'a.QTest')
    // An ordinary quoted string is left alone.
    assert.equal(JR.unwrapExcelCell('"a"\n"b"'), '"a"\n"b"')
  })
  test('a large report and test class analyse quickly', () => {
    const classes = []
    for (let i = 0; i < 1500; i++) classes.push(`<class name="big/p${i % 40}/C${i}" sourcefilename="C${i}.java"><method name="m" desc="()V" line="3"><counter type="INSTRUCTION" missed="1" covered="9"/><counter type="LINE" missed="0" covered="2"/><counter type="METHOD" missed="0" covered="1"/></method><counter type="INSTRUCTION" missed="1" covered="9"/><counter type="LINE" missed="0" covered="2"/><counter type="METHOD" missed="0" covered="1"/><counter type="CLASS" missed="0" covered="1"/></class>`)
    const xml = '<?xml version="1.0"?><report name="big"><package name="big/p">' + classes.join('') + '</package></report>'
    const methods = []
    for (let i = 0; i < 400; i++) methods.push(`  @Test void t${i}() { when(repo.find(${i})).thenReturn(x); assertEquals(${i}, svc.calc(${i}, "v${i}")); verify(repo).find(${i}); }`)
    const java = 'package big;\nimport org.junit.jupiter.api.Test;\nclass BigTest {\n  @Mock Repo repo;\n  @InjectMocks Svc svc;\n' + methods.join('\n') + '\n}'
    const t0 = Date.now()
    const A = JR.analyze({ review: {}, snippets: [{ id: 'x', seq: 1, type: 'auto', text: xml }, { id: 'j', seq: 2, type: 'auto', text: java }] }, { now: 'x' })
    const ms = Date.now() - t0
    assert.equal(A.jacoco.classes.size, 1500)
    assert.equal(A.inventory.testMethods, 400)
    assert.ok(ms < 5000, 'took ' + ms + ' ms')
  })
})

/* ------------------------------------------------------------------ */
describe('real-world input variants', () => {
  const groupXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><!DOCTYPE report PUBLIC "-//JACOCO//DTD Report 1.1//EN" "report.dtd"><report name="aggregate"><sessioninfo id="s1" start="1" dump="2"/>
  <group name="claims-service"><package name="sg/gov/claims"><class name="sg/gov/claims/ClaimService" sourcefilename="ClaimService.java"><method name="approve" desc="(J)V" line="10"><counter type="INSTRUCTION" missed="2" covered="8"/><counter type="LINE" missed="1" covered="3"/><counter type="METHOD" missed="0" covered="1"/></method><counter type="INSTRUCTION" missed="2" covered="8"/><counter type="LINE" missed="1" covered="3"/><counter type="METHOD" missed="0" covered="1"/><counter type="CLASS" missed="0" covered="1"/></class>
  <sourcefile name="ClaimService.java"><line nr="10" mi="0" ci="4" mb="0" cb="0"/><line nr="11" mi="2" ci="0" mb="0" cb="0"/><line nr="12" mi="0" ci="4" mb="0" cb="0"/></sourcefile><counter type="INSTRUCTION" missed="2" covered="8"/></package><counter type="INSTRUCTION" missed="2" covered="8"/><counter type="LINE" missed="1" covered="3"/><counter type="METHOD" missed="0" covered="1"/><counter type="CLASS" missed="0" covered="1"/></group>
  <group name="common-lib"><package name="sg/gov/common"><class name="sg/gov/common/Util" sourcefilename="Util.java"><counter type="INSTRUCTION" missed="0" covered="5"/><counter type="LINE" missed="0" covered="2"/><counter type="METHOD" missed="0" covered="1"/><counter type="CLASS" missed="0" covered="1"/></class></package><counter type="INSTRUCTION" missed="0" covered="5"/><counter type="LINE" missed="0" covered="2"/><counter type="METHOD" missed="0" covered="1"/><counter type="CLASS" missed="0" covered="1"/></group>
  <counter type="INSTRUCTION" missed="2" covered="13"/><counter type="LINE" missed="1" covered="5"/><counter type="METHOD" missed="0" covered="2"/><counter type="CLASS" missed="0" covered="2"/></report>`
  const scope = `claims-service/src/main/java/sg/gov/claims/ClaimService.java#approve
  sg.gov.common.Util::format
  docs/readme.md`
  const gradleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <testsuite name="sg.gov.claims.ClaimServiceTest" tests="2" skipped="0" failures="0" errors="0" timestamp="2026-10-27T10:00:00" hostname="h" time="0.1">
    <properties/>
    <testcase name="approves a pending claim" classname="sg.gov.claims.ClaimServiceTest" time="0.01"/>
    <testcase name="rejectsUnknown()" classname="sg.gov.claims.ClaimServiceTest" time="0.01"/>
    <system-out><![CDATA[]]></system-out>
  </testsuite>`
  const claimTest = `package sg.gov.claims;
  import org.junit.jupiter.api.*;
  import static org.junit.jupiter.api.Assertions.*;
  class ClaimServiceTest {
    ClaimService svc = new ClaimService();
    @Test @DisplayName("approves a pending claim") void approvesPending() { svc.approve(1L); assertTrue(svc.isApproved(1L)); }
    @Test void rejectsUnknown() { assertThrows(IllegalArgumentException.class, () -> svc.approve(-1L)); }
  }`
  test('multi-module aggregate report: module coverage comes from the JaCoCo group, members in scope lists are tolerated', () => {
    const A = JR.analyze({ review: { moduleName: 'claims-service' }, snippets: [
      { id: 'a', seq: 1, type: 'auto', text: groupXml }, { id: 'b', seq: 2, type: 'auto', text: scope },
      { id: 'c', seq: 3, type: 'auto', text: gradleXml }, { id: 'd', seq: 4, type: 'auto', text: claimTest }] }, { now: 'x' })
    const S = A.coverage.scope
    assert.deepEqual(S.productionEntries.map((e) => e.fqcn), ['sg.gov.claims.ClaimService', 'sg.gov.common.Util'])
    const mod = S.modules.find((m) => m.name === 'claims-service')
    assert.match(mod.source, /group "claims-service"/)
    assert.equal(mod.metrics.find((m) => m.type === 'LINE').pct, '75.00%')
    assert.equal(mod.metrics.find((m) => m.type === 'BRANCH').pct, 'N/A')
    assert.deepEqual(A.testClasses[0].methods.map((m) => m.execution.status), ['passed', 'passed'])
  })
})

/* ------------------------------------------------------------------ */
describe('declared coverage summaries', () => {
  test('free text and Excel rows are read but never verify anything', () => {
    const s = JR.parseSummary('Line coverage: 98.5%; Branches 45/50\n92% method coverage')
    assert.deepEqual(s.entries.map((e) => e.metric + ' ' + e.pct), ['LINE 98.5%', 'BRANCH 90.00%', 'METHOD 92%'])
    const A = JR.analyze({ review: {}, snippets: [{ id: 'a', seq: 1, type: 'summary', provenance: 'User-entered', text: 'Line coverage: 100%' }] }, { now: 'x' })
    assert.equal(A.declared.entries[0].provenance, 'User-entered')
    assert.equal(A.conclusion.status, JR.STATUS.INSUFFICIENT)
    assert.equal(A.coverage.assessed.pass, null)
  })
})

/* ------------------------------------------------------------------ */
describe('reports', () => {
  test('every finding carries the fields a business analyst needs', () => {
    const { A } = loadScenario('service-heavy')
    const tsv = JR.buildTsvReport(A, 'findings').split('\n')
    assert.deepEqual(tsv[0].split('\t'), ['Finding ID', 'Status', 'Severity', 'Certainty', 'Category', 'Rule', 'Source Class', 'Test Class', 'Test Method', 'Observation', 'Explanation', 'Risk / Impact', 'Recommended Action', 'Evidence Reference'])
    assert.equal(tsv.length, A.findings.length + 1)
    for (const row of tsv) assert.equal(row.split('\t').length, 14)
    for (const f of A.findings) {
      assert.ok(f.observation && f.explanation && f.risk && f.action && f.evidenceText, f.id + ' ' + f.rule)
      assert.ok(['Definite', 'Possible'].includes(f.certainty))
      assert.ok(Object.values(JR.STATUS).includes(f.status))
    }
    const text = JR.buildTextReport(A)
    for (const h of ['1. ENHANCEMENT SUMMARY', '2. JUNIT TEST INVENTORY', '3. TEST QUALITY ANALYSIS', '4. SOURCE-TO-TEST TRACEABILITY', '5. ACTUAL COVERAGE METRICS', '6. UNCOVERED CODE FINDINGS', '7. EVIDENCE COMPLETENESS', '8. FINAL REVIEW CONCLUSION']) {
      assert.ok(text.includes(h), h)
    }
  })
  test('the full Excel export keeps every table rectangular', () => {
    const { A } = loadScenario('multi-class-cr')
    const all = JR.buildTsvReport(A)
    for (const block of all.split('\n\n')) {
      const rows = block.split('\n').slice(1).filter(Boolean)
      if (rows.length < 2) continue
      const width = rows[0].split('\t').length
      for (const r of rows) assert.equal(r.split('\t').length <= width, true)
    }
  })
})
