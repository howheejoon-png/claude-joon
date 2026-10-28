/* ------------------------------------------------------------------------
 * Measured coverage: merging JaCoCo evidence, matching it to classes and
 * source lines, and assessing it against the declared enhancement scope.
 * --------------------------------------------------------------------- */

function mergeJacoco(reports) {
  // reports: [{ rep, snippet }] — later snippets win on conflict.
  const classes = new Map();
  const sourcefiles = new Map();
  const groups = [];
  const conflicts = [];
  const warnings = [];
  const sessions = [];
  const names = [];
  let totals = {};
  let hasLineData = false;
  let hasMethodData = false;
  const formats = new Set();
  for (const { rep, snippet } of reports) {
    formats.add(rep.format);
    if (rep.name) names.push(rep.name);
    sessions.push(...rep.sessions);
    for (const g of rep.groups) groups.push(Object.assign({ snippetSeq: snippet.seq }, g));
    hasLineData = hasLineData || rep.hasLineData;
    hasMethodData = hasMethodData || rep.hasMethodData;
    for (const w of rep.warnings) warnings.push({ text: w, snippetId: snippet.id, snippetSeq: snippet.seq, csvOnly: rep.format === 'csv' && /class-level counters only/.test(w) });
    for (const c of rep.classes) {
      if (classes.has(c.binaryName)) {
        const prev = classes.get(c.binaryName);
        const same = METRICS.every((t) => JSON.stringify(prev.counters[t] || null) === JSON.stringify(c.counters[t] || null));
        if (!same) conflicts.push({ cls: c.binaryName, from: prev.snippetSeq, to: snippet.seq });
        // The XML carries method and line detail; never let a CSV copy of the same class replace it.
        if (prev.format === 'xml' && rep.format !== 'xml') continue;
      }
      classes.set(c.binaryName, Object.assign({ snippetId: snippet.id, snippetSeq: snippet.seq, format: rep.format }, c));
    }
    for (const s of rep.sourcefiles) sourcefiles.set(s.pkgSlash + '/' + s.name, Object.assign({ snippetId: snippet.id, snippetSeq: snippet.seq }, s));
  }
  // A CSV next to an XML report for the same classes adds nothing; drop its "no line data" note.
  const xmlPresent = reports.some((r) => r.rep.format === 'xml');
  for (let i = warnings.length - 1; i >= 0; i--) if (warnings[i].csvOnly && xmlPresent) warnings.splice(i, 1);
  if (reports.length === 1) totals = reports[0].rep.totals;
  else for (const c of classes.values()) addCounters(totals, c.counters);
  const byOuter = new Map();
  for (const c of classes.values()) {
    if (!byOuter.has(c.outerBinary)) byOuter.set(c.outerBinary, []);
    byOuter.get(c.outerBinary).push(c);
  }
  const bySimple = new Map();
  for (const c of classes.values()) {
    if (c.innerPart) continue;
    if (!bySimple.has(c.simpleName)) bySimple.set(c.simpleName, []);
    bySimple.get(c.simpleName).push(c);
  }
  return {
    present: reports.length > 0, count: reports.length, formats: Array.from(formats), names: uniq(names), sessions, groups,
    classes, sourcefiles, byOuter, bySimple, totals, conflicts, warnings, hasLineData, hasMethodData,
    totalsSource: reports.length === 1 ? reports[0].rep.totalsSource : 'combined',
  };
}

function makeJacocoLookup(J, prodIndex) {
  const lookup = {
    // Top-level JaCoCo class for a production class (nested classes use their own binary name).
    classFor(pc) {
      if (J.classes.has(pc.binaryName)) return J.classes.get(pc.binaryName);
      if (!pc.pkg) {
        const list = J.bySimple.get(pc.simpleName) || [];
        if (list.length === 1 && !pc.outer) return list[0];
      }
      return null;
    },
    // All JaCoCo classes belonging to an outer class (inner, anonymous, lambdas compiled separately).
    familyFor(binaryOuter) {
      return J.byOuter.get(binaryOuter) || [];
    },
    sourcefileFor(pkgDotted, fileName) {
      return J.sourcefiles.get(String(pkgDotted || '').replace(/\./g, '/') + '/' + fileName) || null;
    },
    // How well the pasted source's line numbers agree with the measured build.
    alignment(pc, jcls) {
      const explicitCtor = pc.methods.some((pm) => pm.ctor);
      // Compiler-generated members (default constructor, static init, lambdas) have no declaration to align with.
      const withLines = jcls.methods.filter((m) => m.line && m.name !== '<clinit>' && !/^lambda\$/.test(m.name) && !(m.name === '<init>' && !explicitCtor) && !/^(values|valueOf|\$values)$/.test(m.name));
      if (!withLines.length) return { ok: true, ratio: 1, checked: 0 };
      let hit = 0;
      for (const jm of withLines) {
        const cands = pc.methods.filter((pm) => pm.name === jm.name || (jm.name === '<init>' && pm.ctor));
        if (cands.some((pm) => jm.line >= pm.line && jm.line <= pm.endLine)) hit++;
      }
      const ratio = hit / withLines.length;
      return { ok: ratio >= 0.6, ratio, checked: withLines.length };
    },
    methodFor(pc, pm, jcls, align) {
      const name = pm.ctor ? '<init>' : pm.name;
      const cands = jcls.methods.filter((m) => m.name === name);
      if (!cands.length) return null;
      if (cands.length === 1) return cands[0];
      if (align && align.ok) {
        const inRange = cands.find((m) => m.line && m.line >= pm.line && m.line <= pm.endLine);
        if (inRange) return inRange;
      }
      const byArity = cands.filter((m) => descArity(m.desc) === pm.params.length);
      return byArity.length === 1 ? byArity[0] : null;
    },
    methodStatus(jm) {
      const ins = counterOf(jm.counters, 'INSTRUCTION');
      const br = counterOf(jm.counters, 'BRANCH');
      const ln = counterOf(jm.counters, 'LINE');
      let state = 'covered';
      if (ins.total && ins.covered === 0) state = 'not-covered';
      else if (ins.missed > 0 || br.missed > 0) state = 'partial';
      const summary = 'instructions ' + pctText(ins.covered, ins.total) + (br.total ? ', branches ' + br.covered + '/' + br.total : ', no branches') + (ln.total ? ', lines ' + ln.covered + '/' + ln.total : '');
      return { state, ins, br, ln, summary, line: jm.line };
    },
  };
  return lookup;
}

function descArity(desc) {
  const m = /^\(([^)]*)\)/.exec(desc || '');
  if (!m) return -1;
  let s = m[1];
  let n = 0;
  let i = 0;
  while (i < s.length) {
    while (s[i] === '[') i++;
    if (s[i] === 'L') { i = s.indexOf(';', i) + 1; if (i === 0) break; }
    else i++;
    n++;
  }
  return n;
}

/* Scope assessment. Distinguishes changed-code, affected-class and
 * affected-module coverage, and never stretches a subset into a whole. */
function assessScope(J, lookup, scopeEntries, prodIndex, review, testClasses) {
  const threshold = review.threshold;
  const gated = review.gatedMetrics;
  const out = {
    hasScope: scopeEntries.length > 0, entries: scopeEntries, productionEntries: [], testEntries: [], otherEntries: [],
    classes: [], missingFromJacoco: [], affected: null, changed: null, modules: [], moduleNote: '', unmatchedSource: [],
  };
  for (const e of scopeEntries) {
    if (!e.isJava) out.otherEntries.push(e);
    else if (e.isTest) out.testEntries.push(e);
    else if (e.change === 'D') out.otherEntries.push(e);
    else out.productionEntries.push(e);
  }

  // Resolve each in-scope production entry to JaCoCo classes.
  const seen = new Set();
  for (const e of out.productionEntries) {
    let binaryOuter = '';
    if (e.fqcn) binaryOuter = e.fqcn.replace(/\./g, '/');
    let family = binaryOuter ? lookup.familyFor(binaryOuter) : [];
    if (!family.length) {
      const list = (J.bySimple && J.bySimple.get(e.simpleName)) || [];
      if (list.length === 1 && (!e.pkg || list[0].pkg === e.pkg)) family = lookup.familyFor(list[0].outerBinary);
      else if (list.length > 1 && !e.fqcn) e.ambiguous = list.map((c) => c.fqcn);
    }
    const pc = prodIndex ? prodIndex.resolve(e.fqcn || e.simpleName) : null;
    const key = family.length ? family[0].outerBinary : 'missing:' + (e.fqcn || e.simpleName);
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = { entry: e, name: e.fqcn || e.simpleName, family, counters: {}, source: pc, tests: [] };
    for (const c of family) addCounters(rec.counters, c.counters);
    rec.metrics = METRICS.map((t) => metricRow(rec.counters, t, threshold));
    rec.tests = testClasses.filter((tc) => (tc.targetFqcns || []).includes(pc ? pc.fqcn : '') || (tc.targets || []).some((t) => t.name === e.simpleName));
    // JaCoCo lists only classes with executable code: an interface whose methods have no bodies never appears.
    rec.noCode = !!(pc && pc.isInterface && !pc.methods.some((m) => m.hasBody));
    if (!family.length && J.present && !rec.noCode) out.missingFromJacoco.push(rec);
    out.classes.push(rec);
  }

  if (out.classes.length && J.present) {
    const counters = {};
    for (const r of out.classes) addCounters(counters, r.counters);
    out.affected = {
      counters, metrics: METRICS.map((t) => metricRow(counters, t, threshold)), measuredClasses: out.classes.filter((r) => r.family.length).length,
      declaredClasses: out.classes.length,
    };
    out.affected.pass = gated.every((t) => { const m = out.affected.metrics.find((x) => x.type === t); return m.na || m.meets; });
  }

  // Changed-code coverage from diff line numbers + JaCoCo line data.
  const diffEntries = out.productionEntries.filter((e) => e.fromDiff && e.addedLines.length);
  if (diffEntries.length && J.present) {
    const ch = { files: [], lines: { total: 0, covered: 0, partial: 0, missed: 0 }, instr: { missed: 0, covered: 0 }, branch: { missed: 0, covered: 0 }, nonExecutable: 0, noLineData: [] };
    for (const e of diffEntries) {
      const fileName = e.path.split('/').pop();
      const sf = lookup.sourcefileFor(e.pkg, fileName);
      if (!sf || !sf.lines.length) { ch.noLineData.push(e.path); continue; }
      const byNr = new Map(sf.lines.map((l) => [l.nr, l]));
      const f = { path: e.path, sourcefile: sf, executable: [], uncovered: [], partial: [], branchMisses: [], nonExecutable: 0 };
      for (const nr of e.addedLines) {
        const l = byNr.get(nr);
        if (!l || l.mi + l.ci === 0) { f.nonExecutable++; continue; }
        f.executable.push(nr);
        ch.instr.missed += l.mi; ch.instr.covered += l.ci;
        ch.branch.missed += l.mb; ch.branch.covered += l.cb;
        if (l.ci === 0) f.uncovered.push(nr);
        else if (l.mi > 0) f.partial.push(nr);
        if (l.mb > 0) f.branchMisses.push({ nr, mb: l.mb, cb: l.cb });
      }
      ch.lines.total += f.executable.length;
      ch.lines.missed += f.uncovered.length;
      ch.lines.partial += f.partial.length;
      ch.lines.covered += f.executable.length - f.uncovered.length;
      ch.nonExecutable += f.nonExecutable;
      ch.files.push(f);
    }
    ch.metrics = [
      metricRow({ LINE: { missed: ch.lines.missed, covered: ch.lines.covered } }, 'LINE', threshold),
      metricRow({ BRANCH: { missed: ch.branch.missed, covered: ch.branch.covered } }, 'BRANCH', threshold),
      metricRow({ INSTRUCTION: { missed: ch.instr.missed, covered: ch.instr.covered } }, 'INSTRUCTION', threshold),
    ];
    ch.pass = ch.metrics.every((m) => m.na || m.meets) && (threshold < 100 || ch.lines.partial === 0);
    ch.assessable = ch.files.length > 0;
    out.changed = ch;
  }

  // Affected-module coverage: only from module-level totals JaCoCo itself reported.
  const modNames = uniq(scopeEntries.map((e) => e.module).filter(Boolean).concat(review.moduleName ? [review.moduleName] : []));
  for (const mod of modNames) {
    const leaf = mod.split('/').pop();
    const group = (J.groups || []).find((g) => g.name === mod || g.name === leaf);
    if (group) out.modules.push({ name: mod, source: 'JaCoCo group "' + group.name + '"', counters: group.counters, metrics: METRICS.map((t) => metricRow(group.counters, t, threshold)) });
    else if (J.names.length === 1 && (J.names[0] === mod || J.names[0] === leaf) && J.count === 1) out.modules.push({ name: mod, source: 'JaCoCo report "' + J.names[0] + '"', counters: J.totals, metrics: METRICS.map((t) => metricRow(J.totals, t, threshold)) });
    else out.modules.push({ name: mod, source: '', counters: null, metrics: null });
  }
  if (!modNames.length) out.moduleNote = 'No module was declared, so module-level coverage is not assessed.';
  return out;
}

/* Uncovered code from JaCoCo line data (or method/class counters for CSV). */
function collectUncovered(J, lookup, prodClasses, scopeAssessment) {
  const inScope = new Set();
  if (scopeAssessment && scopeAssessment.classes.length) for (const r of scopeAssessment.classes) for (const c of r.family) inScope.add(c.outerBinary);
  const groups = [];
  const srcByBinary = new Map(prodClasses.map((pc) => [pc.binaryName, pc]));
  const outerSeen = new Set();
  for (const c of J.classes.values()) {
    if (outerSeen.has(c.outerBinary)) continue;
    outerSeen.add(c.outerBinary);
    const family = lookup.familyFor(c.outerBinary);
    const counters = {};
    for (const f of family) addCounters(counters, f.counters);
    const totalMissed = METRICS.reduce((n, t) => n + counterOf(counters, t).missed, 0);
    if (!totalMissed) continue;
    const pkg = c.pkg;
    const fileName = c.sourcefile || c.simpleName + '.java';
    const sf = lookup.sourcefileFor(pkg, fileName);
    const pc = srcByBinary.get(c.outerBinary) || null;
    const align = pc && lookup.classFor(pc) ? lookup.alignment(pc, lookup.classFor(pc)) : null;
    const srcLines = pc && align && align.ok ? pc.lines : null;
    const g = {
      outerBinary: c.outerBinary, fqcn: c.outerBinary.replace(/\//g, '.'), simpleName: c.simpleName, inScope: inScope.has(c.outerBinary),
      counters, classNotExecuted: family.every((f) => counterOf(f.counters, 'CLASS').covered === 0 && counterOf(f.counters, 'CLASS').total > 0),
      methods: [], lines: [], branches: [], ranges: [], sourceAvailable: !!srcLines, sourceSnippetSeq: pc ? pc.snippetSeq : null,
      jacocoSnippetSeq: c.snippetSeq, sourcefile: fileName, alignment: align,
    };
    for (const f of family) {
      for (const m of f.methods) {
        const mc = counterOf(m.counters, 'METHOD');
        const ic = counterOf(m.counters, 'INSTRUCTION');
        if (mc.missed > 0 || (ic.total && ic.covered === 0)) g.methods.push({ cls: f.binaryName.split('/').pop(), name: m.name, desc: m.desc, line: m.line, instr: ic });
      }
    }
    if (sf) {
      for (const l of sf.lines) {
        if (l.ci === 0 && l.mi > 0) g.lines.push({ nr: l.nr, kind: 'missed', mi: l.mi, text: srcLines ? (srcLines[l.nr - 1] || '').trim() : '' });
        else if (l.mi > 0) g.lines.push({ nr: l.nr, kind: 'partial', mi: l.mi, ci: l.ci, text: srcLines ? (srcLines[l.nr - 1] || '').trim() : '' });
        if (l.mb > 0) g.branches.push({ nr: l.nr, mb: l.mb, cb: l.cb, text: srcLines ? (srcLines[l.nr - 1] || '').trim() : '' });
      }
      // Collapse consecutive missed lines into ranges.
      let cur = null;
      for (const l of g.lines.filter((x) => x.kind === 'missed')) {
        if (cur && l.nr <= cur.to + 2) { cur.to = l.nr; cur.count++; }
        else { cur = { from: l.nr, to: l.nr, count: 1 }; g.ranges.push(cur); }
      }
    }
    g.methodOf = (nr) => {
      let best = null;
      for (const f of family) for (const m of f.methods) if (m.line && m.line <= nr && (!best || m.line > best.line)) best = m;
      return best ? best.name : '';
    };
    groups.push(g);
  }
  groups.sort((a, b) => (b.inScope - a.inScope) || a.fqcn.localeCompare(b.fqcn));
  return groups;
}
