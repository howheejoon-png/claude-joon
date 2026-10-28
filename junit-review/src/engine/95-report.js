/* ------------------------------------------------------------------------
 * Reports: a formatted plain-text report for reading/pasting into email or
 * a document, and tab-separated tables that paste straight into Excel.
 * --------------------------------------------------------------------- */

const SCENARIO_LABEL = { positive: 'Positive', negative: 'Negative', exception: 'Exception', boundary: 'Boundary', nullEmpty: 'Null/Empty', security: 'Security' };

function wrapText(text, width, indent) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > width) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => (i ? indent : '') + l).join('\n');
}

function field(label, value, width) {
  const pad = 20;
  const head = (label + ' ').padEnd(pad, '.') + ' ';
  return head + wrapText(value || '—', (width || 100) - pad - 1, ' '.repeat(pad + 1));
}

function heading(n, title) {
  const t = (n ? n + '. ' : '') + title.toUpperCase();
  return '\n' + t + '\n' + '-'.repeat(t.length);
}

function scenarioTags(tm) {
  const out = [];
  for (const k of Object.keys(SCENARIO_LABEL)) {
    if (tm.scenario[k] === 'code') out.push(SCENARIO_LABEL[k]);
    else if (tm.scenario[k] === 'name') out.push(SCENARIO_LABEL[k] + ' (name only)');
  }
  return out;
}

function findingBlock(f) {
  return [
    f.id + '  [' + f.status + ' · ' + f.severity + ' · ' + f.certainty + ']  ' + f.category + ' — ' + (RULE_TITLES[f.rule] || f.rule),
    '  ' + field('Source class', f.sourceClass),
    '  ' + field('Test class', f.testClass),
    '  ' + field('Test method', f.testMethod),
    '  ' + field('Observation', f.observation),
    '  ' + field('Explanation', f.explanation),
    '  ' + field('Risk / impact', f.risk),
    '  ' + field('Recommended action', f.action),
    '  ' + field('Evidence reference', f.evidenceText),
  ].join('\n');
}

function metricLine(m, gated) {
  const res = m.na ? 'N/A (none in code)' : m.strict ? 'PASS' : m.meets ? 'Meets threshold' : 'BELOW THRESHOLD';
  return '  ' + m.label.padEnd(12) + (m.na ? '—' : fmtInt(m.covered)).padStart(10) + (m.na ? '—' : fmtInt(m.missed)).padStart(10) + (m.na ? '—' : fmtInt(m.total)).padStart(10) + m.pct.padStart(10) + '   ' + res + (gated && !gated.includes(m.type) ? ' (not gated)' : '');
}

function buildTextReport(A) {
  const R = A.review;
  const L = [];
  const title = 'JUNIT CODE COVERAGE & TEST QUALITY REVIEW';
  L.push(title, '='.repeat(title.length));
  L.push(field('Enhancement / CR', R.crRef || '(not entered)'));
  L.push(field('Application', R.appName || '(not entered)'));
  L.push(field('Module', R.moduleName || '(not entered)'));
  L.push(field('Review scope', R.scopeDesc || '(not entered)'));
  L.push(field('Coverage threshold', R.threshold + '%' + (R.threshold >= 100 ? ' (strict — zero missed elements required)' : '') + '; metrics assessed: ' + R.gatedMetrics.map((m) => METRIC_LABEL[m]).join(', ')));
  L.push(field('Generated', (A.generatedAt || '') + ' — offline review; no code left this computer'));
  L.push('');
  L.push('OVERALL CONCLUSION: ' + A.conclusion.status.toUpperCase());
  L.push(wrapText(A.conclusion.headline, 100, ''));

  // 1
  const inv = A.inventory;
  L.push(heading(1, 'Enhancement Summary'));
  L.push(field('Status', A.sections[0].status));
  L.push(field('Evidence collected', plural(inv.snippets, 'snippet') + ': ' + plural(inv.testClasses, 'test class', 'test classes') + ' (' + plural(inv.testMethods, 'test method') + '), ' + plural(inv.prodClasses, 'production class', 'production classes') + ', ' +
    (A.jacoco.present ? plural(A.jacoco.count, 'JaCoCo report') : 'no JaCoCo report') + ', ' + (A.execution.present ? 'execution results' : 'no execution results') + ', ' + (A.scopeSnippets.length ? 'change scope' : 'no change scope') + '.'));
  for (const m of A.coverage.assessed.metrics.filter((x) => R.gatedMetrics.includes(x.type))) {
    if (!A.jacoco.present) break;
    L.push(field(m.label + ' coverage', m.na ? 'N/A' : m.pct + ' (' + fmtInt(m.covered) + ' of ' + fmtInt(m.total) + ') — measured, ' + A.coverage.assessed.label));
  }
  if (!A.jacoco.present) L.push(field('Coverage', A.coverage.notVerifiedText));

  // 2
  L.push(heading(2, 'JUnit Test Inventory'));
  L.push(field('Status', A.sections[1].status));
  L.push(field('Totals', plural(inv.testClasses, 'class', 'classes') + ', ' + plural(inv.testMethods, 'test method') + ' (' + inv.disabled + ' disabled, ' + inv.parameterized + ' parameterized); ' + inv.assertions + ' assertions, ' + inv.verifies + ' verifications, ' + inv.stubs + ' stubs, ' + inv.requests + ' API requests.'));
  L.push(field('Scenarios (code)', Object.keys(SCENARIO_LABEL).map((k) => SCENARIO_LABEL[k] + ' ' + inv.scenarios[k]).join(' · ')));
  for (const tc of A.testClasses) {
    L.push('');
    L.push('  ' + tc.label + '  [' + frameworkLabel(tc.framework) + ' · ' + tc.styles.join(', ') + ']  — snippet #' + tc.snippetSeq);
    if (tc.targetFqcns.length) L.push('    Target: ' + tc.targetFqcns.join(', '));
    for (const tm of tc.methods) {
      const bits = [tm.annotation, tm.disabled ? 'DISABLED' : '', tm.assertions.length + ' assert', tm.verifies.length + ' verify', tm.stubs.length ? tm.stubs.length + ' stub' : '', tm.requests.length ? tm.requests.map((r) => r.method + ' ' + (r.path || '?')).join(', ') : ''].filter(Boolean);
      L.push('    - ' + tm.name + (tm.displayName ? ' "' + truncate(tm.displayName, 60) + '"' : '') + '  (' + bits.join(' · ') + ')');
      const tags = scenarioTags(tm);
      if (tags.length) L.push('        scenarios: ' + tags.join(', '));
    }
  }

  // 3
  const q = A.findings.filter((f) => f.category === 'Test Quality');
  L.push(heading(3, 'Test Quality Analysis (static)'));
  L.push(field('Status', A.sections[2].status));
  L.push(field('Observations', countBySeverity(q)));
  for (const f of q) L.push('', findingBlock(f));

  // 4
  L.push(heading(4, 'Source-to-Test Traceability (static, apparent — not measured coverage)'));
  L.push(field('Status', A.sections[3].status));
  if (!A.trace) L.push(field('Note', A.prodClasses.length ? 'No test code to map against.' : 'Production source not supplied — static mapping not performed.'));
  else {
    for (const cr of A.trace.classRows) {
      L.push('');
      L.push('  ' + cr.cls.label + (cr.linkedTests.length ? '  ← ' + cr.linkedTests.map(simpleNameOf).join(', ') : '  ← no linked test class'));
      for (const r of cr.methods) {
        L.push('    ' + r.display + ' [line ' + r.line + '–' + r.endLine + ']: ' + r.status.toUpperCase() + (r.measured ? '  | JaCoCo: ' + r.measured.state + ' (' + r.measured.summary + ')' : ''));
        if (r.tests.length) L.push('      tests: ' + r.tests.slice(0, 6).map((t) => t.tc.simpleName + '.' + t.tm.name).join(', ') + (r.tests.length > 6 ? ' +' + (r.tests.length - 6) : ''));
        if (r.decisions.length) L.push('      conditions: ' + r.decisions.filter((d) => d.kind !== 'else').slice(0, 6).map((d) => 'L' + d.line + ' ' + truncate(d.text, 60)).join('; '));
        for (const g of r.gaps) L.push('      gap: ' + wrapText(g.text + (g.superseded ? ' [superseded: ' + g.superseded + ']' : ''), 90, '           '));
      }
    }
  }

  // 5
  L.push(heading(5, 'Actual Coverage Metrics'));
  L.push(field('Status', A.sections[4].status));
  if (!A.jacoco.present) L.push(A.coverage.notVerifiedText);
  else {
    L.push(field('Measured population', A.coverage.assessed.description));
    L.push('  ' + 'Metric'.padEnd(12) + 'Covered'.padStart(10) + 'Missed'.padStart(10) + 'Total'.padStart(10) + 'Percent'.padStart(10) + '   Result');
    for (const m of A.coverage.assessed.metrics) L.push(metricLine(m, R.gatedMetrics));
    const S = A.coverage.scope;
    if (S && S.changed && S.changed.assessable) {
      L.push('');
      L.push('  Changed-code coverage (diff lines × JaCoCo line data):');
      for (const m of S.changed.metrics) L.push(metricLine(m));
      L.push('    ' + S.changed.nonExecutable + ' changed lines are not executable (comments, declarations, blank).');
    }
    if (S && S.classes.length) {
      L.push('');
      L.push('  Affected-class coverage:');
      for (const r of S.classes) {
        if (!r.family.length) { L.push('    ' + r.name + ': NOT IN JACOCO REPORT'); continue; }
        L.push('    ' + r.name + ': ' + r.metrics.filter((m) => R.gatedMetrics.includes(m.type)).map((m) => m.label + ' ' + m.pct).join(', '));
      }
    }
    if (S && S.modules.length) {
      L.push('');
      L.push('  Affected-module coverage:');
      for (const mo of S.modules) L.push('    ' + mo.name + ': ' + (mo.metrics ? mo.metrics.filter((m) => R.gatedMetrics.includes(m.type)).map((m) => m.label + ' ' + m.pct).join(', ') + ' (' + mo.source + ')' : 'no module-level total in the supplied report — not inferred from class figures'));
    }
    if (A.jacoco.sessions.length) L.push(field('JaCoCo sessions', A.jacoco.sessions.slice(0, 3).map((s) => s.id + (s.dump ? ' @ ' + new Date(s.dump).toISOString() : '')).join('; ')));
  }
  if (A.declared.entries.length) {
    L.push('');
    L.push('  Declared coverage — USER-ENTERED / VENDOR-DECLARED, NOT INDEPENDENTLY VERIFIED:');
    for (const d of A.declared.entries) L.push('    ' + d.scope + ' · ' + (METRIC_LABEL[d.metric] || 'Overall') + ': ' + d.pct + ' (' + d.provenance + ', snippet #' + d.snippetSeq + ')' + (d.measured ? ' — JaCoCo: ' + d.measured + (d.conflict ? ' CONFLICT' : '') : ''));
  }
  if (A.execution.present) {
    const t = A.execution.totals;
    L.push('');
    L.push(field('Test execution', t.tests + ' executions — ' + t.passed + ' passed, ' + t.failed + ' failed, ' + t.errors + ' errors, ' + t.skipped + ' skipped'));
  }

  // 6
  L.push(heading(6, 'Uncovered Code Findings'));
  L.push(field('Status', A.sections[5].status));
  if (!A.jacoco.present) L.push(A.coverage.notVerifiedText);
  else if (!A.uncovered.length) L.push('  No missed lines, branches or methods in the supplied JaCoCo report.');
  for (const g of A.uncovered) {
    L.push('');
    L.push('  ' + g.fqcn + (g.inScope ? ' [IN SCOPE]' : '') + (g.classNotExecuted ? ' — CLASS NEVER EXECUTED' : ''));
    for (const m of g.methods.slice(0, 15)) L.push('    method not fully executed: ' + (m.name === '<init>' ? 'constructor' : m.name + '()') + (m.line ? ' (line ' + m.line + ')' : '') + ' — instructions ' + pctText(m.instr.covered, m.instr.total));
    for (const l of g.lines.slice(0, 60)) L.push('    line ' + String(l.nr).padStart(4) + ' ' + (l.kind === 'missed' ? 'NOT EXECUTED  ' : 'PARTLY        ') + (l.text ? truncate(l.text, 80) : ''));
    if (g.lines.length > 60) L.push('    … ' + (g.lines.length - 60) + ' more lines');
    for (const b of g.branches.slice(0, 30)) L.push('    line ' + String(b.nr).padStart(4) + ' BRANCHES ' + b.cb + '/' + (b.mb + b.cb) + ' covered  ' + (b.text ? truncate(b.text, 70) : ''));
  }

  // 7
  L.push(heading(7, 'Evidence Completeness'));
  L.push(field('Status', A.sections[6].status));
  for (const it of A.evidenceItems) L.push('  ' + ('[' + it.status + ']').padEnd(24) + (it.label + (it.required ? ' (required)' : '')).padEnd(38) + it.detail);

  // 8
  L.push(heading(8, 'Final Review Conclusion'));
  L.push('OVERALL: ' + A.conclusion.status.toUpperCase() + ' — ' + A.conclusion.headline);
  L.push('');
  for (const c of A.conclusion.components) L.push('  ' + ('[' + c.status + ']').padEnd(24) + c.name.padEnd(26) + wrapText(c.text, 70, ' '.repeat(52)));
  if (A.conclusion.actions.length) {
    L.push('', 'Required / recommended actions:');
    A.conclusion.actions.forEach((a, i) => L.push('  ' + (i + 1) + '. ' + wrapText(a.text, 94, '     ')));
  }
  L.push('', 'Limitations:');
  for (const l of A.conclusion.limitations) L.push('  - ' + wrapText(l, 96, '    '));

  // Appendix
  const rest = A.findings.filter((f) => f.category !== 'Test Quality');
  if (rest.length) {
    L.push(heading('', 'Appendix — other findings (coverage, traceability, execution, scope, evidence)'));
    for (const f of rest) L.push('', findingBlock(f));
  }
  L.push('', '— End of report —');
  return L.join('\n');
}

function countBySeverity(list) {
  if (!list.length) return 'None.';
  const c = { High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const f of list) c[f.severity]++;
  const d = list.filter((f) => f.certainty === 'Definite').length;
  return list.length + ' total — ' + c.High + ' high, ' + c.Medium + ' medium, ' + c.Low + ' low, ' + c.Info + ' info; ' + d + ' definite, ' + (list.length - d) + ' possible.';
}

function frameworkLabel(fw) {
  return { junit5: 'JUnit 5', junit4: 'JUnit 4', mixed: 'JUnit 4 + 5', testng: 'TestNG', unknown: 'Framework unknown' }[fw] || fw;
}

/* ---------- Tab-separated output for Excel ---------- */

function tsvCell(v) {
  let s = v == null ? '' : String(v);
  s = s.replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  // Spreadsheet formula injection: text that Excel would evaluate is prefixed with an apostrophe.
  if (/^[=+\-@]/.test(s) && !/^[-+]?\d+(?:[.,]\d+)?%?$/.test(s)) s = "'" + s;
  return s;
}

function tsvRows(rows) {
  return rows.map((r) => r.map(tsvCell).join('\t')).join('\n');
}

function tsvFindings(A) {
  const rows = [['Finding ID', 'Status', 'Severity', 'Certainty', 'Category', 'Rule', 'Source Class', 'Test Class', 'Test Method', 'Observation', 'Explanation', 'Risk / Impact', 'Recommended Action', 'Evidence Reference']];
  for (const f of A.findings) rows.push([f.id, f.status, f.severity, f.certainty, f.category, RULE_TITLES[f.rule] || f.rule, f.sourceClass, f.testClass, f.testMethod, f.observation, f.explanation, f.risk, f.action, f.evidenceText]);
  return tsvRows(rows);
}

function tsvInventory(A) {
  const rows = [['Test Class', 'Framework', 'Style', 'Test Method', 'Annotation', 'Display Name', 'Disabled', 'Assertions', 'Verifications', 'Stubs', 'API Requests', 'Scenarios (code evidence)', 'Scenarios (name only)', 'Execution', 'Snippet', 'Line']];
  for (const tc of A.testClasses) {
    for (const tm of tc.methods) {
      const code = Object.keys(SCENARIO_LABEL).filter((k) => tm.scenario[k] === 'code').map((k) => SCENARIO_LABEL[k]).join(', ');
      const name = Object.keys(SCENARIO_LABEL).filter((k) => tm.scenario[k] === 'name').map((k) => SCENARIO_LABEL[k]).join(', ');
      rows.push([tc.label, frameworkLabel(tc.framework), tc.styles.join(', '), tm.name, tm.annotation, tm.displayName, tm.disabled ? 'Yes' : 'No', tm.assertions.length, tm.verifies.length, tm.stubs.length,
        tm.requests.map((r) => r.method + ' ' + (r.path || '?')).join(', '), code, name, tm.execution ? tm.execution.status : 'no results supplied', '#' + tc.snippetSeq, tm.nameLine]);
    }
  }
  return tsvRows(rows);
}

function tsvTraceability(A) {
  const rows = [['Production Class', 'Production Method', 'Lines', 'Kind', 'Visibility', 'Decision Points', 'Related Test Class', 'Related Test Methods', 'Link Basis', 'Apparent Status (static)', 'JaCoCo Measured', 'Potential Gaps']];
  if (!A.trace) return tsvRows(rows.concat([['(production source not supplied — static mapping not performed)']]));
  for (const cr of A.trace.classRows) {
    for (const r of cr.methods) {
      rows.push([cr.cls.label, r.display, r.line + '-' + r.endLine, r.kind, r.visibility, r.decisions.filter((d) => d.kind !== 'else').map((d) => 'L' + d.line + ' ' + d.kind).join('; '),
        uniq(r.tests.map((t) => t.tc.simpleName)).join(', '), r.tests.map((t) => t.tm.name).join(', '), r.basis.join('; '), r.status,
        r.measured ? r.measured.state + ' (' + r.measured.summary + ')' : (A.jacoco.present ? 'not matched' : 'not verified'),
        r.gaps.map((g) => (g.superseded ? '[superseded] ' : '') + g.text).join(' | ')]);
    }
  }
  return tsvRows(rows);
}

function tsvCoverage(A) {
  const rows = [['Scope', 'Item', 'Metric', 'Covered', 'Missed', 'Total', 'Percent', 'Result', 'Evidence']];
  if (!A.jacoco.present) {
    rows.push(['All', '', '', '', '', '', '', A.coverage.notVerifiedText, '']);
  } else {
    for (const m of A.coverage.assessed.metrics) rows.push([A.coverage.assessed.basis === 'scope' ? 'Affected classes (total)' : 'JaCoCo report total', A.coverage.assessed.label, m.label, m.na ? '' : m.covered, m.na ? '' : m.missed, m.na ? '' : m.total, m.pct, metricResult(m), 'JaCoCo (verified)']);
    const S = A.coverage.scope;
    if (S && S.changed && S.changed.assessable) for (const m of S.changed.metrics) rows.push(['Changed code', 'Changed lines in diff', m.label, m.na ? '' : m.covered, m.na ? '' : m.missed, m.na ? '' : m.total, m.pct, metricResult(m), 'JaCoCo line data × git diff']);
    if (S) for (const r of S.classes) {
      if (!r.family.length) { rows.push(['Affected class', r.name, '', '', '', '', '', 'NOT IN JACOCO REPORT', 'Scope snippet #' + r.entry.snippetSeq]); continue; }
      for (const m of r.metrics) rows.push(['Affected class', r.name, m.label, m.na ? '' : m.covered, m.na ? '' : m.missed, m.na ? '' : m.total, m.pct, metricResult(m), 'JaCoCo (verified)']);
    }
    if (S) for (const mo of S.modules) {
      if (!mo.metrics) { rows.push(['Affected module', mo.name, '', '', '', '', '', 'No module-level total supplied', '']); continue; }
      for (const m of mo.metrics) rows.push(['Affected module', mo.name, m.label, m.na ? '' : m.covered, m.na ? '' : m.missed, m.na ? '' : m.total, m.pct, metricResult(m), mo.source]);
    }
  }
  for (const d of A.declared.entries) rows.push(['Declared (not verified)', d.scope, METRIC_LABEL[d.metric] || 'Overall', d.covered != null ? d.covered : '', d.total != null ? d.total - d.covered : '', d.total != null ? d.total : '', d.pct, d.conflict ? 'CONFLICTS WITH JACOCO (' + d.measured + ')' : 'Not verified', d.provenance + ', snippet #' + d.snippetSeq]);
  return tsvRows(rows);
}

function metricResult(m) {
  return m.na ? 'N/A' : m.strict ? 'Pass (100%)' : m.meets ? 'Meets threshold' : 'Below threshold';
}

function tsvUncovered(A) {
  const rows = [['Class', 'In Scope', 'Line', 'Kind', 'Missed Instructions', 'Branches Covered', 'Branches Total', 'Source Text', 'Method']];
  for (const g of A.uncovered) {
    const byNr = new Map();
    for (const l of g.lines) byNr.set(l.nr, { nr: l.nr, kind: l.kind === 'missed' ? 'Not executed' : 'Partly executed', mi: l.mi, text: l.text });
    for (const b of g.branches) { const e = byNr.get(b.nr) || { nr: b.nr, kind: 'Missed branches', mi: '', text: b.text }; e.cb = b.cb; e.bt = b.mb + b.cb; byNr.set(b.nr, e); }
    const list = Array.from(byNr.values()).sort((a, b) => a.nr - b.nr);
    if (!list.length) rows.push([g.fqcn, g.inScope ? 'Yes' : 'No', '', g.classNotExecuted ? 'Class never executed' : 'Missed methods (no line data)', '', '', '', '', g.methods.map((m) => m.name).join(', ')]);
    for (const e of list) rows.push([g.fqcn, g.inScope ? 'Yes' : 'No', e.nr, e.kind, e.mi, e.cb != null ? e.cb : '', e.bt != null ? e.bt : '', e.text, g.methodOf(e.nr)]);
  }
  return tsvRows(rows);
}

function tsvEvidence(A) {
  const rows = [['Evidence Item', 'Required', 'Status', 'Detail']];
  for (const it of A.evidenceItems) rows.push([it.label, it.required ? 'Yes' : 'No', it.status, it.detail]);
  rows.push([]);
  rows.push(['Conclusion Component', '', 'Status', 'Detail']);
  for (const c of A.conclusion.components) rows.push([c.name, '', c.status, c.text]);
  rows.push(['OVERALL', '', A.conclusion.status, A.conclusion.headline]);
  return tsvRows(rows);
}

function buildTsvReport(A, which) {
  const R = A.review;
  const parts = {
    findings: ['FINDINGS', tsvFindings(A)],
    inventory: ['JUNIT TEST INVENTORY', tsvInventory(A)],
    traceability: ['SOURCE-TO-TEST TRACEABILITY (static, apparent — not measured)', tsvTraceability(A)],
    coverage: ['COVERAGE METRICS', tsvCoverage(A)],
    uncovered: ['UNCOVERED CODE', tsvUncovered(A)],
    evidence: ['EVIDENCE COMPLETENESS & CONCLUSION', tsvEvidence(A)],
  };
  if (which && parts[which]) return parts[which][1];
  const header = tsvRows([
    ['JUnit Review', R.crRef, R.appName, R.moduleName, 'Threshold ' + R.threshold + '%', 'Overall: ' + A.conclusion.status, A.generatedAt],
  ]);
  return [header].concat(Object.keys(parts).map((k) => tsvCell(parts[k][0]) + '\n' + parts[k][1])).join('\n\n');
}
