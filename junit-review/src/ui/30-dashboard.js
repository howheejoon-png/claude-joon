/* ------------------------------------------------------------------------
 * Review dashboard: eight sections rendered from the analysis result.
 * --------------------------------------------------------------------- */

const COUNTER_WORD = { INSTRUCTION: ['instruction', 'instructions'], BRANCH: ['branch', 'branches'], LINE: ['line', 'lines'], METHOD: ['method', 'methods'], CLASS: ['class', 'classes'] };
const SCEN_KEYS = ['positive', 'negative', 'exception', 'boundary', 'nullEmpty', 'security'];
const TRACE_CLASS = {};
const dashState = { filters: {}, invFilter: '' };

function renderDashboard() {
  const A = S.result;
  const nav = clear($('#dash-nav'));
  const body = clear($('#dash-body'));
  if (!A) { body.appendChild(h('p', { class: 'muted', text: 'Analysing…' })); return; }
  for (const k of Object.keys(JR.TRACE)) TRACE_CLASS[JR.TRACE[k]] = 'trace-' + k.toLowerCase();

  const list = h('ol', { class: 'dash-nav-list' });
  A.sections.forEach((sec, i) => {
    const a = h('a', { href: '#sec-' + sec.key, class: 'dash-link', onclick: (e) => { e.preventDefault(); scrollToSection(sec.key); } },
      h('span', { class: 'dash-link-n', text: String(i + 1) }),
      h('span', { class: 'dash-link-t', text: sec.title }),
      h('span', { class: 'dot dot-' + STATUS_CLASS[sec.status], title: sec.status, 'aria-label': sec.status }));
    list.appendChild(h('li', {}, a));
  });
  nav.appendChild(list);
  nav.appendChild(h('p', { class: 'dash-nav-note' }, plural(A.findings.length, 'finding'), ' · analysed in ', String(S.analysisMs || 0), ' ms'));

  const renderers = { summary: secSummary, inventory: secInventory, quality: secQuality, trace: secTrace, coverage: secCoverage, uncovered: secUncovered, evidence: secEvidence, conclusion: secConclusion };
  A.sections.forEach((sec, i) => {
    const content = renderers[sec.key](A, sec);
    body.appendChild(h('section', { class: 'dsec card', id: 'sec-' + sec.key, 'aria-labelledby': 'sec-h-' + sec.key },
      h('header', { class: 'dsec-head' },
        h('h2', { id: 'sec-h-' + sec.key }, h('span', { class: 'dsec-n', text: String(i + 1) }), sec.title),
        statusBadge(sec.status, { suffix: sec.staticOnly && sec.status === JR.STATUS.PASS ? ' · static checks' : '' })),
      content));
  });
}

function scrollToSection(key) {
  const el = $('#sec-' + key);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  const h2 = $('#sec-h-' + key);
  if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus({ preventScroll: true }); }
}

/* ---------- shared pieces ---------- */

function table(headers, rows, cls) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'tbl' + (cls ? ' ' + cls : '') },
      h('thead', {}, h('tr', {}, headers.map((x) => h('th', { scope: 'col', text: x })))),
      h('tbody', {}, rows)));
}

function td(content, cls) {
  return h('td', { class: cls || null }, content);
}

function evidenceLinks(evs) {
  return evs.map((e) => {
    if (!e.snippetId) return h('span', { class: 'ev', text: e.label || '' });
    return h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(e.snippetId, e.line), title: 'Open the evidence' + (e.line ? ' at line ' + e.line : '') }, svg('eye'), h('span', { text: e.label }));
  });
}

function findingCard(f) {
  const field = (label, value) => (value ? [h('dt', { text: label }), h('dd', { text: value })] : null);
  return h('article', { class: 'finding f-' + STATUS_CLASS[f.status], dataset: { sev: f.severity, cert: f.certainty, cat: f.category, status: f.status } },
    h('header', { class: 'finding-head' },
      h('span', { class: 'finding-id', text: f.id }),
      statusBadge(f.status),
      sevChip(f.severity),
      certChip(f.certainty),
      h('span', { class: 'finding-rule', text: f.category + ' · ' + (JR.RULE_TITLES[f.rule] || f.rule) })),
    h('p', { class: 'finding-obs', text: f.observation }),
    h('dl', { class: 'finding-fields' },
      field('Source class', f.sourceClass), field('Test class', f.testClass), field('Test method', f.testMethod),
      field('Explanation', f.explanation), field('Risk / impact', f.risk), field('Recommended action', f.action)),
    h('div', { class: 'finding-ev' }, h('span', { class: 'finding-ev-l', text: 'Evidence:' }), f.evidence.length ? evidenceLinks(f.evidence) : h('span', { class: 'muted', text: f.evidenceText })));
}

function findingList(list, emptyText) {
  if (!list.length) return h('p', { class: 'muted', text: emptyText || 'No findings.' });
  return h('div', { class: 'finding-list' }, list.map(findingCard));
}

function metricCard(m, gated, threshold) {
  const isGated = gated.includes(m.type);
  const state = m.na ? 'na' : m.strict ? 'pass' : m.meets ? (threshold >= 100 ? 'pass' : 'meets') : 'fail';
  const ratio = m.total ? m.covered / m.total : 0;
  const bar = h('div', { class: 'bar', role: 'img', 'aria-label': m.label + ' ' + m.pct },
    h('span', { class: 'bar-fill' }));
  bar.firstChild.style.transform = 'scaleX(' + ratio + ')';
  return h('div', { class: 'metric metric-' + state + (isGated ? '' : ' not-gated') },
    h('div', { class: 'metric-top' }, h('span', { class: 'metric-label', text: m.label }), isGated ? null : chip('not gated', 'chip-muted')),
    h('div', { class: 'metric-pct', text: m.na ? 'N/A' : m.pct }),
    bar,
    h('div', { class: 'metric-sub', text: m.na ? 'No ' + m.label.toLowerCase() + ' elements in the measured code' : fmt(m.covered) + ' of ' + fmt(m.total) + ' covered · ' + fmt(m.missed) + ' missed' }),
    h('div', { class: 'metric-res', text: m.na ? 'Not applicable' : m.strict ? 'Pass — zero missed' : m.meets ? 'Meets ' + threshold + '% threshold' : 'Below ' + threshold + '% threshold' }));
}

function notVerifiedPanel(A) {
  return h('div', { class: 'callout callout-insufficient big' },
    h('p', { class: 'callout-title', text: A.coverage.notVerifiedText }),
    h('p', { text: 'Static review of the test code is shown in the other sections, but no figure on this page is measured coverage. Paste the jacoco.xml produced by the test run (Input type: JaCoCo Coverage Report) to verify coverage.' }));
}

function tagCells(tm) {
  return SCEN_KEYS.map((k) => (tm.scenario[k] === 'code' ? chip(JR.SCENARIO_LABEL[k], 'tag tag-' + k, (tm.evidence[k] || []).join('; ')) : tm.scenario[k] === 'name' ? chip(JR.SCENARIO_LABEL[k] + '?', 'tag tag-name', 'Suggested by the test name only — no code evidence') : null));
}

function execChip(tm) {
  if (!tm.execution) return h('span', { class: 'muted', text: '—' });
  const map = { passed: ['Passed', 'pass'], failed: ['Failed', 'fail'], error: ['Error', 'fail'], skipped: ['Skipped', 'review'], 'not-found': ['No record', 'review'], inferred: ['Ran (summary)', 'pass'], unattributed: ['Ran (param.)', 'pass'] };
  const [t, c] = map[tm.execution.status] || [tm.execution.status, 'na'];
  return chip(t, 'chip-' + c);
}

/* ---------- 1. Summary ---------- */

function secSummary(A) {
  const R = A.review;
  const inv = A.inventory;
  const facts = h('dl', { class: 'facts' },
    h('dt', { text: 'Enhancement / CR' }), h('dd', { text: R.crRef || 'Not entered' }),
    h('dt', { text: 'Application' }), h('dd', { text: R.appName || 'Not entered' }),
    h('dt', { text: 'Module' }), h('dd', { text: R.moduleName || '—' }),
    h('dt', { text: 'Threshold' }), h('dd', { text: R.threshold + '%' + (R.threshold >= 100 ? ' (strict)' : '') + ' · ' + R.gatedMetrics.map((m) => JR.METRIC_LABEL[m]).join(', ') }),
    h('dt', { text: 'Scope description' }), h('dd', { class: 'pre-line', text: R.scopeDesc || '—' }),
    h('dt', { text: 'Analysed' }), h('dd', { text: A.generatedAt }));
  const tiles = h('div', { class: 'tiles' },
    tile('Test classes', inv.testClasses, inv.frameworks.map(JR.frameworkLabel).join(', ') || '—'),
    tile('Test methods', inv.testMethods, inv.disabled ? inv.disabled + ' disabled' : inv.parameterized ? inv.parameterized + ' parameterized' : 'all enabled'),
    tile('Checks', inv.checks, 'assertions & expectations · ' + inv.verifies + ' verifications'),
    tile('Production classes', inv.prodClasses, inv.prodMethods + ' methods'),
    coverageTile(A, 'LINE'), coverageTile(A, 'BRANCH'));
  return h('div', { class: 'summary' },
    h('div', { class: 'verdict verdict-' + STATUS_CLASS[A.conclusion.status] },
      h('div', { class: 'verdict-label', text: 'Overall review status' }),
      statusBadge(A.conclusion.status, { large: true }),
      h('p', { class: 'verdict-text', text: A.conclusion.headline }),
      button('See conclusion', { class: 'btn btn-sm', onclick: () => scrollToSection('conclusion') }, 'arrow')),
    facts, tiles);
}

function tile(label, n, sub) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-n', text: String(n) }), h('div', { class: 'tile-l', text: label }), h('div', { class: 'tile-s', text: sub }));
}

function coverageTile(A, type) {
  const label = JR.METRIC_LABEL[type] + ' coverage';
  if (!A.jacoco.present) return h('div', { class: 'tile tile-unverified' }, h('div', { class: 'tile-n', text: 'NOT VERIFIED' }), h('div', { class: 'tile-l', text: label }), h('div', { class: 'tile-s', text: 'JaCoCo evidence required' }));
  const m = A.coverage.assessed.metrics.find((x) => x.type === type);
  return h('div', { class: 'tile tile-' + (m.na ? 'na' : m.meets ? 'pass' : 'fail') }, h('div', { class: 'tile-n', text: m.na ? 'N/A' : m.pct }), h('div', { class: 'tile-l', text: label + ' (measured)' }), h('div', { class: 'tile-s', text: m.na ? 'none in code' : fmt(m.covered) + ' / ' + fmt(m.total) + ' · ' + A.coverage.assessed.label }));
}

/* ---------- 2. Inventory ---------- */

function secInventory(A) {
  const inv = A.inventory;
  if (!A.testClasses.length) return h('div', { class: 'callout callout-insufficient' }, h('p', { text: 'No JUnit test classes have been collected. Paste test classes in step 2.' }));
  const filter = h('input', { type: 'search', class: 'search', placeholder: 'Filter by class or method name…', 'aria-label': 'Filter test inventory', value: dashState.invFilter, spellcheck: 'false' });
  const listHost = h('div', { class: 'inv-list' });
  const draw = () => {
    clear(listHost);
    const q = filter.value.trim().toLowerCase();
    dashState.invFilter = filter.value;
    for (const tc of A.testClasses) {
      const methods = tc.methods.filter((m) => !q || tc.fqcn.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.displayName || '').toLowerCase().includes(q));
      if (!methods.length) continue;
      const counts = { a: 0, v: 0, s: 0, r: 0 };
      for (const m of tc.methods) { counts.a += m.checkCount || 0; counts.v += m.verifies.length; counts.s += m.stubs.length; counts.r += m.requests.length; }
      const rows = methods.map((m) => h('tr', { class: m.disabled ? 'is-disabled' : null },
        td(h('div', {}, h('span', { class: 'mono', text: m.name }), m.displayName ? h('div', { class: 'muted small', text: '“' + m.displayName + '”' }) : null, m.disabled ? chip('Disabled', 'chip-review') : null)),
        td(h('span', { class: 'mono small', text: m.annotation })),
        td(h('div', { class: 'tags' }, tagCells(m))),
        td(String(m.checkCount || 0), 'num'), td(String(m.verifies.length), 'num'), td(String(m.stubs.length), 'num'),
        td(m.requests.length ? h('div', { class: 'small mono' }, m.requests.map((r) => h('div', { text: r.method + ' ' + (r.path || '?') }))) : h('span', { class: 'muted', text: '—' })),
        td(execChip(m)),
        td(h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(tc.snippetId, m.nameLine), title: 'View in snippet #' + tc.snippetSeq }, 'L' + m.nameLine))));
      listHost.appendChild(h('details', { class: 'inv-class', open: A.testClasses.length <= 4 || !!q },
        h('summary', {},
          h('span', { class: 'inv-name mono', text: tc.label }),
          chip(JR.frameworkLabel(tc.framework), tc.framework === 'mixed' ? 'chip-warn' : 'chip-soft'),
          tc.styles.map((s) => chip(s, 'chip-outline')),
          h('span', { class: 'inv-counts', text: plural(tc.methods.length, 'test') + ' · ' + counts.a + ' checks · ' + counts.v + ' verify · ' + counts.s + ' stub' + (counts.r ? ' · ' + counts.r + ' API' : '') })),
        tc.targetFqcns.length ? h('p', { class: 'small muted', text: 'Target: ' + tc.targetFqcns.join(', ') + ' (' + tc.targets.map((t) => t.basis).filter((v, i, a) => a.indexOf(v) === i).join(', ') + ')' }) : null,
        table(['Test method', 'Type', 'Scenarios (code evidence; “?” = name only)', 'Checks', 'Verify', 'Stub', 'API requests', 'Execution', 'Line'], rows, 'tbl-inv')));
    }
    if (!listHost.children.length) listHost.appendChild(h('p', { class: 'muted', text: 'No tests match the filter.' }));
  };
  filter.addEventListener('input', debounce(draw, 120));
  draw();
  return h('div', {},
    h('div', { class: 'stat-row' },
      stat('Test classes', inv.testClasses), stat('Test methods', inv.testMethods), stat('Disabled', inv.disabled), stat('Parameterized', inv.parameterized),
      stat('Assertions & expectations', inv.checks), stat('Verifications', inv.verifies), stat('Stubs', inv.stubs), stat('API requests', inv.requests)),
    h('div', { class: 'scenario-totals' }, h('span', { class: 'muted small', text: 'Tests with code evidence of:' }), SCEN_KEYS.map((k) => chip(JR.SCENARIO_LABEL[k] + ' ' + inv.scenarios[k], 'tag tag-' + k))),
    A.supportClasses.length ? h('p', { class: 'small muted', text: 'Test helper classes (no @Test methods): ' + A.supportClasses.map((c) => c.fqcn).join(', ') }) : null,
    h('div', { class: 'toolbar' }, filter), listHost);
}

function stat(label, n) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-n', text: String(n) }), h('span', { class: 'stat-l', text: label }));
}

/* ---------- 3. Quality ---------- */

function secQuality(A) {
  if (!A.testClasses.length) return h('div', { class: 'callout callout-insufficient' }, h('p', { text: 'Insufficient evidence: no test code to review.' }));
  const q = A.findings.filter((f) => f.category === 'Test Quality');
  const sev = { High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const f of q) sev[f.severity]++;
  const matrixRows = A.testClasses.map((tc) => {
    const enabled = tc.methods.filter((m) => !m.disabled);
    return h('tr', {}, td(h('span', { class: 'mono', text: tc.simpleName })), td(String(enabled.length), 'num'),
      SCEN_KEYS.map((k) => {
        const code = enabled.filter((m) => m.scenario[k] === 'code').length;
        const name = enabled.filter((m) => m.scenario[k] === 'name').length;
        return td(code ? h('span', { class: 'mx mx-yes', title: enabled.filter((m) => m.scenario[k] === 'code').map((m) => m.name).join(', ') }, svg('pass'), String(code)) : name ? h('span', { class: 'mx mx-name', title: 'Name suggests this scenario but no code evidence: ' + enabled.filter((m) => m.scenario[k] === 'name').map((m) => m.name).join(', ') }, '? ' + name) : h('span', { class: 'mx mx-no', text: '—' }), 'center');
      }));
  });
  return h('div', {},
    note(['Static analysis of the pasted test code. ', h('strong', { text: 'Definite' }), ' observations are directly visible in the code; ', h('strong', { text: 'Possible' }), ' ones are heuristics for a reviewer to confirm. Scenarios are judged from code evidence, not test names.']),
    h('div', { class: 'stat-row' }, stat('High', sev.High), stat('Medium', sev.Medium), stat('Low', sev.Low), stat('Info', sev.Info), stat('Definite', q.filter((f) => f.certainty === 'Definite').length), stat('Possible', q.filter((f) => f.certainty === 'Possible').length)),
    h('h3', { text: 'Scenario evidence by test class' }),
    table(['Test class', 'Tests', 'Positive', 'Negative', 'Exception', 'Boundary', 'Null/Empty', 'Security'], matrixRows, 'tbl-matrix'),
    h('h3', { text: 'Observations' }),
    filteredFindings(q, 'No test-quality observations from the static rules.', { key: 'quality' }));
}

function filteredFindings(list, emptyText, opts) {
  const key = (opts && opts.key) || 'default';
  if (!dashState.filters[key]) dashState.filters[key] = { severity: 'all', certainty: 'all', category: 'all', status: 'all', q: '' };
  const f = dashState.filters[key];
  const host = h('div', {});
  const sevSel = selectFilter('Severity', ['all', 'High', 'Medium', 'Low', 'Info'], f.severity, (v) => { f.severity = v; draw(); });
  const certSel = selectFilter('Certainty', ['all', 'Definite', 'Possible'], f.certainty, (v) => { f.certainty = v; draw(); });
  const extra = [];
  if (opts && opts.withCategory) {
    extra.push(selectFilter('Category', ['all'].concat(Array.from(new Set(list.map((x) => x.category)))), f.category, (v) => { f.category = v; draw(); }));
    extra.push(selectFilter('Status', ['all'].concat(Object.values(JR.STATUS).filter((s) => list.some((x) => x.status === s))), f.status, (v) => { f.status = v; draw(); }));
  }
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Search findings…', 'aria-label': 'Search findings', value: f.q, spellcheck: 'false' });
  search.addEventListener('input', debounce(() => { f.q = search.value; draw(); }, 140));
  const listHost = h('div', {});
  const countEl = h('span', { class: 'muted small' });
  function draw() {
    const q = f.q.trim().toLowerCase();
    const shown = list.filter((x) => (f.severity === 'all' || x.severity === f.severity) && (f.certainty === 'all' || x.certainty === f.certainty) &&
      (!(opts && opts.withCategory) || ((f.category === 'all' || x.category === f.category) && (f.status === 'all' || x.status === f.status))) &&
      (!q || [x.observation, x.sourceClass, x.testClass, x.testMethod, x.id, JR.RULE_TITLES[x.rule]].join(' ').toLowerCase().includes(q)));
    countEl.textContent = 'Showing ' + shown.length + ' of ' + list.length;
    clear(listHost).appendChild(findingList(shown.slice(0, 300), list.length ? 'No findings match the filters.' : emptyText));
    if (shown.length > 300) listHost.appendChild(h('p', { class: 'muted', text: (shown.length - 300) + ' more — narrow the filters, or use the Report step for the full list.' }));
  }
  draw();
  if (!list.length) return h('p', { class: 'muted', text: emptyText });
  append(host, [h('div', { class: 'toolbar' }, sevSel, certSel, extra, search, countEl), listHost]);
  return host;
}

function selectFilter(label, values, current, onchange) {
  const sel = h('select', { class: 'mini-select', 'aria-label': label });
  for (const v of values) sel.appendChild(h('option', { value: v, text: v === 'all' ? label + ': all' : v }));
  sel.value = values.includes(current) ? current : 'all';
  sel.addEventListener('change', () => onchange(sel.value));
  return sel;
}

/* ---------- 4. Traceability ---------- */

function secTrace(A) {
  if (!A.trace) {
    return h('div', { class: 'callout callout-insufficient' },
      h('p', { class: 'callout-title', text: 'Insufficient evidence for source-to-test mapping.' }),
      h('p', { text: A.prodClasses.length ? 'Production source was supplied but no test code to map it against.' : 'Paste the production classes changed by the enhancement (Input type: Production Source Code) to map each method to the tests that appear to exercise it.' }));
  }
  const legend = h('div', { class: 'legend' }, Object.keys(JR.TRACE).map((k) => chip(JR.TRACE[k], 'trace ' + TRACE_CLASS[JR.TRACE[k]])));
  const cards = A.trace.classRows.map((cr) => {
    const rows = cr.methods.map((r) => {
      const conds = r.decisions.filter((d) => d.kind !== 'else');
      const measured = r.measured ? chip(r.measured.state === 'covered' ? 'JaCoCo: covered' : r.measured.state === 'partial' ? 'JaCoCo: partly covered' : 'JaCoCo: not covered', r.measured.state === 'covered' ? 'chip-pass' : r.measured.state === 'partial' ? 'chip-review' : 'chip-fail', r.measured.summary) : h('span', { class: 'muted small', text: A.jacoco.present ? 'JaCoCo: no match' : 'JaCoCo: not verified' });
      return h('tr', {},
        td(h('div', {}, h('span', { class: 'mono', text: r.display }), h('div', { class: 'small muted' }, r.visibility + ' · ' + r.kind + ' · ', h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(cr.cls.snippetId, r.line), text: 'L' + r.line + '–' + r.endLine })), r.changed === true ? chip('changed', 'chip-warn', 'Contains lines changed in the supplied diff') : null)),
        td(conds.length ? h('details', { class: 'conds' }, h('summary', { text: plural(conds.length, 'condition') }), h('ul', {}, conds.map((d) => h('li', {}, h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(cr.cls.snippetId, d.line), text: 'L' + d.line }), ' ', h('code', { text: d.text }))))) : h('span', { class: 'muted', text: 'none' })),
        td(r.tests.length ? h('div', {}, h('ul', { class: 'plain small' }, r.tests.slice(0, 6).map((t) => h('li', {}, h('button', { type: 'button', class: 'ev-link mono', onclick: () => openViewer(t.tc.snippetId, t.tm.nameLine), text: t.tc.simpleName + '.' + t.tm.name }), t.request ? h('span', { class: 'muted', text: ' · ' + t.request }) : null)), r.tests.length > 6 ? h('li', { class: 'muted', text: '+' + (r.tests.length - 6) + ' more' }) : null), r.basis.length ? h('div', { class: 'basis', text: 'Link: ' + r.basis.join('; ') }) : null) : h('span', { class: 'muted', text: '—' })),
        td(h('div', { class: 'status-stack' }, chip(r.status, 'trace ' + TRACE_CLASS[r.status]), measured, r.executedPerJacoco ? h('div', { class: 'small muted', text: 'JaCoCo shows it executed' }) : null)),
        td(r.gaps.length ? h('ul', { class: 'gaps' }, r.gaps.map((g) => h('li', { class: g.superseded ? 'superseded' : null, title: g.superseded || '' }, g.text, g.superseded ? h('span', { class: 'small muted', text: ' — superseded: ' + g.superseded }) : null))) : h('span', { class: 'muted', text: r.status === JR.TRACE.NA ? (r.note || 'n/a') : 'none identified' })));
    });
    const jc = cr.jacocoClass;
    return h('div', { class: 'trace-class' },
      h('div', { class: 'trace-head' },
        h('h3', { class: 'mono', text: cr.cls.label }),
        cr.inScope === true ? chip('in scope', 'chip-soft') : cr.inScope === false ? chip('outside declared scope', 'chip-muted') : null,
        cr.cls.isInterface ? chip('interface', 'chip-outline') : null,
        cr.cls.stereotype ? chip('@' + cr.cls.stereotype, 'chip-outline') : null,
        cr.cls.lombok.length ? chip('Lombok ' + cr.cls.lombok.join(' '), 'chip-warn', 'Lombok-generated members are not visible to static analysis') : null,
        h('span', { class: 'small muted', text: cr.linkedTests.length ? 'Linked tests: ' + cr.linkedTests.map((x) => x.split('.').pop()).join(', ') : 'No linked test class' }),
        jc ? h('span', { class: 'small muted', text: ' · JaCoCo: ' + (cr.alignment && !cr.alignment.ok ? 'present (line numbers do not align)' : 'present') }) : null),
      table(['Production method', 'Conditions', 'Related tests', 'Status (static · measured)', 'Potential gaps'], rows, 'tbl-trace'));
  });
  return h('div', {},
    note(['Static, apparent mapping only — this is ', h('strong', { text: 'not' }), ' measured execution coverage. ', A.jacoco.present ? 'Where JaCoCo data is available it is shown alongside, and it takes precedence.' : 'No JaCoCo evidence is available to confirm it.'], true),
    legend, cards);
}

/* ---------- 5. Coverage ---------- */

function secCoverage(A) {
  const R = A.review;
  const parts = [];
  if (!A.jacoco.present) parts.push(notVerifiedPanel(A));
  else {
    const as = A.coverage.assessed;
    parts.push(h('p', { class: 'lede-sm' }, 'Measured by JaCoCo for ', h('strong', { text: as.description }), '. Percentages are exact from covered and missed counts and rounded down, so nothing short of zero missed shows as 100%.'));
    parts.push(h('div', { class: 'metrics' }, as.metrics.map((m) => metricCard(m, R.gatedMetrics, R.threshold))));
    const S2 = A.coverage.scope;
    if (S2) {
      parts.push(h('h3', { text: 'Coverage against the declared scope' }));
      const gm = R.gatedMetrics;
      const cells = (metrics) => gm.map((t) => { const m = metrics.find((x) => x.type === t); return td(m ? h('span', { class: 'pct ' + (m.na ? 'pct-na' : m.meets ? 'pct-ok' : 'pct-bad'), title: m.na ? 'none in code' : fmt(m.covered) + ' / ' + fmt(m.total), text: m.pct }) : h('span', { class: 'muted', text: '—' }), 'num'); });
      const verdict = (metrics) => statusBadge(metrics.every((m) => m.na || m.meets) ? JR.STATUS.PASS : JR.STATUS.FAIL);
      const rows = [];
      if (S2.changed && S2.changed.assessable) {
        const ch = S2.changed;
        rows.push(h('tr', {}, td(h('strong', { text: 'Changed code' })), td(plural(ch.lines.total, 'changed executable line') + (ch.lines.partial ? ' (' + ch.lines.partial + ' partly covered)' : '') + ' · ' + ch.nonExecutable + ' non-executable'),
          gm.map((t) => { const m = ch.metrics.find((x) => x.type === t); return td(m ? h('span', { class: 'pct ' + (m.na ? 'pct-na' : m.meets ? 'pct-ok' : 'pct-bad'), title: m.na ? 'none' : fmt(m.covered) + ' / ' + fmt(m.total), text: m.pct }) : h('span', { class: 'muted small', text: 'n/a' }), 'num'); }),
          td(statusBadge(ch.pass ? JR.STATUS.PASS : JR.STATUS.FAIL))));
      } else rows.push(h('tr', {}, td(h('strong', { text: 'Changed code' })), td(h('span', { class: 'muted', text: S2.changed ? 'Diff supplied, but no JaCoCo line data for the changed files' : 'No git diff supplied — changed-line coverage not assessed' })), gm.map(() => td('')), td(statusBadge(S2.changed ? JR.STATUS.INSUFFICIENT : JR.STATUS.NA))));
      if (S2.affected) rows.push(h('tr', {}, td(h('strong', { text: 'Affected classes' })), td(S2.affected.measuredClasses + ' of ' + S2.affected.declaredClasses + ' in-scope classes measured'), cells(S2.affected.metrics), td(verdict(S2.affected.metrics.filter((m) => gm.includes(m.type))))));
      for (const mo of S2.modules) {
        if (!mo.metrics) rows.push(h('tr', {}, td(h('strong', { text: 'Affected module' })), td(h('span', {}, mo.name + ' — ', h('span', { class: 'muted', text: 'no module-level total in the supplied report; not inferred from class figures' }))), gm.map(() => td('')), td(statusBadge(JR.STATUS.INSUFFICIENT))));
        else rows.push(h('tr', {}, td(h('strong', { text: 'Affected module' })), td(mo.name + ' (' + mo.source + ')'), cells(mo.metrics), td(verdict(mo.metrics.filter((m) => gm.includes(m.type))))));
      }
      parts.push(table(['Level', 'Population'].concat(gm.map((m) => JR.METRIC_LABEL[m]), ['Result']), rows, 'tbl-scope'));
      if (S2.classes.length) {
        parts.push(h('details', { class: 'sub', open: S2.classes.length <= 12 },
          h('summary', { text: 'Affected classes (' + S2.classes.length + ')' }),
          table(['Class', 'Change', ...R.gatedMetrics.map((m) => JR.METRIC_LABEL[m]), 'Tests found'], S2.classes.map((r) => h('tr', {},
            td(h('span', { class: 'mono', text: r.name })), td(r.entry.change || '?'),
            r.family.length ? r.metrics.filter((m) => R.gatedMetrics.includes(m.type)).map((m) => td(h('span', { class: 'pct ' + (m.na ? 'pct-na' : m.meets ? 'pct-ok' : 'pct-bad'), text: m.pct }), 'num')) : R.gatedMetrics.map((m, i) => td(i === 0 ? h('span', { class: 'pct pct-bad', text: 'not in report' }) : '', 'num')),
            td(r.tests.length ? r.tests.map((t) => t.simpleName).join(', ') : h('span', { class: 'muted', text: 'none linked' })))), 'tbl-classes')));
      }
      if (as.basis === 'scope') {
        parts.push(h('details', { class: 'sub' }, h('summary', { text: 'Whole JaCoCo report totals (reference only — not used for the verdict)' }),
          h('div', { class: 'metrics compact' }, as.reportMetrics.map((m) => metricCard(m, m.type === 'COMPLEXITY' ? [] : R.gatedMetrics, R.threshold)))));
      }
    } else {
      parts.push(h('div', { class: 'callout callout-insufficient' }, h('p', { class: 'callout-title', text: 'Scope evidence missing.' }),
        h('p', { text: 'These figures cover only the classes in the supplied JaCoCo report. Without a git diff or changed-class list it cannot be shown that this is the enhancement’s changed code, and whole-project coverage is not inferred.' })));
    }
    if (A.jacoco.sessions.length) parts.push(h('p', { class: 'small muted', text: 'JaCoCo session(s): ' + A.jacoco.sessions.slice(0, 4).map((s) => (s.id || 'session') + (s.dump ? ' — dumped ' + new Date(s.dump).toLocaleString() : '')).join('; ') }));
  }
  // Declared
  parts.push(h('h3', { text: 'Declared coverage (not verified)' }));
  if (!A.declared.entries.length) parts.push(h('p', { class: 'muted', text: 'No user-entered or vendor-declared figures. You can paste a coverage summary or enter figures manually in step 2.' }));
  else parts.push(h('div', { class: 'declared' },
    note(['These figures were typed or pasted from a summary. They are ', h('strong', { text: 'user-entered or vendor-declared and not independently verified' }), ', and never count towards a pass.']),
    table(['Scope', 'Metric', 'Declared', 'Source', 'JaCoCo measured', 'Agreement', 'Snippet'], A.declared.entries.map((d) => h('tr', {},
      td(d.scope), td(JR.METRIC_LABEL[d.metric] || 'Overall'), td(h('strong', { text: d.pct })), td(chip(d.provenance, 'chip-outline')),
      td(d.measured || h('span', { class: 'muted', text: A.jacoco.present ? 'no match' : 'not available' })),
      td(d.measured ? (d.conflict ? chip('Conflict', 'chip-fail') : chip('Consistent', 'chip-pass')) : h('span', { class: 'muted', text: '—' })),
      td(h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(d.snippetId, d.line), text: '#' + d.snippetSeq }))))))) ;
  // Execution
  parts.push(h('h3', { text: 'Test execution results' }));
  const E = A.execution;
  if (!E.present) parts.push(h('p', { class: 'muted', text: 'No JUnit execution results supplied. Paste the Surefire/Gradle XML (or console summary) to evidence that the tests passed.' }));
  else {
    const t = E.totals;
    parts.push(h('div', { class: 'stat-row' }, stat('Executions', t.tests), stat('Passed', t.passed), stat('Failed', t.failed), stat('Errors', t.errors), stat('Skipped', t.skipped), stat('No record', E.notExecuted.length)));
    const bad = E.cases.filter((c) => c.status !== 'passed');
    if (bad.length) parts.push(table(['Test class', 'Test', 'Result', 'Message'], bad.slice(0, 100).map((c) => h('tr', {}, td(h('span', { class: 'mono small', text: c.classname })), td(h('span', { class: 'mono small', text: c.name })), td(chip(c.status, c.status === 'skipped' ? 'chip-review' : 'chip-fail')), td(h('span', { class: 'small', text: c.message || '' })))), 'tbl-exec'));
    if (E.unmatchedCases.length) parts.push(h('p', { class: 'small muted', text: plural(E.unmatchedCases.length, 'result') + ' belong to test classes that were not pasted.' }));
  }
  const cov = A.findings.filter((f) => (f.category === 'Coverage' && f.rule !== 'UNCOVERED_CODE' && f.rule !== 'CLASS_NOT_EXECUTED') || f.category === 'Execution');
  if (cov.length) parts.push(h('h3', { text: 'Coverage and execution findings' }), findingList(cov));
  return h('div', {}, parts);
}


/* ---------- 6. Uncovered ---------- */

function secUncovered(A) {
  if (!A.jacoco.present) return notVerifiedPanel(A);
  if (!A.uncovered.length) return h('div', { class: 'callout callout-pass' }, h('p', { text: 'JaCoCo reports no missed instructions, branches, lines, methods or classes in the supplied report.' }));
  const scoped = A.coverage.scope && A.coverage.scope.classes.length;
  return h('div', {},
    scoped ? note('Classes inside the declared scope are listed first. Classes outside it are shown for information and do not affect the verdict.') : null,
    A.uncovered.map((g) => {
      const srcInfo = A.prodClasses.find((p) => p.binaryName === g.outerBinary);
      const rows = [];
      const byNr = new Map();
      for (const l of g.lines) byNr.set(l.nr, { nr: l.nr, kind: l.kind, text: l.text, mi: l.mi });
      for (const b of g.branches) { const e = byNr.get(b.nr) || { nr: b.nr, kind: 'branch', text: b.text }; e.br = b; byNr.set(b.nr, e); }
      for (const e of Array.from(byNr.values()).sort((a, b) => a.nr - b.nr).slice(0, 400)) {
        rows.push(h('tr', { class: 'unc-' + e.kind },
          td(srcInfo && g.sourceAvailable ? h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(srcInfo.snippetId, e.nr), text: String(e.nr) }) : String(e.nr), 'num'),
          td(chip(e.kind === 'missed' ? 'Not executed' : e.kind === 'partial' ? 'Partly executed' : 'Branches missed', e.kind === 'missed' ? 'chip-fail' : 'chip-review')),
          td(e.br ? e.br.cb + ' / ' + (e.br.mb + e.br.cb) : '—', 'num'),
          td(e.text ? h('code', { class: 'src-line', text: e.text }) : h('span', { class: 'muted small', text: g.sourceAvailable ? '' : 'paste the source to see this line' })),
          td(h('span', { class: 'mono small', text: g.methodOf(e.nr) }))));
      }
      const missed = JR.METRICS.map((t) => ({ t, c: g.counters[t] })).filter((x) => x.c && x.c.missed);
      return h('details', { class: 'unc-class', open: g.inScope || !scoped },
        h('summary', {},
          h('span', { class: 'mono', text: g.fqcn }),
          g.inScope ? chip('in scope', 'chip-soft') : scoped ? chip('outside scope', 'chip-muted') : null,
          g.classNotExecuted ? chip('never executed', 'chip-fail') : null,
          h('span', { class: 'small muted', text: missed.map((x) => plural(x.c.missed, COUNTER_WORD[x.t][0], COUNTER_WORD[x.t][1])).join(' · ') + ' missed' })),
        g.methods.length ? h('p', { class: 'small' }, h('strong', { text: 'Methods not fully executed: ' }), g.methods.slice(0, 20).map((m) => (m.name === '<init>' ? 'constructor' : m.name + '()') + (m.line ? ' L' + m.line : '') + ' (' + JR.pctText(m.instr.covered, m.instr.total) + ')').join(', ')) : null,
        g.alignment && !g.alignment.ok ? h('p', { class: 'small muted', text: 'The pasted source does not line up with the measured line numbers, so source text is not shown.' }) : null,
        rows.length ? table(['Line', 'Status', 'Branches covered', 'Source', 'Method'], rows, 'tbl-unc') : h('p', { class: 'small muted', text: 'No line-level data (e.g. JaCoCo CSV); see the method list above.' }));
    }));
}

/* ---------- 7. Evidence ---------- */

const EVIDENCE_HINT = {
  details: 'Fill in step 1.',
  tests: 'Paste each JUnit test class (Input type: JUnit Test Code).',
  source: 'Paste the changed production classes for method-level traceability.',
  jacoco: 'Paste the jacoco.xml produced by the same test run.',
  scope: 'Paste the git diff, or a list of changed files/classes.',
  scopeCoverage: 'Paste the JaCoCo report of the module containing the missing classes.',
  results: 'Paste the Surefire/Gradle XML results or the console summary.',
  declared: 'Optional. Shown for reference only.',
  integrity: 'Replace incomplete snippets with complete copies; remove outdated duplicates.',
};

function secEvidence(A) {
  const rows = A.evidenceItems.map((it) => h('tr', {},
    td(statusBadge(it.status)), td(h('strong', { text: it.label })), td(it.required ? 'Required' : 'Recommended'), td(it.detail), td(h('span', { class: 'small muted', text: it.status === JR.STATUS.PASS || it.status === JR.STATUS.NA ? '' : EVIDENCE_HINT[it.key] || '' }))));
  const ev = A.findings.filter((f) => f.category === 'Evidence' || f.category === 'Scope');
  const incomplete = A.snippets.filter((s) => s.incomplete);
  return h('div', {},
    table(['Status', 'Evidence', 'Need', 'What was supplied', 'To resolve'], rows, 'tbl-evidence'),
    incomplete.length ? h('div', { class: 'callout callout-review' }, h('p', { class: 'callout-title', text: 'Possibly incomplete pastes' }),
      h('ul', {}, incomplete.map((s) => h('li', {}, h('button', { type: 'button', class: 'ev-link', onclick: () => openViewer(s.id), text: 'Snippet #' + s.seq }), ' (' + s.label + '): ' + s.incompleteReasons.slice(0, 3).join(' '))))) : null,
    ev.length ? [h('h3', { text: 'Evidence and scope findings' }), findingList(ev)] : null);
}

/* ---------- 8. Conclusion ---------- */

function secConclusion(A) {
  const C = A.conclusion;
  return h('div', {},
    h('div', { class: 'verdict verdict-' + STATUS_CLASS[C.status] + ' verdict-wide' },
      h('div', { class: 'verdict-label', text: 'Final review conclusion' }),
      statusBadge(C.status, { large: true }),
      h('p', { class: 'verdict-text', text: C.headline })),
    table(['Component', 'Status', 'Basis'], C.components.map((c) => h('tr', {}, td(h('strong', { text: c.name })), td(statusBadge(c.status)), td(c.text)))),
    C.actions.length ? [h('h3', { text: 'Required and recommended actions' }), h('ol', { class: 'actions' }, C.actions.map((a) => h('li', {}, sevChip(a.severity), ' ', a.text)))] : null,
    h('h3', { text: 'Limitations of this review' }),
    h('ul', { class: 'limits' }, C.limitations.map((l) => h('li', { text: l }))),
    h('h3', { text: 'All findings' }),
    filteredFindings(A.findings, 'No findings.', { withCategory: true, key: 'all' }),
    h('div', { class: 'row end' }, button('Go to report', { class: 'btn btn-primary', onclick: () => switchTab('report') }, 'arrow')));
}
