/* ------------------------------------------------------------------------
 * Orchestration: from the workspace state (review details + pasted
 * snippets) to the complete review result rendered by the UI and reports.
 * --------------------------------------------------------------------- */

function defaultReview() {
  return { crRef: '', appName: '', moduleName: '', scopeDesc: '', threshold: 100, gatedMetrics: METRICS.slice() };
}

function sanitiseReview(r) {
  const out = Object.assign(defaultReview(), r || {});
  let t = Number(out.threshold);
  if (!Number.isFinite(t)) t = 100;
  out.threshold = Math.min(100, Math.max(0, Math.round(t * 10000) / 10000));
  out.gatedMetrics = (Array.isArray(out.gatedMetrics) ? out.gatedMetrics : METRICS).filter((m) => METRICS.includes(m));
  if (!out.gatedMetrics.length) out.gatedMetrics = ['LINE', 'BRANCH'];
  for (const k of ['crRef', 'appName', 'moduleName', 'scopeDesc']) out[k] = String(out[k] || '').trim();
  return out;
}

// A single Excel cell copied to the clipboard arrives wrapped in double quotes,
// with every quote inside doubled. Undo that so the code reads as written.
function unwrapExcelCell(text) {
  const t = text.trim();
  if (t.length < 3 || t[0] !== '"' || t[t.length - 1] !== '"' || t.indexOf('\n') < 0) return text;
  const inner = t.slice(1, -1);
  if (/(^|[^"])"([^"]|$)/.test(inner.replace(/""/g, ''))) return text; // a lone quote: not Excel quoting
  return inner.replace(/""/g, '"');
}

function hasTestMethods(ty) {
  if (ty.methods.some((m) => testAnnotationOf(m))) return true;
  return ty.types.some((n) => hasTestMethods(n));
}

function analyze(state, opts) {
  opts = opts || {};
  const review = sanitiseReview(state && state.review);
  const input = ((state && state.snippets) || []).slice().sort((a, b) => a.seq - b.seq);
  const A = {
    review, generatedAt: opts.now || '', snippets: [], testClasses: [], prodClasses: [], supportClasses: [], duplicateClasses: [],
    jacocoSnippets: [], resultsSnippets: [], scopeSnippets: [], summarySnippets: [], findings: [], declared: { entries: [], conflicts: [] },
  };

  // ---- 1. Read every snippet
  const contentSeen = new Map();
  const javaTypes = []; // { ty, unit, P, parsed, snippet, role, info }
  const jacocoReports = [];
  const resultSets = [];
  const scopeSets = [];
  for (const sn of input) {
    try {
      readSnippet(sn);
    } catch (e) {
      // One unreadable paste must never stop the review of everything else.
      const info = A.snippets.find((x) => x.id === sn.id);
      if (info) { info.unrecognised = 'This text could not be analysed (' + e.message + '). Check the input type, or re-copy it.'; info.error = true; }
    }
  }

  function readSnippet(sn) {
    const text = unwrapExcelCell(normalizeNewlines(sn.text || ''));
    const det = detectType(text);
    const declared = sn.type && INPUT_TYPES[sn.type] ? sn.type : 'auto';
    const info = {
      id: sn.id, seq: sn.seq, label: '', declaredType: declared, detected: det, type: declared === 'auto' ? det.type : declared,
      incomplete: false, incompleteReasons: [], classes: [], counts: { lines: text ? text.split('\n').length : 0, chars: text.length },
      duplicateOf: null, typeWarning: '', unrecognised: '', provenance: sn.provenance || 'Vendor-declared', updatedAt: sn.updatedAt || 0, summary: '',
    };
    A.snippets.push(info);
    if (!text.trim()) { info.unrecognised = 'The snippet is empty.'; info.label = 'Empty snippet'; return; }
    const key = contentKey(text);
    if (contentSeen.has(key)) { info.duplicateOf = contentSeen.get(key); info.label = 'Duplicate of #' + info.duplicateOf; return; }
    contentSeen.set(key, sn.seq);
    if (!info.type) { info.unrecognised = det.reason; info.label = 'Unrecognised text'; return; }
    const javaTypesDeclared = declared === 'test' || declared === 'source';
    if (declared !== 'auto' && det.type && det.type !== declared && !(javaTypesDeclared && (det.type === 'test' || det.type === 'source'))) {
      info.typeWarning = 'Snippet #' + sn.seq + ' was marked as "' + INPUT_TYPES[declared] + '" but looks like ' + det.label + '.';
    }

    if (info.type === 'test' || info.type === 'source') {
      const parsed = parseJava(text);
      for (const iss of parsed.issues) { info.incomplete = true; info.incompleteReasons.push(iss.message + (iss.line ? ' (near line ' + iss.line + ')' : '')); }
      let n = 0;
      for (const unit of parsed.units) {
        const tops = unit.types.slice();
        if (unit.fragment && (unit.fragment.methods.length || unit.fragment.fields.length)) {
          const f = unit.fragment;
          f.name = 'Fragment' + sn.seq + (n ? '_' + n : '');
          f.fragmentLabel = 'Unnamed fragment (snippet #' + sn.seq + ')';
          assignNames(f, unit.pkg, null);
          tops.push(f);
          info.incomplete = true;
          info.incompleteReasons.push('Contains ' + plural(f.methods.length, 'method') + ' without an enclosing class declaration.');
        }
        for (const ty of tops) {
          n++;
          if (ty.kind !== 'fragment' && !ty.complete) { info.incomplete = true; info.incompleteReasons.push('Class ' + ty.name + ' is not closed — the copy appears to be cut off.'); }
          for (const m of ty.methods) if (m.hasBody && !m.complete) { info.incomplete = true; info.incompleteReasons.push('Method ' + m.name + '() is cut off.'); break; }
          const isTest = hasTestMethods(ty);
          let role = isTest ? 'test' : declared === 'test' ? 'test-support' : 'source';
          if (!isTest && declared === 'auto' && (/(Test|Tests|IT|TestCase)$/.test(ty.name) || unit.imports.some((i) => /^org\.(junit|mockito|assertj)\./.test(i.name)))) role = 'test-support';
          if (isTest && declared === 'source') info.typeWarning = 'Snippet #' + sn.seq + ' was marked as production source but ' + ty.name + ' contains test methods; it is analysed as test code.';
          if (!isTest && declared === 'test' && ty.kind !== 'fragment') info.typeWarning = info.typeWarning || ('Snippet #' + sn.seq + ' was marked as test code but ' + ty.name + ' has no @Test methods; it is treated as a test helper.');
          javaTypes.push({ ty, unit, parsed, snippet: sn, role, info });
          info.classes.push({ name: ty.fragmentLabel || ty.fqcn, role, kind: ty.kind });
        }
      }
      if (!info.classes.length) { info.unrecognised = 'No Java type declarations or methods could be read.'; }
      const tcount = info.classes.filter((c) => c.role === 'test').length;
      info.label = info.classes.length ? info.classes.map((c) => simpleNameOf(c.name.replace(/ \(snippet #\d+\)$/, ''))).slice(0, 3).join(', ') + (info.classes.length > 3 ? ' +' + (info.classes.length - 3) : '') : 'Java';
      info.summary = tcount ? plural(tcount, 'test class', 'test classes') : plural(info.classes.length, 'class', 'classes');
    } else if (info.type === 'jacoco') {
      const rep = /^\s*</.test(text) ? parseJacocoXml(text) : parseJacocoCsv(text);
      if (rep.truncated) { info.incomplete = true; info.incompleteReasons.push('The JaCoCo XML is cut off before the end of the report.'); }
      if (!rep.classes.length) info.unrecognised = 'No JaCoCo <class> entries were found.';
      jacocoReports.push({ rep, snippet: sn });
      A.jacocoSnippets.push({ seq: sn.seq, id: sn.id });
      info.label = 'JaCoCo ' + (rep.format === 'csv' ? 'CSV' : 'XML') + (rep.name ? ' · ' + rep.name : '');
      info.summary = plural(rep.classes.filter((c) => !c.innerPart).length, 'class', 'classes');
    } else if (info.type === 'results') {
      const rs = /^\s*</.test(text) ? parseJunitXml(text) : parseResultsText(text);
      if (rs.truncated) { info.incomplete = true; info.incompleteReasons.push('The results XML is cut off.'); }
      if (!rs.cases.length && !rs.suites.length && !rs.overall) info.unrecognised = 'No test cases or summary lines were found.';
      resultSets.push({ rs, snippet: sn });
      A.resultsSnippets.push({ seq: sn.seq, id: sn.id });
      info.label = 'Test results (' + (rs.format === 'xml' ? 'XML' : 'console') + ')';
      info.summary = rs.cases.length ? plural(rs.cases.length, 'test case') : plural(rs.suites.length, 'suite');
    } else if (info.type === 'scope') {
      const sc = parseScope(text);
      if (!sc.entries.length) info.unrecognised = 'No file paths or class names were found.';
      for (const e of sc.entries) { e.snippetSeq = sn.seq; e.snippetId = sn.id; }
      scopeSets.push({ sc, snippet: sn });
      A.scopeSnippets.push({ seq: sn.seq, id: sn.id });
      info.label = 'Change scope (' + (sc.kinds.join(', ') || 'list') + ')';
      info.summary = plural(sc.entries.length, 'entry', 'entries');
    } else if (info.type === 'summary') {
      const sm = parseSummary(text);
      if (!sm.entries.length) info.unrecognised = 'No coverage figures were found.';
      for (const e of sm.entries) A.declared.entries.push(Object.assign({ snippetSeq: sn.seq, snippetId: sn.id, provenance: info.provenance }, e));
      A.summarySnippets.push({ seq: sn.seq, id: sn.id });
      info.label = 'Declared coverage (' + info.provenance + ')';
      info.summary = plural(sm.entries.length, 'figure');
    }
  }

  // ---- 2. De-duplicate classes (latest version wins; nothing is double-counted)
  const rank = (j) => [j.snippet.updatedAt || 0, j.snippet.seq];
  const newer = (a, b) => { const x = rank(a), y = rank(b); return x[0] !== y[0] ? x[0] > y[0] : x[1] > y[1]; };
  const groups = new Map();
  for (const j of javaTypes) {
    const roleKey = j.role === 'source' ? 'S' : 'T';
    const key = roleKey + ':' + (j.ty.pkg ? j.ty.fqcn : '?.' + j.ty.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  }
  // Package-less copies of a packaged class: merge when most method names overlap.
  for (const [key, list] of Array.from(groups.entries())) {
    if (!key.split(':')[1].startsWith('?.')) continue;
    const simple = key.split(':')[1].slice(2);
    const roleKey = key.split(':')[0];
    const cands = Array.from(groups.entries()).filter(([k]) => k.startsWith(roleKey + ':') && !k.split(':')[1].startsWith('?.') && simpleNameOf(k.split(':')[1]) === simple);
    if (cands.length !== 1) continue;
    const names = new Set(list[0].ty.methods.map((m) => m.name));
    const other = new Set(cands[0][1][0].ty.methods.map((m) => m.name));
    const overlap = Array.from(names).filter((x) => other.has(x)).length;
    if (names.size && overlap / Math.min(names.size, other.size || 1) >= 0.5) {
      cands[0][1].push(...list.map((j) => Object.assign(j, { possibleDup: true })));
      groups.delete(key);
    }
  }
  const kept = [];
  for (const [, list] of groups) {
    // A copy without its package line never replaces the packaged original.
    const pool = list.some((j) => j.ty.pkg) ? list.filter((j) => j.ty.pkg) : list;
    let best = pool[0];
    for (const j of pool) if (newer(j, best)) best = j;
    if (list.length > 1) {
      const bodyKey = (j) => contentKey(sliceText({ src: j.parsed.src, T: j.parsed.tokens }, Math.max(0, tokenIndexAtLine(j.parsed.tokens, j.ty.startLine)), j.ty.bodyEnd >= 0 ? j.ty.bodyEnd : j.parsed.tokens.length - 1));
      const bestKey = bodyKey(best);
      const others = list.filter((j) => j !== best && j.snippet.seq !== best.snippet.seq);
      if (others.length) {
        const dropped = others.map((j) => ({
          seq: j.snippet.seq,
          kind: j.possibleDup ? 'no-package' : bodyKey(j) === bestKey ? 'identical' : newer(j, best) ? 'newer-unpackaged' : 'older',
          sameBody: bodyKey(j) === bestKey,
        }));
        A.duplicateClasses.push({
          fqcn: best.ty.fqcn, role: best.role === 'source' ? 'source' : 'test', kept: best.snippet.seq, dropped: uniq(dropped.map((d) => d.seq)), details: dropped,
          identical: dropped.every((d) => d.sameBody), possible: dropped.some((d) => d.kind === 'no-package'),
        });
      }
    }
    kept.push(best);
  }
  kept.sort((a, b) => a.snippet.seq - b.snippet.seq || a.ty.startLine - b.ty.startLine);

  // ---- 3. Production classes (top-level and nested)
  const srcEntries = [];
  for (const j of kept.filter((x) => x.role === 'source')) {
    const walk = (ty) => {
      srcEntries.push({ j, ty });
      for (const n of ty.types) walk(n);
    };
    walk(j.ty);
  }
  for (const { j, ty } of srcEntries) {
    const P = { src: j.parsed.src, T: j.parsed.tokens, M: j.parsed.M, lines: j.parsed.lines };
    let pc;
    try { pc = analyzeSourceClass({ P, snippet: j.snippet, unit: j.unit, incomplete: j.info.incomplete }, ty); } catch (e) {
      j.info.incomplete = true;
      j.info.incompleteReasons.push('Class ' + ty.name + ' could not be fully analysed (' + e.message + ').');
      continue;
    }
    pc.lines = j.parsed.lines;
    pc.unit = j.unit;
    pc.label = ty.fragmentLabel || pc.fqcn;
    A.prodClasses.push(pc);
  }
  const prodIndex = buildProductionIndex(A.prodClasses);
  A.prodIndex = prodIndex;

  // ---- 4. Test classes
  const supportTypes = new Map();
  for (const j of kept.filter((x) => x.role === 'test-support')) { supportTypes.set(j.ty.name, j.ty); A.supportClasses.push({ fqcn: j.ty.fqcn, snippetSeq: j.snippet.seq }); }
  for (const j of kept.filter((x) => x.role === 'test')) {
    const P = { src: j.parsed.src, T: j.parsed.tokens, M: j.parsed.M, lines: j.parsed.lines };
    let tc;
    try { tc = analyzeTestClass({ P, snippet: j.snippet, unit: j.unit, prod: prodIndex, supportTypes, comments: j.parsed.comments, incomplete: j.info.incomplete }, j.ty); } catch (e) {
      j.info.incomplete = true;
      j.info.incompleteReasons.push('Test class ' + j.ty.name + ' could not be fully analysed (' + e.message + ').');
      continue;
    }
    tc.label = j.ty.fragmentLabel || tc.fqcn;
    tc.lines = j.parsed.lines;
    // Resolve targets to production classes
    const resolved = [];
    for (const t of tc.targets) {
      const pc = prodIndex.resolve(t.name, j.unit);
      if (pc && !resolved.includes(pc.fqcn)) resolved.push(pc.fqcn);
    }
    if (!resolved.length) {
      const counts = new Map();
      for (const m of tc.methods) for (const r of m.refs) if (!r.viaMock) counts.set(r.cls, (counts.get(r.cls) || 0) + 1);
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top) resolved.push(top[0]);
    }
    tc.targetFqcns = resolved;
    // Production constructors called in @BeforeEach-style setup
    tc.setupCtorRefs = [];
    for (const lc of tc.lifecycle) {
      if (!lc.m.hasBody) continue;
      const b = scanBody(P, lc.m.bodyStart, lc.m.bodyEnd);
      for (const nw of b.news) { const pc = prodIndex.resolve(nw.type, j.unit); if (pc) tc.setupCtorRefs.push(pc.fqcn); }
    }
    A.testClasses.push(tc);
  }

  // ---- 5. Measured coverage
  const J = mergeJacoco(jacocoReports);
  const lookup = makeJacocoLookup(J, prodIndex);
  A.jacoco = J;
  A.jacocoLookup = lookup;
  A.jacocoSays = (pc, state) => {
    const fam = lookup.familyFor(pc.binaryName.split('$')[0]);
    if (!fam.length) return false;
    const c = {};
    for (const f of fam) addCounters(c, f.counters);
    return state === 'covered' && METRICS.every((t) => counterOf(c, t).missed === 0);
  };

  // Scope entries (merged across scope snippets)
  const scopeEntries = [];
  const scopeKeys = new Set();
  const scopeWarnings = [];
  for (const { sc } of scopeSets) {
    for (const e of sc.entries) {
      const k = e.path ? 'p:' + e.path : 'c:' + (e.fqcn || e.simpleName);
      if (scopeKeys.has(k)) {
        const prev = scopeEntries.find((x) => (x.path ? 'p:' + x.path : 'c:' + (x.fqcn || x.simpleName)) === k);
        if (prev && e.addedLines.length) prev.addedLines = uniq(prev.addedLines.concat(e.addedLines)).sort((a, b) => a - b);
        continue;
      }
      scopeKeys.add(k);
      scopeEntries.push(e);
    }
    scopeWarnings.push(...sc.warnings);
  }
  const scope = scopeEntries.length ? assessScope(J, lookup, scopeEntries, prodIndex, review, A.testClasses) : null;
  if (scope) scope.warnings = uniq(scopeWarnings);
  A.uncovered = J.present ? collectUncovered(J, lookup, A.prodClasses, scope) : [];

  let assessed;
  if (J.present && scope && scope.affected && scope.affected.measuredClasses) {
    assessed = {
      basis: 'scope', label: plural(scope.affected.measuredClasses, 'in-scope class', 'in-scope classes'),
      description: 'the ' + plural(scope.affected.measuredClasses, 'in-scope class', 'in-scope classes') + ' found in the report' + (scope.missingFromJacoco.length ? ' (' + scope.missingFromJacoco.length + ' further in-scope class(es) have no JaCoCo data)' : ''),
      counters: scope.affected.counters, metrics: scope.affected.metrics,
    };
  } else if (J.present) {
    const n = Array.from(J.classes.values()).filter((c) => !c.innerPart).length;
    assessed = {
      basis: 'report', label: 'Supplied JaCoCo report', description: 'all ' + plural(n, 'class', 'classes') + ' in the supplied JaCoCo report' + (scope ? '' : ' (no enhancement scope supplied, so this is not shown to be the changed code)'),
      counters: J.totals, metrics: METRICS.map((t) => metricRow(J.totals, t, review.threshold)),
    };
  } else {
    assessed = { basis: 'none', label: 'No measured coverage', description: '', counters: {}, metrics: METRICS.map((t) => metricRow({}, t, review.threshold)) };
  }
  assessed.pass = J.present ? review.gatedMetrics.every((t) => { const m = assessed.metrics.find((x) => x.type === t); return m.na || m.meets; }) : null;
  assessed.reportMetrics = J.present ? METRICS.concat(['COMPLEXITY']).map((t) => metricRow(J.totals, t, review.threshold)) : [];
  A.coverage = { assessed, scope, notVerifiedText: 'Actual Code Coverage: NOT VERIFIED — JaCoCo execution evidence required.' };

  // Declared summaries vs measured
  for (const d of A.declared.entries) {
    if (!J.present) continue;
    const metric = d.metric === 'OVERALL' ? 'LINE' : d.metric;
    if (!METRICS.includes(metric)) continue;
    let measuredCounters = null;
    if (/^(overall|total|all|project|summary)$/i.test(d.scope) || d.scope === 'Overall') measuredCounters = assessed.counters;
    else {
      const list = J.bySimple.get(simpleNameOf(d.scope)) || [];
      if (list.length === 1) { measuredCounters = {}; for (const f of lookup.familyFor(list[0].outerBinary)) addCounters(measuredCounters, f.counters); }
    }
    if (!measuredCounters) continue;
    const m = metricRow(measuredCounters, metric, review.threshold);
    if (m.na) continue;
    const declaredValue = d.total != null ? d.covered / d.total * 100 : Number(d.percent);
    const measuredValue = m.covered / m.total * 100;
    const conflict = (d.claims100 && m.missed > 0) || Math.abs(declaredValue - measuredValue) > 0.5;
    d.measured = m.pct;
    d.conflict = conflict;
    if (conflict) A.declared.conflicts.push({ metric, declared: d.pct, measured: m.pct + ' (' + fmtInt(m.covered) + '/' + fmtInt(m.total) + ')', provenance: d.provenance, snippetSeq: d.snippetSeq, snippetId: d.snippetId, line: d.line });
  }

  // ---- 6. Execution results
  A.execution = matchExecution(resultSets, A.testClasses);

  // ---- 7. Traceability
  if (A.prodClasses.length && A.testClasses.length) {
    A.trace = buildTraceability(A.prodClasses, prodIndex, A.testClasses, J.present ? lookup : null);
    computeTraceGaps(A.trace, prodIndex);
    annotateTraceScope(A.trace, scope);
  } else A.trace = null;

  // ---- 8. Findings
  const findings = [].concat(
    testQualityFindings(A), scenarioFindings(A), traceFindings(A), coverageFindings(A), executionFindings(A), scopeAndEvidenceFindings(A),
  );
  for (const f of findings) {
    f.evidence = f.evidence.filter(Boolean);
    for (const e of f.evidence) {
      const s = A.snippets.find((x) => x.seq === e.snippetSeq);
      if (s && !e.snippetId) e.snippetId = s.id;
      e.label = s ? 'Snippet #' + s.seq + ' (' + s.label + ')' + (e.line ? ', line ' + e.line : '') : '';
    }
    f.evidenceText = f.evidence.map((e) => e.label).filter(Boolean).join('; ') || (f.rule === 'SCOPE_MISSING' ? 'No scope snippet' : 'Workspace');
  }
  A.findings = rankFindings(findings);

  // ---- 9. Inventory, sections and conclusion
  A.inventory = inventoryStats(A);
  A.evidenceItems = evidenceCompleteness(A);
  A.sections = buildSections(A);
  A.conclusion = buildConclusion(A);
  A.sections.find((s) => s.key === 'summary').status = A.conclusion.status;
  A.sections.find((s) => s.key === 'conclusion').status = A.conclusion.status;
  return A;
}

// Mark which classes are inside the declared scope and which methods contain
// changed lines, so gaps outside the change can be weighted down.
function annotateTraceScope(trace, scope) {
  for (const cr of trace.classRows) {
    const top = cr.cls.binaryName.split('$')[0].replace(/\//g, '.');
    let entry = null;
    if (scope) {
      entry = scope.productionEntries.find((e) => (e.fqcn && (e.fqcn === cr.cls.fqcn || e.fqcn === top)) || (!e.fqcn && (e.simpleName === cr.cls.simpleName || e.simpleName === simpleNameOf(top)))) || null;
    }
    cr.inScope = scope ? !!entry : null;
    const lines = entry && entry.fromDiff ? entry.addedLines : null;
    for (const r of cr.methods) {
      r.inScope = cr.inScope;
      r.changed = lines ? lines.some((l) => l >= r.line && l <= r.endLine) : null;
      r.changedLines = lines ? lines.filter((l) => l >= r.line && l <= r.endLine) : [];
    }
  }
}

function tokenIndexAtLine(T, line) {
  for (let i = 0; i < T.length; i++) if (T[i].line >= line) return i;
  return 0;
}

function matchExecution(resultSets, testClasses) {
  const R = { present: resultSets.length > 0, cases: [], suites: [], overall: null, notExecuted: [], suiteFailures: [], countMismatch: [], unmatchedCases: [], totals: { tests: 0, passed: 0, failed: 0, errors: 0, skipped: 0 } };
  if (!R.present) return R;
  for (const { rs, snippet } of resultSets) {
    for (const c of rs.cases) R.cases.push(Object.assign({ snippetSeq: snippet.seq, snippetId: snippet.id }, c));
    for (const s of rs.suites) R.suites.push(Object.assign({ snippetSeq: snippet.seq, snippetId: snippet.id, format: rs.format }, s));
    if (rs.overall) R.overall = Object.assign({ snippetSeq: snippet.seq, snippetId: snippet.id }, rs.overall);
  }
  // Console output can mention the same failure twice (detail line + summary block); keep one per test.
  const seenCase = new Set();
  R.cases = R.cases.filter((c) => {
    const k = simpleNameOf(c.classname) + '#' + (c.normName || c.name) + '#' + c.status + '#' + c.snippetSeq;
    if (seenCase.has(k)) return false;
    seenCase.add(k);
    return true;
  });
  const classMatches = (cname, tc) => cname === tc.fqcn || cname === tc.binaryName.replace(/\//g, '.') || cname.startsWith(tc.fqcn + '$') || cname.startsWith(tc.fqcn + '.') ||
    simpleNameOf(cname.split('$')[0]) === tc.simpleName;
  const matchedCases = new Set();
  for (const tc of testClasses) {
    const cases = R.cases.filter((c) => classMatches(c.classname, tc));
    const suites = R.suites.filter((s) => classMatches(s.name, tc));
    const enabled = tc.methods.filter((m) => !m.disabled);
    for (const tm of tc.methods) {
      const mine = cases.filter((c) => c.normName === tm.methodName || c.name === tm.methodName || (tm.displayName && (c.name === tm.displayName || c.name.startsWith(tm.displayName))));
      mine.forEach((c) => matchedCases.add(c));
      let status = 'not-found';
      if (mine.some((c) => c.status === 'failed')) status = 'failed';
      else if (mine.some((c) => c.status === 'error')) status = 'error';
      else if (mine.length && mine.every((c) => c.status === 'skipped')) status = 'skipped';
      else if (mine.some((c) => c.status === 'passed')) status = 'passed';
      else if (suites.length && !cases.some((c) => c.status === 'passed') && !tm.disabled) status = suites.some((s) => s.tests > 0) ? 'inferred' : 'not-found';
      tm.execution = { status, runs: mine.length };
      if (status === 'not-found' && !tm.disabled && (cases.length || suites.length)) {
        // Parameterized invocations reported only as "[1] …" cannot be attributed to a method name.
        const unattributed = cases.filter((c) => !c.normName);
        if (!(tm.parameterized && unattributed.length)) R.notExecuted.push({ tc, tm });
        else tm.execution = { status: 'unattributed', runs: unattributed.length };
      }
    }
    if (!cases.length && !suites.length && enabled.length) R.notExecuted.push({ tc, tm: null });
    for (const s of suites) {
      const failingCases = cases.filter((c) => c.status === 'failed' || c.status === 'error').length;
      if (s.failures + s.errors > failingCases) R.suiteFailures.push(s);
      if (s.format === 'text' && s.tests < enabled.length) R.countMismatch.push({ name: s.name, ran: s.tests, declared: enabled.length, snippetSeq: s.snippetSeq, snippetId: s.snippetId, line: s.line });
    }
  }
  R.unmatchedCases = R.cases.filter((c) => !matchedCases.has(c));
  // Totals per pasted result set: XML lists every case; console output is
  // summarised by its own "Tests run" / "tests completed" lines when present.
  const t = R.totals;
  for (const { rs } of resultSets) {
    const summary = rs.format === 'text' ? (rs.overall ? [rs.overall] : rs.suites) : [];
    if (summary.length) {
      for (const s of summary) { t.tests += s.tests; t.failed += s.failures; t.errors += s.errors; t.skipped += s.skipped; }
    } else {
      for (const c of rs.cases) { t.tests++; if (c.status === 'failed') t.failed++; else if (c.status === 'error') t.errors++; else if (c.status === 'skipped') t.skipped++; }
    }
  }
  t.passed = Math.max(0, t.tests - t.failed - t.errors - t.skipped);
  return R;
}

function inventoryStats(A) {
  const tcs = A.testClasses;
  const methods = tcs.flatMap((t) => t.methods);
  const enabled = methods.filter((m) => !m.disabled);
  const count = (fn) => enabled.filter(fn).length;
  return {
    testClasses: tcs.length,
    testMethods: methods.length,
    enabledMethods: enabled.length,
    disabled: methods.length - enabled.length,
    parameterized: count((m) => m.parameterized),
    assertions: enabled.reduce((n, m) => n + m.assertions.length, 0),
    checks: enabled.reduce((n, m) => n + (m.checkCount || 0), 0),
    verifies: enabled.reduce((n, m) => n + m.verifies.length, 0),
    stubs: enabled.reduce((n, m) => n + m.stubs.length, 0) + tcs.reduce((n, t) => n + t.stubsInSetup.length, 0),
    requests: enabled.reduce((n, m) => n + m.requests.length, 0),
    scenarios: {
      positive: count((m) => m.scenario.positive === 'code'),
      negative: count((m) => m.scenario.negative === 'code'),
      exception: count((m) => m.scenario.exception === 'code'),
      boundary: count((m) => m.scenario.boundary === 'code'),
      nullEmpty: count((m) => m.scenario.nullEmpty === 'code'),
      security: count((m) => m.scenario.security === 'code'),
    },
    frameworks: uniq(tcs.map((t) => t.framework)),
    prodClasses: A.prodClasses.filter((p) => !p.outer).length,
    prodMethods: A.prodClasses.reduce((n, p) => n + p.methods.length, 0),
    snippets: A.snippets.length,
  };
}

function evidenceCompleteness(A) {
  const items = [];
  const add = (key, label, status, detail, required) => items.push({ key, label, status, detail, required: !!required });
  const R = A.review;
  add('details', 'Enhancement details', R.crRef && R.appName ? STATUS.PASS : STATUS.REVIEW,
    R.crRef && R.appName ? 'CR ' + R.crRef + ' · ' + R.appName + (R.moduleName ? ' · ' + R.moduleName : '') : 'Enter the CR reference and application name.', false);
  const inv = A.inventory;
  add('tests', 'JUnit test code', inv.testClasses ? STATUS.PASS : STATUS.INSUFFICIENT,
    inv.testClasses ? plural(inv.testClasses, 'test class', 'test classes') + ', ' + plural(inv.testMethods, 'test method') : 'No test classes collected.', true);
  const scope = A.coverage.scope;
  const inScopeSrc = scope ? scope.classes.filter((r) => r.source).length : 0;
  add('source', 'Production source code', A.prodClasses.length ? (scope && scope.classes.length && inScopeSrc < scope.classes.length ? STATUS.REVIEW : STATUS.PASS) : STATUS.REVIEW,
    A.prodClasses.length ? plural(inv.prodClasses, 'class', 'classes') + (scope && scope.classes.length ? '; source for ' + inScopeSrc + ' of ' + scope.classes.length + ' in-scope classes' : '') : 'Not supplied — source-to-test traceability is not possible.', false);
  const J = A.jacoco;
  add('jacoco', 'JaCoCo coverage report', !J.present ? STATUS.INSUFFICIENT : (J.warnings.length || !J.hasLineData) ? STATUS.REVIEW : STATUS.PASS,
    !J.present ? 'Not supplied — actual coverage is NOT VERIFIED.' : plural(J.classes.size, 'class entry', 'class entries') + ' from ' + plural(J.count, 'report') + (J.hasLineData ? ', with line-level data' : ', without line-level data') + (J.warnings.length ? '; ' + plural(J.warnings.length, 'integrity warning') : ''), true);
  add('scope', 'Enhancement change scope', !scope ? STATUS.INSUFFICIENT : STATUS.PASS,
    !scope ? 'Not supplied — measured coverage cannot be tied to the changed code.' : plural(scope.productionEntries.length, 'production file/class', 'production files/classes') + (scope.changed ? ', with changed line numbers (git diff)' : ', without line numbers') + (scope.otherEntries.length ? '; ' + scope.otherEntries.length + ' other' : ''), true);
  if (scope && J.present) {
    add('scopeCoverage', 'JaCoCo covers declared scope', scope.missingFromJacoco.length ? STATUS.INSUFFICIENT : STATUS.PASS,
      scope.missingFromJacoco.length ? plural(scope.missingFromJacoco.length, 'in-scope class has', 'in-scope classes have') + ' no JaCoCo data: ' + scope.missingFromJacoco.map((r) => simpleNameOf(r.name)).slice(0, 5).join(', ') : 'Every in-scope production class appears in the report.', true);
  }
  const E = A.execution;
  add('results', 'JUnit execution results', !E.present ? STATUS.REVIEW : (E.totals.failed + E.totals.errors) ? STATUS.FAIL : E.notExecuted.length || E.totals.skipped ? STATUS.REVIEW : STATUS.PASS,
    !E.present ? 'Not supplied — passing test runs are not evidenced.' : E.totals.tests + ' executions: ' + E.totals.passed + ' passed, ' + E.totals.failed + ' failed, ' + E.totals.errors + ' errors, ' + E.totals.skipped + ' skipped' + (E.notExecuted.length ? '; ' + plural(E.notExecuted.length, 'test') + ' with no execution record' : ''), false);
  add('declared', 'Declared coverage summaries', A.declared.entries.length ? (A.declared.conflicts.length ? STATUS.REVIEW : STATUS.NA) : STATUS.NA,
    A.declared.entries.length ? plural(A.declared.entries.length, 'declared figure') + ' — user-entered / vendor-declared, not independently verified' + (A.declared.conflicts.length ? '; ' + plural(A.declared.conflicts.length, 'conflict') + ' with JaCoCo' : '') : 'None supplied (not required).', false);
  const partial = A.snippets.filter((s) => s.incomplete).length;
  const conflicts = A.duplicateClasses.filter((d) => !d.identical).length;
  const unrec = A.snippets.filter((s) => s.unrecognised).length;
  add('integrity', 'Snippet integrity', partial || conflicts || unrec ? STATUS.REVIEW : A.snippets.length ? STATUS.PASS : STATUS.NA,
    [partial ? plural(partial, 'snippet') + ' possibly incomplete' : '', conflicts ? plural(conflicts, 'class', 'classes') + ' pasted in conflicting versions' : '', unrec ? plural(unrec, 'snippet') + ' not recognised' : ''].filter(Boolean).join('; ') || (A.snippets.length ? 'All snippets read completely.' : 'No snippets yet.'), false);
  return items;
}

function sectionStatusFromFindings(list, blockSeverity) {
  if (list.some((f) => f.status === STATUS.FAIL)) return STATUS.FAIL;
  if (list.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[blockSeverity] && f.status !== STATUS.NA)) return STATUS.REVIEW;
  return STATUS.PASS;
}

function buildSections(A) {
  const F = A.findings;
  const quality = F.filter((f) => f.category === 'Test Quality');
  const trace = F.filter((f) => f.category === 'Traceability');
  const cov = F.filter((f) => f.category === 'Coverage');
  const s = [];
  s.push({ key: 'summary', title: 'Enhancement Summary', status: STATUS.NA });

  let inv = STATUS.PASS;
  if (!A.testClasses.length) inv = STATUS.INSUFFICIENT;
  else if (A.snippets.some((x) => x.incomplete) || A.inventory.disabled || F.some((f) => f.rule === 'NOT_RUNNABLE' || f.rule === 'CONFLICTING_CLASS_VERSIONS')) inv = STATUS.REVIEW;
  s.push({ key: 'inventory', title: 'JUnit Test Inventory', status: inv });

  s.push({ key: 'quality', title: 'Test Quality Analysis', status: !A.testClasses.length ? STATUS.INSUFFICIENT : sectionStatusFromFindings(quality, 'Medium'), staticOnly: true });
  s.push({ key: 'trace', title: 'Source-to-Test Traceability', status: !A.trace ? STATUS.INSUFFICIENT : sectionStatusFromFindings(trace, 'Medium'), staticOnly: true });

  let covStatus;
  if (!A.jacoco.present) covStatus = STATUS.INSUFFICIENT;
  else if (A.coverage.assessed.pass === false || cov.some((f) => f.rule === 'CHANGED_CODE_UNCOVERED')) covStatus = STATUS.FAIL;
  else if (A.coverage.scope && A.coverage.scope.missingFromJacoco.length) covStatus = STATUS.INSUFFICIENT;
  else if (A.jacoco.warnings.length || A.jacoco.conflicts.length || A.declared.conflicts.length) covStatus = STATUS.REVIEW;
  else covStatus = STATUS.PASS;
  s.push({ key: 'coverage', title: 'Actual Coverage Metrics', status: covStatus });

  let unc;
  const inScopeUncovered = A.uncovered.filter((g) => g.inScope || !(A.coverage.scope && A.coverage.scope.classes.length));
  if (!A.jacoco.present) unc = STATUS.INSUFFICIENT;
  else if (!inScopeUncovered.length) unc = STATUS.PASS;
  else unc = A.coverage.assessed.pass === false ? STATUS.FAIL : STATUS.REVIEW;
  s.push({ key: 'uncovered', title: 'Uncovered Code Findings', status: unc });

  const req = A.evidenceItems.filter((i) => i.required);
  const opt = A.evidenceItems.filter((i) => !i.required);
  let evs = worstStatus(req.map((i) => i.status));
  if (evs === STATUS.PASS || evs === STATUS.NA) evs = opt.some((i) => i.status === STATUS.REVIEW || i.status === STATUS.FAIL) ? STATUS.REVIEW : STATUS.PASS;
  s.push({ key: 'evidence', title: 'Evidence Completeness', status: evs });
  s.push({ key: 'conclusion', title: 'Final Review Conclusion', status: STATUS.NA });
  return s;
}

function buildConclusion(A) {
  const R = A.review;
  const F = A.findings;
  const J = A.jacoco;
  const scope = A.coverage.scope;
  const assessed = A.coverage.assessed;
  const comps = [];
  const add = (name, status, text) => comps.push({ name, status, text });

  // Measured coverage
  if (!J.present) add('Measured coverage', STATUS.INSUFFICIENT, A.coverage.notVerifiedText);
  else {
    const gm = assessed.metrics.filter((m) => R.gatedMetrics.includes(m.type));
    const txt = gm.map((m) => m.label + ' ' + (m.na ? 'N/A' : m.pct)).join(', ');
    const missing = scope && scope.missingFromJacoco.length;
    add('Measured coverage', assessed.pass === false ? STATUS.FAIL : missing ? STATUS.INSUFFICIENT : STATUS.PASS,
      'JaCoCo, ' + assessed.description + ': ' + txt + ' — ' + (assessed.pass ? 'meets' : 'does not meet') + ' the ' + R.threshold + '% threshold' + (missing ? '; ' + plural(scope.missingFromJacoco.length, 'in-scope class') + ' not measured' : '') + '.');
  }
  // Changed code
  if (!scope) add('Enhancement scope', STATUS.INSUFFICIENT, 'No change scope supplied; coverage cannot be tied to the enhancement.');
  else if (scope.changed && scope.changed.assessable) {
    const ch = scope.changed;
    const lm = ch.metrics[0];
    const bm = ch.metrics[1];
    add('Changed-code coverage', ch.pass ? STATUS.PASS : STATUS.FAIL, plural(ch.lines.total, 'changed executable line') + ': ' + lm.pct + ' covered' + (ch.lines.partial ? ' (' + ch.lines.partial + ' partly)' : '') + '; branches on changed lines ' + (bm.na ? 'N/A' : bm.pct) + '.');
  } else if (scope.changed && !scope.changed.assessable) add('Changed-code coverage', STATUS.INSUFFICIENT, 'The diff was supplied but JaCoCo line data for the changed files is not available.');
  else add('Enhancement scope', J.present ? (scope.missingFromJacoco.length ? STATUS.INSUFFICIENT : STATUS.PASS) : STATUS.INSUFFICIENT, plural(scope.productionEntries.length, 'in-scope production class', 'in-scope production classes') + ' declared (class level; no diff line numbers, so changed-line coverage is not assessed).');

  // Execution
  const E = A.execution;
  if (!E.present) add('Test execution', STATUS.REVIEW, 'No JUnit execution results supplied — passing runs are not evidenced.');
  else {
    const t = E.totals;
    const st = t.failed + t.errors || E.suiteFailures.length ? STATUS.FAIL : (t.skipped || E.notExecuted.length) ? STATUS.REVIEW : STATUS.PASS;
    add('Test execution', st, t.tests + ' executions: ' + t.passed + ' passed, ' + t.failed + ' failed, ' + t.errors + ' errors, ' + t.skipped + ' skipped' + (E.notExecuted.length ? '; ' + plural(E.notExecuted.length, 'pasted test') + ' without an execution record' : '') + '.');
  }
  // Static quality / traceability
  const blocks = (f) => f.status !== STATUS.NA && (f.severity === 'High' || (f.severity === 'Medium' && f.certainty === 'Definite'));
  const q = F.filter((f) => f.category === 'Test Quality');
  const qBlock = q.filter(blocks);
  if (!A.testClasses.length) add('Test quality (static)', STATUS.INSUFFICIENT, 'No test code supplied.');
  else add('Test quality (static)', qBlock.length ? STATUS.REVIEW : STATUS.PASS, qBlock.length ? plural(qBlock.length, 'blocking observation') + ' (' + summariseRules(qBlock) + ').' : 'No high-severity or definite medium observations from the static rules.');
  const tr = F.filter((f) => f.category === 'Traceability');
  const tBlock = tr.filter(blocks);
  if (!A.trace) add('Traceability (static)', STATUS.NA, A.prodClasses.length ? 'No test code to map.' : 'Production source not supplied; static mapping not performed.');
  else add('Traceability (static)', tBlock.length ? STATUS.REVIEW : STATUS.PASS, tBlock.length ? plural(tBlock.length, 'high-severity gap') + ' (' + summariseRules(tBlock) + ').' : 'No high-severity static gaps' + (tr.length ? ' (' + plural(tr.length, 'lower-severity observation') + ' listed).' : '.'));
  // Evidence integrity
  const integ = F.filter((f) => (f.category === 'Evidence' || f.rule === 'DECLARED_CONFLICT') && f.status === STATUS.REVIEW && SEVERITY_RANK[f.severity] >= 2);
  add('Evidence integrity', integ.length ? STATUS.REVIEW : STATUS.PASS, integ.length ? plural(integ.length, 'issue') + ' (' + summariseRules(integ) + ').' : 'No conflicting, partial or inconsistent evidence detected.');
  if (!A.testClasses.length && !comps.some((c) => c.name === 'Test code')) add('Test code', STATUS.INSUFFICIENT, 'No JUnit test classes collected.');

  const status = worstStatus(comps.map((c) => c.status));
  const headline = {
    [STATUS.PASS]: 'All assessed evidence meets the review criteria.',
    [STATUS.FAIL]: 'Verified evidence shows the review criteria are not met.',
    [STATUS.INSUFFICIENT]: 'The evidence supplied is not sufficient to verify the enhancement.',
    [STATUS.REVIEW]: 'Verified figures are acceptable, but observations need a reviewer’s judgement.',
    [STATUS.NA]: 'Nothing to assess yet.',
  }[status];

  // One action per distinct recommendation, citing the findings it resolves.
  const actions = [];
  const byAction = new Map();
  for (const f of F) {
    if (f.status === STATUS.NA || f.severity === 'Info' || f.severity === 'Low') continue;
    const key = f.action;
    if (!byAction.has(key)) {
      if (actions.length >= 12) continue;
      const a = { rule: f.rule, status: f.status, severity: f.severity, action: f.action, ids: [] };
      byAction.set(key, a);
      actions.push(a);
    }
    byAction.get(key).ids.push(f.id);
  }
  for (const a of actions) a.text = a.action + ' (' + (a.ids.length > 3 ? a.ids.slice(0, 3).join(', ') + ' and ' + (a.ids.length - 3) + ' more' : a.ids.join(', ')) + ')';
  const limitations = [
    'Test-quality and traceability results are static analysis of pasted text; they indicate where to look, not measured behaviour.',
    'Source-to-test mapping is apparent only and is never presented as execution coverage.',
    'Completeness of business requirements cannot be confirmed from code; no requirement is reported as missing because of a test name alone.',
    'Declared (user-entered or vendor-declared) coverage figures are shown for reference and are not used to pass the review.',
  ];
  if (!J.present) limitations.unshift(A.coverage.notVerifiedText);
  if (J.present && assessed.basis === 'report') limitations.push('Coverage applies to the classes in the supplied JaCoCo report only; whole-project coverage is not inferred.');
  return { status, headline, components: comps, actions, limitations };
}

function summariseRules(list) {
  const counts = new Map();
  for (const f of list) counts.set(f.rule, (counts.get(f.rule) || 0) + 1);
  return Array.from(counts.entries()).map(([r, n]) => RULE_TITLES[r] ? RULE_TITLES[r] + (n > 1 ? ' ×' + n : '') : r).slice(0, 5).join(', ');
}

const RULE_TITLES = {
  DISABLED: 'Disabled test', NOT_RUNNABLE: 'Test cannot run', EMPTY_TEST: 'Empty test', NO_ASSERTION: 'No assertions',
  INCOMPLETE_ASSERTION: 'Incomplete assertion', TAUTOLOGY: 'Assertion cannot fail', WEAK_ASSERTION: 'Weak assertion',
  STATUS_ONLY: 'HTTP status only', RESPONSE_NOT_VALIDATED: 'Response not validated', SWALLOWED_EXCEPTION: 'Swallowed exception',
  BROAD_EXCEPTION: 'Over-broad exception', SLEEP: 'Thread.sleep', MIXED_JUNIT: 'Mixed JUnit 4/5', COMMENTED_TEST: 'Commented-out test',
  UNUSED_MOCK: 'Unused mock', DUPLICATE_TEST: 'Duplicate test', SIMILAR_TESTS: 'Parameterization candidate',
  NO_ERROR_SCENARIO: 'No error-path test', NO_BOUNDARY_INPUT: 'No boundary input', NO_NULL_EMPTY_INPUT: 'No null/empty input',
  NO_ACCESS_DENIED_TEST: 'No access-denied test', MOCKED_ONLY: 'Mocked only', NO_APPARENT_TEST: 'No apparent test',
  NAME_MATCH_ONLY: 'Name match only', UNVALIDATED_TESTS: 'Related tests unvalidated', EXCEPTION_PATH_GAP: 'Exception path untested',
  NULL_PATH_GAP: 'Null path untested', BOUNDARY_GAP: 'Boundary untested', BRANCH_GAP: 'Possible branch gap', SECURITY_GAP: 'Security untested',
  UNVERIFIED_INTERACTION: 'Unverified interaction', COVERAGE_BELOW_THRESHOLD: 'Below threshold', CHANGED_CODE_UNCOVERED: 'Changed code uncovered',
  UNCOVERED_CODE: 'Uncovered code', CLASS_NOT_EXECUTED: 'Class never executed', SCOPE_CLASS_NOT_IN_JACOCO: 'In-scope class not measured',
  SOURCE_NOT_IN_JACOCO: 'Source class not measured', LINE_MISMATCH: 'Line numbers differ', JACOCO_INTEGRITY: 'JaCoCo integrity',
  JACOCO_CONFLICT: 'Conflicting JaCoCo data', TEST_FAILED: 'Failed test', TEST_SKIPPED: 'Skipped test', SUITE_FAILED: 'Failures in run',
  NO_EXECUTION_RECORD: 'No execution record', RESULT_COUNT_MISMATCH: 'Execution count mismatch', SCOPE_MISSING: 'Scope missing',
  SCOPE_SOURCE_MISSING: 'Scope source missing', SCOPE_NO_TESTS: 'In-scope class without tests', SCOPE_NOTE: 'Scope note',
  SCOPE_AMBIGUOUS: 'Ambiguous scope entry', PARTIAL_SNIPPET: 'Incomplete snippet', DUPLICATE_SNIPPET: 'Duplicate snippet',
  TYPE_MISMATCH: 'Input type mismatch', UNRECOGNISED_INPUT: 'Unrecognised input', DUPLICATE_CLASS: 'Duplicate class',
  CONFLICTING_CLASS_VERSIONS: 'Conflicting class versions', DECLARED_CONFLICT: 'Declared vs measured conflict',
};
