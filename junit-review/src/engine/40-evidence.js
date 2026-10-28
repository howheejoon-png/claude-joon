/* ------------------------------------------------------------------------
 * Evidence readers: JaCoCo (XML / CSV), JUnit execution results (XML /
 * console text), change scope (git diff / name-status / lists / Excel rows),
 * and declared coverage summaries.
 * --------------------------------------------------------------------- */

/* ---------- JaCoCo XML ---------- */

function readCounters(el) {
  const out = {};
  for (const c of xmlKids(el, 'counter')) {
    const type = String(c.attrs.type || '').toUpperCase();
    if (!type) continue;
    out[type] = { missed: intAttr(c, 'missed'), covered: intAttr(c, 'covered') };
  }
  return out;
}

function parseJacocoXml(text) {
  const x = parseXml(text);
  const rep = {
    format: 'xml', name: '', sessions: [], groups: [], packages: [], classes: [], sourcefiles: [],
    totals: {}, computedTotals: {}, totalsSource: 'report', truncated: x.truncated, errors: x.errors,
    warnings: [], hasLineData: false, hasMethodData: false,
  };
  const root = x.root;
  if (!root) { rep.warnings.push('No XML elements were found.'); return rep; }
  if (root.name !== 'report') rep.warnings.push('The XML does not start with a JaCoCo <report> element; only the parts that could be recognised were read.');
  rep.name = root.attrs.name || '';

  function walkContainer(el, groups) {
    for (const c of el.children) {
      if (c.name === 'sessioninfo') rep.sessions.push({ id: c.attrs.id || '', start: Number(c.attrs.start) || 0, dump: Number(c.attrs.dump) || 0 });
      else if (c.name === 'group') {
        const g = { name: c.attrs.name || '', path: groups.concat([c.attrs.name || '']).join(' / '), counters: readCounters(c) };
        rep.groups.push(g);
        walkContainer(c, groups.concat([c.attrs.name || '']));
      } else if (c.name === 'package') readPackage(c, groups);
    }
  }
  function readPackage(p, groups) {
    const pkgSlash = p.attrs.name || '';
    const pkg = { name: pkgSlash, dotted: pkgSlash.replace(/\//g, '.'), group: groups.join(' / '), counters: readCounters(p), classes: [], sourcefiles: [] };
    for (const c of xmlKids(p, 'class')) {
      const binary = c.attrs.name || '';
      const cls = {
        binaryName: binary,
        fqcn: binary.replace(/\//g, '.').replace(/\$/g, '.'),
        outerBinary: binary.split('$')[0],
        simpleName: simpleNameOf(binary.split('$')[0]),
        innerPart: binary.indexOf('$') >= 0 ? binary.slice(binary.indexOf('$') + 1) : '',
        pkg: pkg.dotted,
        sourcefile: c.attrs.sourcefilename || '',
        group: pkg.group,
        counters: readCounters(c),
        methods: xmlKids(c, 'method').map((m) => ({
          name: m.attrs.name || '', desc: m.attrs.desc || '', line: intAttr(m, 'line') || null, counters: readCounters(m),
        })),
      };
      if (cls.methods.length) rep.hasMethodData = true;
      pkg.classes.push(cls);
      rep.classes.push(cls);
    }
    for (const s of xmlKids(p, 'sourcefile')) {
      const sf = {
        name: s.attrs.name || '', pkg: pkg.dotted, pkgSlash, group: pkg.group, counters: readCounters(s),
        lines: xmlKids(s, 'line').map((l) => ({ nr: intAttr(l, 'nr'), mi: intAttr(l, 'mi'), ci: intAttr(l, 'ci'), mb: intAttr(l, 'mb'), cb: intAttr(l, 'cb') })),
      };
      if (sf.lines.length) rep.hasLineData = true;
      pkg.sourcefiles.push(sf);
      rep.sourcefiles.push(sf);
    }
    rep.packages.push(pkg);
  }

  if (root.name === 'report') {
    walkContainer(root, []);
    rep.totals = readCounters(root);
  } else {
    walkContainer({ children: [root] }, []);
  }

  for (const c of rep.classes) addCounters(rep.computedTotals, c.counters);
  if (!Object.keys(rep.totals).length) {
    rep.totals = JSON.parse(JSON.stringify(rep.computedTotals));
    rep.totalsSource = 'computed';
  } else {
    for (const type of METRICS) {
      const a = rep.totals[type];
      const b = rep.computedTotals[type];
      if (!a && !b) continue;
      const am = a ? a.missed : 0, ac = a ? a.covered : 0, bm = b ? b.missed : 0, bc = b ? b.covered : 0;
      if (am !== bm || ac !== bc) {
        rep.warnings.push('Report-level ' + METRIC_LABEL[type] + ' totals (' + fmtInt(ac) + ' covered / ' + fmtInt(am) + ' missed) do not equal the sum of the class counters (' + fmtInt(bc) + ' covered / ' + fmtInt(bm) + ' missed). The report may have been edited or only partly pasted.');
      }
    }
  }
  if (x.truncated) rep.warnings.push('The JaCoCo XML appears to be cut off (' + (x.unclosed.length ? 'unclosed: <' + x.unclosed.slice(-3).join('>, <') + '>' : 'incomplete tag') + '). Figures cover only the classes that were pasted.');
  return rep;
}

/* ---------- JaCoCo CSV (or the same table copied out of Excel) ---------- */

function parseJacocoCsv(text) {
  const lines = normalizeNewlines(text).split('\n').filter((l) => l.trim());
  const rep = {
    format: 'csv', name: '', sessions: [], groups: [], packages: [], classes: [], sourcefiles: [],
    totals: {}, computedTotals: {}, totalsSource: 'computed', truncated: false, errors: [], warnings: [],
    hasLineData: false, hasMethodData: false,
  };
  if (!lines.length) return rep;
  const delim = lines[0].indexOf('\t') >= 0 ? '\t' : ',';
  const head = lines[0].split(delim).map((h) => h.trim().toUpperCase());
  const col = (n) => head.indexOf(n);
  const ci = { g: col('GROUP'), p: col('PACKAGE'), c: col('CLASS') };
  const pairs = ['INSTRUCTION', 'BRANCH', 'LINE', 'COMPLEXITY', 'METHOD'];
  const pkgs = new Map();
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(delim).map((c) => c.trim());
    if (cells.length < 3) continue;
    const pkgName = ci.p >= 0 ? cells[ci.p] : '';
    const clsName = ci.c >= 0 ? cells[ci.c] : '';
    if (!clsName) continue;
    const counters = {};
    for (const p of pairs) {
      const mi = col(p + '_MISSED');
      const co = col(p + '_COVERED');
      if (mi < 0 || co < 0) continue;
      const m = parseInt(cells[mi], 10) || 0;
      const c = parseInt(cells[co], 10) || 0;
      if (m + c > 0) counters[p] = { missed: m, covered: c };
    }
    if (counters.METHOD) counters.CLASS = counters.METHOD.covered > 0 ? { missed: 0, covered: 1 } : { missed: 1, covered: 0 };
    const outer = clsName.split('.')[0];
    const cls = {
      binaryName: (pkgName ? pkgName.replace(/\./g, '/') + '/' : '') + clsName.replace(/\./g, '$'),
      fqcn: (pkgName ? pkgName + '.' : '') + clsName,
      outerBinary: (pkgName ? pkgName.replace(/\./g, '/') + '/' : '') + outer,
      simpleName: outer,
      innerPart: clsName.indexOf('.') >= 0 ? clsName.slice(clsName.indexOf('.') + 1) : '',
      pkg: pkgName, sourcefile: outer + '.java', group: ci.g >= 0 ? cells[ci.g] : '', counters, methods: [],
    };
    if (!rep.name && cls.group) rep.name = cls.group;
    rep.classes.push(cls);
    if (!pkgs.has(pkgName)) pkgs.set(pkgName, { name: pkgName.replace(/\./g, '/'), dotted: pkgName, group: cls.group, counters: {}, classes: [], sourcefiles: [] });
    const pk = pkgs.get(pkgName);
    pk.classes.push(cls);
    addCounters(pk.counters, counters);
  }
  rep.packages = Array.from(pkgs.values());
  for (const c of rep.classes) addCounters(rep.computedTotals, c.counters);
  rep.totals = JSON.parse(JSON.stringify(rep.computedTotals));
  rep.warnings.push('JaCoCo CSV holds class-level counters only: no line numbers, so uncovered lines and changed-line coverage cannot be shown from it.');
  return rep;
}

/* ---------- JUnit / Surefire execution results ---------- */

function normaliseCaseName(name) {
  // Gradle nests display names: "Seasonal items > peakSeasonDoublesMinimum()" or
  // "rounds(int, int) > [1] 7, 12" — the method is the first segment that looks like one.
  for (const seg of String(name || '').split(/\s+>\s+/)) {
    const s = seg.trim();
    if (/^\[\d+\]/.test(s)) continue;            // "[1] 10, 100" — invocation label only
    const m = /^([\p{L}_$][\p{L}\p{N}_$]*)\s*(?:\(|\[|$)/u.exec(s);
    if (m) return m[1];
  }
  return '';
}

function parseJunitXml(text) {
  const x = parseXml(text);
  const out = { format: 'xml', suites: [], cases: [], truncated: x.truncated, errors: x.errors, warnings: [] };
  const root = x.root;
  if (!root) return out;
  const suites = root.name === 'testsuite' ? [root].concat(xmlDescendants(root, 'testsuite')) : xmlDescendants(root, 'testsuite');
  for (const s of suites) {
    const suite = {
      name: s.attrs.name || '', tests: intAttr(s, 'tests'), failures: intAttr(s, 'failures'), errors: intAttr(s, 'errors'),
      skipped: intAttr(s, 'skipped') + intAttr(s, 'disabled'), time: s.attrs.time || '', timestamp: s.attrs.timestamp || '',
      declared: s.attrs.tests != null,
    };
    out.suites.push(suite);
    for (const tc of xmlKids(s, 'testcase')) {
      let status = 'passed';
      let message = '';
      const fail = xmlKids(tc, 'failure')[0];
      const err = xmlKids(tc, 'error')[0];
      const skip = xmlKids(tc, 'skipped')[0];
      const flaky = xmlKids(tc, 'flakyFailure')[0] || xmlKids(tc, 'flakyError')[0];
      if (fail) { status = 'failed'; message = fail.attrs.message || fail.text; }
      else if (err) { status = 'error'; message = err.attrs.message || err.text; }
      else if (skip) { status = 'skipped'; message = skip.attrs.message || ''; }
      out.cases.push({
        classname: tc.attrs.classname || suite.name, name: tc.attrs.name || '', normName: normaliseCaseName(tc.attrs.name),
        status, flaky: !!flaky, message: truncate(oneLine(message), 300), time: tc.attrs.time || '', line: tc.line, suite: suite.name,
      });
    }
  }
  if (x.truncated) out.warnings.push('The results XML appears to be cut off; only the test cases that were pasted are counted.');
  return out;
}

function parseResultsText(text) {
  const out = { format: 'text', suites: [], cases: [], truncated: false, errors: [], warnings: [], overall: null };
  const lines = normalizeNewlines(text).split('\n');
  const seen = new Set();
  lines.forEach((raw, idx) => {
    const line = raw.replace(/^\s*\[(?:INFO|ERROR|WARNING|WARN)\]\s*/, '').trim();
    const lineNo = idx + 1;
    let m = /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/i.exec(line);
    if (m) {
      const inClass = /(?:-|--)\s*in\s+([\w.$]+)\s*$/.exec(line) || /\bin\s+([\w.$]+)\s*$/.exec(line);
      const rec = { tests: +m[1], failures: +m[2], errors: +m[3], skipped: +m[4], line: lineNo };
      if (inClass) out.suites.push(Object.assign({ name: inClass[1], declared: true }, rec));
      else out.overall = rec;
      return;
    }
    // Surefire, JUnit 4 style:  methodName(com.x.FooTest)  Time elapsed: ... <<< FAILURE!
    m = /^([\p{L}_$][\p{L}\p{N}_$]*)(?:\[[^\]]*\])?\(([\w.$]+)\)\s.*<<<\s*(FAILURE|ERROR)!/u.exec(line);
    if (m) { addCase(m[2], m[1], m[3] === 'ERROR' ? 'error' : 'failed', lineNo); return; }
    // Surefire, JUnit 5 style:  com.x.FooTest.methodName -- Time elapsed: ... <<< FAILURE!
    m = /^([\w.$]+)\.([\p{L}_$][\p{L}\p{N}_$]*)(?:\([^)]*\))?(?:\[[^\]]*\])?\s+(?:--\s+)?Time elapsed.*<<<\s*(FAILURE|ERROR)!/u.exec(line);
    if (m) { addCase(m[1], m[2], m[3] === 'ERROR' ? 'error' : 'failed', lineNo); return; }
    // Surefire "Failures:" summary block:  FooTest.methodName:42 expected ...
    m = /^([\w$]+(?:\.[\w$]+)*)\.([\p{L}_$][\p{L}\p{N}_$]*):(\d+)\s/u.exec(line);
    if (m && /^[A-Z]/.test(simpleNameOf(m[1]))) { addCase(m[1], m[2], 'failed', lineNo); return; }
    // Gradle:  com.x.FooTest > methodName() FAILED
    m = /^([\w.$]+)\s+>\s+(.+?)\s+(PASSED|FAILED|SKIPPED)\s*$/.exec(line);
    if (m) { addCase(m[1], m[2], m[3] === 'PASSED' ? 'passed' : m[3] === 'FAILED' ? 'failed' : 'skipped', lineNo); return; }
    // Gradle summary:  7 tests completed, 1 failed, 1 skipped
    m = /^(\d+) tests? completed(?:,\s*(\d+) failed)?(?:,\s*(\d+) skipped)?/.exec(line);
    if (m) out.overall = { tests: +m[1], failures: +(m[2] || 0), errors: 0, skipped: +(m[3] || 0), line: lineNo };
  });
  function addCase(cls, name, status, lineNo) {
    // Surefire repeats each failure in its summary block with the simple class name — count it once.
    const key = simpleNameOf(cls) + '#' + (normaliseCaseName(name) || name) + '#' + status;
    if (seen.has(key)) return;
    seen.add(key);
    out.cases.push({ classname: cls, name, normName: normaliseCaseName(name), status, message: '', time: '', line: lineNo, suite: cls, inferred: false });
  }
  return out;
}

/* ---------- Change scope ---------- */

const RE_FQCN = /^(?:[a-z_][\w]*\.)+[A-Z][\w$]*$/;
const RE_SIMPLE_CLASS = /^[A-Z][\w$]*$/;

function pathInfo(rawPath) {
  const path = String(rawPath).trim().replace(/\\/g, '/').replace(/^"|"$/g, '').replace(/^[ab]\//, '');
  const info = { path, isJava: /\.java$/i.test(path), isTest: false, isProduction: false, fqcn: '', simpleName: '', pkg: '', module: '', sourceRoot: '' };
  const roots = ['src/main/java/', 'src/test/java/', 'src/it/java/', 'src/integrationTest/java/', 'src/testFixtures/java/'];
  let rootIdx = -1;
  let root = '';
  for (const r of roots) {
    const k = path.indexOf(r);
    if (k >= 0 && (rootIdx < 0 || k < rootIdx)) { rootIdx = k; root = r; }
  }
  if (rootIdx >= 0) {
    info.sourceRoot = root;
    info.module = path.slice(0, rootIdx).replace(/\/$/, '');
    const rel = path.slice(rootIdx + root.length);
    if (info.isJava) {
      const dotted = rel.replace(/\.java$/i, '').replace(/\//g, '.');
      info.fqcn = dotted;
      info.simpleName = simpleNameOf(dotted);
      info.pkg = packageOf(dotted);
    }
    info.isTest = root !== 'src/main/java/';
  } else if (info.isJava) {
    const file = path.split('/').pop().replace(/\.java$/i, '');
    info.simpleName = file;
    const javaIdx = path.lastIndexOf('/java/');
    if (javaIdx >= 0) {
      const rel = path.slice(javaIdx + 6).replace(/\.java$/i, '').replace(/\//g, '.');
      info.fqcn = rel;
      info.pkg = packageOf(rel);
    }
    info.isTest = /\/test\//.test(path);
  }
  if (info.isJava && !info.isTest) info.isTest = /(Test|Tests|IT|ITCase|TestCase)$/.test(info.simpleName);
  info.isProduction = info.isJava && !info.isTest;
  return info;
}

function parseScope(text) {
  const src = normalizeNewlines(text);
  const out = { kinds: [], entries: [], warnings: [], deletedOnly: [] };
  const lines = src.split('\n');
  const byPath = new Map();
  const isDiff = /^diff --git /m.test(src) || (/^--- /m.test(src) && /^\+\+\+ /m.test(src)) || /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(src);

  function entryFor(path, change) {
    const info = pathInfo(path);
    const key = info.path;
    if (!byPath.has(key)) {
      const e = Object.assign(info, { change: change || '?', addedLines: [], removedLines: 0, hunks: 0, fromDiff: false, kind: 'file', line: 0 });
      byPath.set(key, e);
      out.entries.push(e);
    } else if (change && change !== '?') byPath.get(key).change = change;
    return byPath.get(key);
  }

  if (isDiff) {
    out.kinds.push('diff');
    let cur = null;
    let newLine = 0;
    let inHunk = false;
    let pendingOld = null;
    let pendingChange = 'M';
    lines.forEach((l, idx) => {
      let m;
      if ((m = /^diff --git a\/(.+?) b\/(.+)$/.exec(l))) {
        cur = entryFor(m[2], 'M'); cur.fromDiff = true; cur.line = idx + 1; inHunk = false; pendingChange = 'M'; return;
      }
      if (/^new file mode/.test(l)) { if (cur) cur.change = 'A'; pendingChange = 'A'; return; }
      if (/^deleted file mode/.test(l)) { if (cur) cur.change = 'D'; pendingChange = 'D'; return; }
      if (/^rename (from|to) /.test(l)) { if (cur) cur.change = 'R'; return; }
      // A "--- x" / "+++ y" pair is a file header; inside a hunk a lone "---" line is just a removal.
      if ((m = /^--- (?:a\/)?(.+?)\s*$/.exec(l)) && /^\+\+\+ /.test(lines[idx + 1] || '')) { pendingOld = m[1]; inHunk = false; return; }
      if ((m = /^\+\+\+ (?:b\/)?(.+?)\s*$/.exec(l)) && /^--- /.test(lines[idx - 1] || '')) {
        const p = m[1];
        if (p === '/dev/null') { cur = entryFor(pendingOld || '', 'D'); }
        else { cur = entryFor(p, pendingOld === '/dev/null' ? 'A' : (cur && cur.path === pathInfo(p).path ? cur.change : pendingChange)); }
        cur.fromDiff = true;
        if (!cur.line) cur.line = idx + 1;
        inHunk = false;
        return;
      }
      if ((m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l))) {
        if (!cur) { cur = entryFor('(unnamed file in diff)', 'M'); cur.fromDiff = true; }
        newLine = parseInt(m[3], 10);
        inHunk = true;
        cur.hunks++;
        return;
      }
      if (!inHunk || !cur) return;
      if (l.startsWith('+')) { cur.addedLines.push(newLine); newLine++; }
      else if (l.startsWith('-')) { cur.removedLines++; }
      else if (l.startsWith(' ') || l === '') { newLine++; }
      else if (l.startsWith('\\')) { /* \ No newline at end of file */ }
      else inHunk = false;
    });
    for (const e of out.entries) if (e.fromDiff && !e.addedLines.length && e.removedLines && e.change !== 'D') out.deletedOnly.push(e.path);
    return finishScope(out);
  }

  // Line-based: name-status, plain paths, FQCNs, class names, or Excel rows.
  const rows = lines.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  let header = null;
  if (rows.length && rows[0].indexOf('\t') >= 0 && /(file|path|class|module|change|status|type|name)/i.test(rows[0]) && !/\.java\b/i.test(rows[0])) {
    header = rows[0].split('\t').map((h) => h.trim().toLowerCase());
  }
  const pathCol = header ? header.findIndex((h) => /(path|file|class|name)/.test(h)) : -1;
  const changeCol = header ? header.findIndex((h) => /(change|status|action|type)/.test(h) && !/class/.test(h)) : -1;
  const moduleCol = header ? header.findIndex((h) => /module|component|project/.test(h)) : -1;
  if (header) out.kinds.push('table');

  (header ? rows.slice(1) : rows).forEach((row, idx) => {
    const lineNo = idx + 1 + (header ? 1 : 0);
    let cells = row.indexOf('\t') >= 0 ? row.split('\t').map((c) => c.trim()) : [row.trim()];
    let change = '?';
    let token = '';
    let moduleHint = '';
    if (header) {
      token = cells[pathCol >= 0 ? pathCol : 0] || '';
      if (changeCol >= 0) change = changeLetter(cells[changeCol]);
      if (moduleCol >= 0) moduleHint = cells[moduleCol] || '';
    } else {
      let s = cells.join(' ').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
      let m = /^([AMDRCTU])(\d{0,3})\s+(\S+)(?:\s+(\S+))?$/.exec(s);
      if (m && (/[/.]/.test(m[3]))) {
        change = m[1] === 'C' ? 'A' : m[1] === 'T' || m[1] === 'U' ? 'M' : m[1];
        token = m[4] && m[1] === 'R' ? m[4] : m[3];
        if (!out.kinds.includes('name-status')) out.kinds.push('name-status');
      } else if ((m = /^(added|new|modified|changed|updated|deleted|removed|renamed)\s*[:\-–]?\s+(\S+)/i.exec(s))) {
        change = changeLetter(m[1]); token = m[2];
      } else {
        // pick the first token that looks like a path, FQCN or class name
        // ("Foo#bar", "Foo::bar" and "Foo.java:42" name a member or line of the class Foo)
        const parts = s.split(/[\s,;|]+/).filter(Boolean).map(stripMember);
        token = parts.find((p) => /\.(java|xml|properties|ya?ml|sql|json|kt|gradle|txt|md)$/i.test(p) || p.indexOf('/') >= 0 || RE_FQCN.test(p) || RE_SIMPLE_CLASS.test(p)) || '';
        const restParts = parts.filter((p) => p !== token);
        if (restParts.length && restParts.length === parts.length - 1 && token && parts.length > 1 && RE_SIMPLE_CLASS.test(token) && parts.every((p) => RE_SIMPLE_CLASS.test(p) || RE_FQCN.test(p))) {
          // a comma/space separated list of class names on one line
          for (const p of parts) addClassToken(p, '?', lineNo, moduleHint);
          return;
        }
      }
    }
    if (!token) return;
    addClassToken(token, change, lineNo, moduleHint);
  });

  function addClassToken(token, change, lineNo, moduleHint) {
    token = stripMember(token.replace(/[,;]+$/, ''));
    let e;
    if (/[/\\]/.test(token) || /\.(java|xml|properties|ya?ml|sql|json|kt|gradle|txt|md)$/i.test(token)) {
      e = entryFor(token, change);
      if (!out.kinds.includes('files')) out.kinds.push('files');
    } else if (RE_FQCN.test(token) || RE_SIMPLE_CLASS.test(token)) {
      const key = 'class:' + token;
      if (!byPath.has(key)) {
        e = {
          path: '', isJava: true, isTest: /(Test|Tests|IT|ITCase|TestCase)$/.test(simpleNameOf(token)), isProduction: false,
          fqcn: RE_FQCN.test(token) ? token : '', simpleName: simpleNameOf(token), pkg: RE_FQCN.test(token) ? packageOf(token) : '',
          module: '', sourceRoot: '', change, addedLines: [], removedLines: 0, hunks: 0, fromDiff: false, kind: 'class', line: lineNo,
        };
        e.isProduction = !e.isTest;
        byPath.set(key, e);
        out.entries.push(e);
      } else e = byPath.get(key);
      if (!out.kinds.includes('classes')) out.kinds.push('classes');
    } else return;
    if (!e.line) e.line = lineNo;
    if (moduleHint && !e.module) e.module = moduleHint;
  }
  return finishScope(out);
}

// "Foo#bar", "Foo::bar" and "Foo.java:42" name a member or line of the class Foo.
function stripMember(token) {
  return token.replace(/(\.java):\d+.*$/i, '$1').replace(/(?:#|::).*$/, '');
}

function changeLetter(s) {
  const v = String(s || '').trim().toLowerCase();
  if (/^(a|add|added|new|create|created)$/.test(v)) return 'A';
  if (/^(d|del|delete|deleted|remove|removed)$/.test(v)) return 'D';
  if (/^(r|rename|renamed|moved?)/.test(v)) return 'R';
  if (/^(m|mod|modify|modified|change|changed|update|updated|edit|edited)$/.test(v)) return 'M';
  return '?';
}

function finishScope(out) {
  for (const e of out.entries) {
    e.addedLines = uniq(e.addedLines).sort((a, b) => a - b);
    if (!e.isJava && e.path) out.warnings.push('Non-Java change "' + e.path + '" cannot be measured by JaCoCo — review it separately.');
  }
  if (out.deletedOnly.length) out.warnings.push(plural(out.deletedOnly.length, 'file') + ' in the diff only removes lines; removed code has no coverage to measure.');
  return out;
}

/* ---------- Declared (non-verified) coverage summaries ---------- */

const SUMMARY_METRIC = [
  [/\binstr(?:uction)?s?\b/i, 'INSTRUCTION'],
  [/\bbranch(?:es)?\b|\bdecision/i, 'BRANCH'],
  [/\blines?\b|\bstatements?\b/i, 'LINE'],
  [/\bmethods?\b|\bfunctions?\b/i, 'METHOD'],
  [/\bclass(?:es)?\b/i, 'CLASS'],
  [/\bcomplexity\b|\bcxty\b/i, 'COMPLEXITY'],
  [/\boverall\b|\btotal\b|\bcoverage\b/i, 'OVERALL'],
];

function metricFromLabel(s) {
  for (const [re, m] of SUMMARY_METRIC) if (re.test(s)) return m;
  return null;
}

function parseSummary(text) {
  const src = normalizeNewlines(text);
  const lines = src.split('\n');
  const entries = [];
  const out = { entries, warnings: [], format: 'text' };

  // JaCoCo HTML table copied as text.
  const htmlHead = lines.findIndex((l) => /Missed\s+Instructions/i.test(l) && /Cov\./i.test(l));
  if (htmlHead >= 0) {
    out.format = 'jacoco-html-copy';
    for (let r = htmlHead + 1; r < lines.length; r++) {
      const l = lines[r];
      if (!l.trim()) continue;
      const ofs = Array.from(l.matchAll(/([\d,]+)\s+of\s+([\d,]+)/g));
      if (!ofs.length) continue;
      const label = l.split(/\t|\s{2,}/)[0].trim() || 'Total';
      const toInt = (s) => parseInt(String(s).replace(/,/g, ''), 10);
      const metricsInOrder = ['INSTRUCTION', 'BRANCH'];
      ofs.slice(0, 2).forEach((m, k) => {
        const missed = toInt(m[1]);
        const total = toInt(m[2]);
        entries.push({ scope: label, metric: metricsInOrder[k], covered: total - missed, total, percent: null, raw: l.trim(), line: r + 1 });
      });
      // After the two "x of y" groups: Missed Cxty, Cxty, Missed Lines, Lines, Missed Methods, Methods, Missed Classes, Classes
      const tail = l.slice(ofs[ofs.length - 1].index + ofs[ofs.length - 1][0].length).replace(/n\/a/gi, ' ');
      const nums = (tail.match(/\d[\d,]*%?/g) || []).filter((x) => !x.endsWith('%')).map(toInt);
      if (nums.length >= 8) {
        const [, , ml, tl, mm, tm, mc, tc] = nums.slice(-8);
        entries.push({ scope: label, metric: 'LINE', covered: tl - ml, total: tl, percent: null, raw: l.trim(), line: r + 1 });
        entries.push({ scope: label, metric: 'METHOD', covered: tm - mm, total: tm, percent: null, raw: l.trim(), line: r + 1 });
        entries.push({ scope: label, metric: 'CLASS', covered: tc - mc, total: tc, percent: null, raw: l.trim(), line: r + 1 });
      }
    }
    return finishSummary(out);
  }

  // Excel-style table(s): a tab-separated header row naming metric columns, followed by data rows.
  const used = new Set();
  let head = null;
  lines.forEach((row, idx) => {
    if (row.indexOf('\t') < 0) { head = null; return; }
    const cells = row.split('\t').map((c) => c.trim());
    const metricCols = cells.map((h) => (/%|cov|coverage|line|branch|instr|method|class/i.test(h) && !/^(class(\s*name)?|name|file|module|component)$/i.test(h) ? metricFromLabel(h) : null));
    if (metricCols.some(Boolean) && !cells.some((c) => /\d\s*%/.test(c))) {
      const nameCol = ['class', 'class name', 'name', 'file', 'component', 'module', 'package']
        .map((n) => cells.findIndex((h) => h.toLowerCase() === n)).find((i) => i >= 0);
      head = { metricCols, nameCol: nameCol != null ? nameCol : cells.findIndex((h, i) => !metricCols[i]) };
      used.add(idx);
      out.format = 'table';
      return;
    }
    if (!head) return;
    used.add(idx);
    const scope = head.nameCol >= 0 ? cells[head.nameCol] || 'Overall' : 'Overall';
    head.metricCols.forEach((metric, i) => {
      if (!metric) return;
      const parsed = parseValue(cells[i] || '');
      if (parsed) entries.push(Object.assign({ scope, metric, raw: row.trim(), line: idx + 1 }, parsed));
    });
  });

  // Free text: "Line coverage: 98.5%  Branch coverage: 100%", "Branches 45/50", "92% line coverage".
  const METRIC_WORD = '(instructions?|branch(?:es)?|decisions?|lines?|statements?|methods?|functions?|class(?:es)?|complexity|overall|total)';
  const VALUE = '(\\d{1,3}(?:\\.\\d+)?\\s*%|[\\d,]+\\s*(?:\\/|of|out of)\\s*[\\d,]+)';
  const forward = new RegExp('\\b' + METRIC_WORD + '\\s*(?:coverage|cov\\.?)?\\s*(?:is|was|=|:|-|–)?\\s*' + VALUE, 'gi');
  const backward = new RegExp(VALUE + '\\s*(?:of\\s+)?' + METRIC_WORD + '\\b', 'gi');
  lines.forEach((l, idx) => {
    if (used.has(idx) || !l.trim()) return;
    const scopeMatch = /^\s*([\w.$]+(?:Service|Controller|Impl|Util|Utils|Repository|Dao|Dto|Model|Entity|Mapper|Validator|Helper|Manager|Handler)\b)/.exec(l);
    const found = [];
    for (const re of [forward, backward]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(l))) {
        const word = re === forward ? m[1] : m[2];
        const value = re === forward ? m[2] : m[1];
        const metric = metricFromLabel(word);
        const parsed = parseValue(value);
        if (!metric || !parsed || found.some((f) => f.metric === metric)) continue;
        found.push(Object.assign({ scope: scopeMatch ? scopeMatch[1] : 'Overall', metric, raw: l.trim(), line: idx + 1 }, parsed));
      }
    }
    entries.push(...found);
  });
  return finishSummary(out);
}

function parseValue(s) {
  let m = /([\d,]+)\s*(?:\/|of|out of)\s*([\d,]+)/i.exec(s);
  if (m) {
    const a = parseInt(m[1].replace(/,/g, ''), 10);
    const b = parseInt(m[2].replace(/,/g, ''), 10);
    if (b > 0 && a <= b) return { covered: a, total: b, percent: null };
  }
  m = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(s);
  if (m) return { covered: null, total: null, percent: m[1] };
  return null;
}

function finishSummary(out) {
  for (const e of out.entries) {
    e.pct = e.total != null ? pctText(e.covered, e.total) : e.percent + '%';
    e.claims100 = e.total != null ? e.covered === e.total : Number(e.percent) >= 100;
  }
  return out;
}
