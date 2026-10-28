/* ------------------------------------------------------------------------
 * Source-to-test traceability (static) and its reconciliation with JaCoCo
 * measurements when both are available. Every row says how a link was
 * found, so a reader can judge its strength.
 * --------------------------------------------------------------------- */

const TRACE = {
  TESTED: 'Apparently tested',
  API: 'Apparently tested via API',
  INDIRECT: 'Indirectly exercised',
  SETUP: 'Exercised in test setup',
  NAME: 'Possible (name match only)',
  MOCKED: 'Mocked only',
  NONE: 'No apparent test',
  NA: 'Not applicable',
};

const COMMON_METHOD_NAMES = new Set(['get', 'set', 'of', 'from', 'build', 'builder', 'equals', 'hashCode', 'toString', 'size', 'isEmpty', 'add', 'put', 'remove', 'apply', 'accept', 'test', 'run', 'call', 'execute', 'handle', 'process', 'create', 'update', 'delete', 'find', 'save', 'value', 'name', 'id', 'getId', 'getName', 'valueOf', 'values', 'map', 'filter']);

const BASIS_LABEL = {
  typed: 'direct call on a typed reference',
  static: 'static call',
  'static-import': 'static-imported call',
  chain: 'call on a returned object',
  ctor: 'constructor call',
  'method-ref': 'method reference',
  interface: 'call through interface',
  inherited: 'inherited method',
  api: 'API request matches endpoint',
  name: 'method name match in a linked test class',
  setup: 'instantiated by test setup',
  thrown: 'exception type expected by a test assertion',
};

function buildTraceability(prodClasses, prodIndex, testClasses, jac) {
  const refIndex = new Map();
  const addRef = (key, entry) => {
    if (!refIndex.has(key)) refIndex.set(key, []);
    refIndex.get(key).push(entry);
  };
  const allTests = [];
  for (const tc of testClasses) {
    for (const tm of tc.methods) {
      allTests.push({ tc, tm });
      for (const r of tm.refs) {
        addRef(r.cls + '#' + r.method, { tc, tm, ref: r });
        // Calls through an interface or superclass also reach implementations.
        const target = prodIndex.byFqcn.get(r.cls);
        if (target) {
          for (const impl of prodIndex.implementors.get(target.simpleName) || []) {
            addRef(impl.fqcn + '#' + r.method, { tc, tm, ref: Object.assign({}, r, { basis: 'interface', via: target.simpleName }) });
          }
          // Inherited: a call on a subclass reaches a method declared in a pasted parent.
          if (!target.methodsByName.has(r.method)) {
            for (const parentName of target.ext) {
              const parent = prodIndex.resolve(parentName);
              if (parent) addRef(parent.fqcn + '#' + r.method, { tc, tm, ref: Object.assign({}, r, { basis: 'inherited', via: target.simpleName }) });
            }
          }
        }
      }
    }
  }

  // Method names that occur in exactly one supplied production class.
  const nameOwners = new Map();
  for (const pc of prodClasses) for (const m of pc.methods) {
    if (m.ctor) continue;
    const prev = nameOwners.get(m.sourceName);
    nameOwners.set(m.sourceName, prev === undefined || prev === pc.fqcn ? pc.fqcn : null);
  }
  refIndex.uniqueNames = nameOwners;
  const rows = [];
  const classRows = [];
  for (const pc of prodClasses) {
    const linked = testClasses.filter((tc) => (tc.targetFqcns || []).includes(pc.fqcn) || tc.methods.some((m) => m.refs.some((r) => r.cls === pc.fqcn && !r.viaMock)));
    // Constructors run when Mockito (@InjectMocks), Spring (@Autowired, @WebMvcTest) or set-up code creates the object.
    const setupExercised = testClasses.filter((tc) => (tc.setupCtorRefs || []).includes(pc.fqcn) ||
      tc.fields.some((f) => (f.injectMocks || f.autowired) && prodIndex.resolve(f.type) === pc) ||
      ((tc.targetFqcns || []).includes(pc.fqcn) && tc.targets.some((t) => /^@(WebMvcTest|WebFluxTest)$/.test(t.basis) && prodIndex.resolve(t.name) === pc)));
    const jcls = jac ? jac.classFor(pc) : null;
    const align = jcls ? jac.alignment(pc, jcls) : null;
    const clsRow = {
      cls: pc, fqcn: pc.fqcn, linkedTests: linked.map((t) => t.fqcn), methods: [], jacocoClass: jcls, alignment: align,
      mockedOnly: false, counts: {},
    };
    for (const pm of pc.methods) {
      const row = traceMethod(pc, pm, refIndex, linked, setupExercised, allTests);
      if (jcls) {
        const jm = jac.methodFor(pc, pm, jcls, align);
        row.measured = jm ? jac.methodStatus(jm) : null;
        row.jacocoMethod = jm;
      }
      reconcileWithMeasurement(row);
      clsRow.methods.push(row);
      rows.push(row);
    }
    const real = clsRow.methods.filter((r) => r.status !== TRACE.NA);
    clsRow.mockedOnly = real.length > 0 && real.every((r) => r.status === TRACE.MOCKED || r.status === TRACE.NONE) && real.some((r) => r.status === TRACE.MOCKED);
    for (const k of Object.keys(TRACE)) clsRow.counts[k] = clsRow.methods.filter((r) => r.status === TRACE[k]).length;
    classRows.push(clsRow);
  }
  return { rows, classRows };
}

function argcFits(pm, argc) {
  if (argc == null || argc < 0) return true;
  if (pm.params.length === argc) return true;
  return pm.params.length && /\.\.\./.test(pm.signature) && argc >= pm.params.length - 1;
}

function traceMethod(pc, pm, refIndex, linked, setupExercised, allTests) {
  const row = {
    cls: pc.fqcn, clsSimple: pc.simpleName, method: pm, name: pm.name, display: pm.display, line: pm.line, endLine: pm.endLine,
    kind: pm.kind, visibility: pm.visibility, status: TRACE.NONE, basis: [], tests: [], gaps: [], measured: null,
    decisions: pm.decisions, complexity: pm.complexity, snippetId: pc.snippetId, snippetSeq: pc.snippetSeq, superseded: false,
  };
  if (pm.ctor && pm.visibility === 'private' && !pm.params.length && pm.endLine - pm.line <= 2 && !(refIndex.get(pc.fqcn + '#<init>') || []).length) {
    row.status = TRACE.NA;
    row.note = 'Private no-argument constructor that prevents instantiation; not callable and ignored by JaCoCo.';
    return row;
  }
  if (pm.isAbstract && !pm.hasBody) {
    const hits = (refIndex.get(pc.fqcn + '#' + pm.name) || []).filter((e) => e.ref.basis !== 'interface' && e.ref.basis !== 'inherited');
    const real = hits.filter((e) => !e.ref.viaMock);
    if (real.length) {
      // e.g. a Spring Data repository method exercised through its generated implementation in a @DataJpaTest
      row.status = TRACE.TESTED;
      row.tests = uniqTests(real);
      row.basis = uniq(real.map((e) => BASIS_LABEL[e.ref.basis] || e.ref.basis)).concat(['no body in source — runs through its runtime implementation']);
      return row;
    }
    row.status = hits.length ? TRACE.MOCKED : TRACE.NA;
    row.tests = uniqTests(hits);
    row.note = pc.isInterface ? 'Interface method — no implementation in this type.' : 'Abstract method — no implementation.';
    if (hits.length) row.basis = ['stubbed or verified on a mock — real code not executed'];
    return row;
  }
  const entries = (refIndex.get(pc.fqcn + '#' + pm.name) || []).filter((e) => argcFits(pm, e.ref.argc));
  const realEntries = entries.filter((e) => !e.ref.viaMock || e.ref.viaSpy);
  const mockEntries = entries.filter((e) => e.ref.viaMock && !e.ref.viaSpy);
  const apiEntries = [];
  if (pm.endpoints.length) {
    for (const t of allTests) {
      for (const rq of t.tm.requests) {
        if (rq.path == null) continue;
        if (pm.endpoints.some((ep) => (ep.method === 'ANY' || rq.method === 'ANY' || ep.method === rq.method) && pathsMatch(ep.path, rq.path))) {
          apiEntries.push({ tc: t.tc, tm: t.tm, ref: { basis: 'api', line: rq.line, request: rq.method + ' ' + rq.path } });
        }
      }
    }
  }
  if (realEntries.length || apiEntries.length) {
    row.status = realEntries.length ? TRACE.TESTED : TRACE.API;
    row.tests = uniqTests(realEntries.concat(apiEntries));
    row.basis = uniq(realEntries.concat(apiEntries).map((e) => BASIS_LABEL[e.ref.basis] || e.ref.basis));
  } else if (pm.kind === 'constructor' && setupExercised.length) {
    row.status = TRACE.SETUP;
    row.basis = ['instantiated by @InjectMocks / Spring / test setup'];
    row.tests = setupExercised.flatMap((tc) => tc.methods.filter((m) => !m.disabled).slice(0, 3).map((m) => ({ tc, tm: m, basis: 'setup' })));
  } else {
    const nameEntries = [];
    // Unlinked test classes (e.g. pasted fragments) count only when the method name is unique to this class.
    const uniqueName = !COMMON_METHOD_NAMES.has(pm.sourceName) && allTests.length && (refIndex.uniqueNames || new Map()).get(pm.sourceName) === pc.fqcn;
    const pool = uniqueName ? uniq(linked.concat(allTests.map((t) => t.tc))) : linked;
    for (const tc of pool) {
      for (const tm of tc.methods) {
        const u = tm.unresolved.filter((x) => x.method === pm.sourceName || x.method === pm.name);
        if (u.length) nameEntries.push({ tc, tm, ref: { basis: 'name', line: u[0].line, viaMock: u.every((x) => x.viaMock) } });
      }
    }
    const realName = nameEntries.filter((e) => !e.ref.viaMock);
    if (realName.length) {
      row.status = TRACE.NAME;
      row.tests = uniqTests(realName);
      row.basis = [BASIS_LABEL.name];
    } else if (mockEntries.length || nameEntries.length) {
      row.status = TRACE.MOCKED;
      row.tests = uniqTests(mockEntries.concat(nameEntries));
      row.basis = ['stubbed or verified on a mock — real code not executed'];
    }
  }
  return row;
}

function uniqTests(entries) {
  const seen = new Map();
  for (const e of entries) {
    const key = e.tc.fqcn + '#' + e.tm.name;
    if (!seen.has(key)) seen.set(key, { tc: e.tc, tm: e.tm, basis: e.ref ? e.ref.basis : e.basis, line: e.ref ? e.ref.line : 0, request: e.ref && e.ref.request });
  }
  return Array.from(seen.values());
}

// Static gaps per method; computed after the indirect pass so private helpers can inherit.
function computeTraceGaps(trace, prodIndex) {
  // Indirect: private/package helpers called from apparently-tested methods.
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    for (const cr of trace.classRows) {
      for (const r of cr.methods) {
        if (r.status !== TRACE.NONE && r.status !== TRACE.NAME) continue;
        const callers = (r.method.calledBy || []).map((n) => cr.methods.find((x) => x.method.sourceName === n || x.name === n)).filter(Boolean);
        const tested = callers.filter((c) => c.status === TRACE.TESTED || c.status === TRACE.API || c.status === TRACE.INDIRECT);
        if (tested.length) {
          r.status = TRACE.INDIRECT;
          r.basis = ['called by ' + tested.map((c) => c.method.sourceName + '()').join(', ')];
          r.tests = uniq(tested.flatMap((c) => c.tests)).slice(0, 12);
          changed = true;
        }
      }
    }
  }

  for (const cr of trace.classRows) {
    const pc = cr.cls;
    for (const r of cr.methods) {
      const pm = r.method;
      const tests = r.tests.filter((t) => !t.tm.disabled);
      const validating = tests.filter((t) => t.tm.validationCount > 0);
      const gaps = [];
      if (r.status === TRACE.NA) { r.gaps = gaps; continue; }
      if (r.status === TRACE.NONE) gaps.push({ kind: 'none', text: 'No test in the supplied evidence references this method.' });
      if (r.status === TRACE.MOCKED) gaps.push({ kind: 'mocked', text: 'Only appears as a mocked or stubbed call — its real implementation is not exercised by the supplied tests.' });
      if (r.status === TRACE.NAME) gaps.push({ kind: 'name', text: 'Linked only by method name in a related test class; the receiver type could not be confirmed.' });
      if (tests.length && !validating.length && r.status !== TRACE.SETUP) gaps.push({ kind: 'unvalidated', text: 'Related tests contain no assertions or verifications.' });
      const exercised = r.status === TRACE.TESTED || r.status === TRACE.API || r.status === TRACE.INDIRECT;
      if (exercised && pm.throwsTypes.length) {
        const hasNeg = tests.some((t) => t.tm.scenario.exception === 'code' || t.tm.scenario.negative === 'code');
        if (!hasNeg) gaps.push({ kind: 'exception', lines: pm.throwsTypes.map((x) => x.line), text: 'Throws ' + uniq(pm.throwsTypes.map((x) => x.type)).join(', ') + ' (line ' + uniq(pm.throwsTypes.map((x) => x.line)).join(', ') + ') — no related test asserts an exception or error outcome.' });
      }
      if (exercised && pm.nullChecks.length) {
        const hasNull = tests.some((t) => t.tm.scenario.nullEmpty === 'code');
        if (!hasNull) gaps.push({ kind: 'null', lines: pm.nullChecks.map((x) => x.line), text: 'Null/empty handling at line ' + uniq(pm.nullChecks.map((x) => x.line)).slice(0, 6).join(', ') + ' — no related test supplies a null or empty input.' });
      }
      if (exercised && pm.comparisons.length) {
        const nums = tests.flatMap((t) => t.tm.inputLiterals.numbers.map((n) => n.value));
        for (const cmp of pm.comparisons) {
          const v = cmp.value;
          const step = Number.isInteger(v) ? 1 : 0.01;
          const near = nums.some((n) => Math.abs(n - v) <= step + 1e-9);
          for (const t of tests) {
            const hit = t.tm.inputLiterals.numbers.find((n) => Math.abs(n.value - v) <= step + 1e-9);
            if (!hit) continue;
            t.tm.evidence.boundary.push('uses ' + hit.value + ' at the limit "' + truncate(cmp.text, 60) + '" (' + pc.simpleName + ' line ' + cmp.line + ')');
            t.tm.scenario.boundary = 'code';
          }
          if (!near) gaps.push({ kind: 'boundary', lines: [cmp.line], text: 'Boundary "' + truncate(cmp.text, 90) + '" (line ' + cmp.line + '): related tests do not use ' + v + ' or an adjacent value.' });
        }
      }
      if (exercised && pm.complexity >= 2 && tests.length < pm.complexity) {
        gaps.push({ kind: 'branches', text: 'Static estimate: ' + pm.complexity + ' execution paths (' + plural(pm.decisions.filter((d) => d.kind !== 'else').length, 'decision point') + ') but ' + plural(tests.length, 'related test') + '. Some branches may be unexercised — confirm with JaCoCo branch coverage.' });
      }
      if (pm.security.length) {
        const auth = tests.some((t) => t.tm.securityAuth || t.tm.scenario.security === 'code');
        const unauth = tests.some((t) => t.tm.securityUnauth);
        if (!unauth) gaps.push({ kind: 'security', text: 'Secured by ' + pm.security.join(', ') + ' — ' + (auth ? 'tests run as an authorised user but none checks that unauthorised access is rejected (401/403).' : 'no related test exercises authorised or unauthorised access.') });
      }
      for (const col of pm.collaborators.filter((c) => c.sideEffect)) {
        if (!exercised) break;
        const verified = tests.some((t) => t.tm.verifies.some((v) => (v.method === col.method || v.method === '*') && mockTypeMatches(t.tc, v.mockVar, col.type)) ||
          t.tm.assertions.some((a) => /captor|getValue\(\)|getAllValues\(\)/i.test(a.text)));
        if (!verified) gaps.push({ kind: 'interaction', lines: [col.line], text: 'Calls ' + col.field + '.' + col.method + '() at line ' + col.line + ' (side effect) — no related test verifies this interaction.' });
      }
      r.gaps = gaps;
      reconcileWithMeasurement(r);
    }
  }
}

function mockTypeMatches(tc, mockVar, type) {
  if (!mockVar) return true;
  const f = tc.fields.find((x) => x.name === mockVar);
  if (!f) return true; // local mock — accept on method name
  return !type || f.type === type || f.declaredType === type;
}

// When JaCoCo measured a method as fully executed, static "may be untested"
// gaps for it are superseded: the measurement is the stronger evidence.
function reconcileWithMeasurement(row) {
  const m = row.measured;
  if (!m || !row.gaps) return;
  const supersedable = new Set(['none', 'name', 'branches', 'exception', 'null', 'mocked']);
  if (m.state === 'covered') {
    for (const g of row.gaps) if (supersedable.has(g.kind)) g.superseded = 'JaCoCo shows this method fully executed (' + m.summary + ').';
    if (row.status === TRACE.NONE || row.status === TRACE.NAME || row.status === TRACE.MOCKED) row.executedPerJacoco = true;
  }
}
