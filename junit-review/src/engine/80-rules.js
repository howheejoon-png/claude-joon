/* ------------------------------------------------------------------------
 * Review findings. Each rule is evidence-based and says whether the
 * observation is Definite (directly visible in the evidence) or Possible
 * (a heuristic that needs a human to confirm).
 * --------------------------------------------------------------------- */

const SEVERITY_RANK = { High: 3, Medium: 2, Low: 1, Info: 0 };
const COUNTER_NOUN = {
  INSTRUCTION: ['instruction', 'instructions'], BRANCH: ['branch', 'branches'], LINE: ['line', 'lines'],
  METHOD: ['method', 'methods'], CLASS: ['class', 'classes'], COMPLEXITY: ['complexity point', 'complexity points'],
};

function finding(rule, fields) {
  return Object.assign({
    rule, category: 'Test Quality', severity: 'Medium', certainty: 'Definite', status: STATUS.REVIEW,
    sourceClass: '', testClass: '', testMethod: '', observation: '', explanation: '', risk: '', action: '', evidence: [],
  }, fields);
}

function ev(seq, id, line, what) {
  return { snippetSeq: seq, snippetId: id, line: line || null, what: what || '' };
}

function testQualityFindings(A) {
  const out = [];
  const enabledTests = [];
  for (const tc of A.testClasses) {
    const tcName = tc.fqcn;
    const mainSource = (tc.targetFqcns || [])[0] || '';
    for (const tm of tc.methods) {
      const base = { testClass: tcName, testMethod: tm.name, sourceClass: mainSource };
      const at = (line, what) => [ev(tc.snippetSeq, tc.snippetId, line || tm.nameLine, what)];
      if (tm.disabled) {
        out.push(finding('DISABLED', Object.assign({}, base, {
          severity: 'Medium', observation: 'Test is disabled' + (tm.disabledReason ? ' ("' + truncate(tm.disabledReason, 80) + '")' : '') + '.',
          explanation: 'Disabled tests are skipped by the test runner, so they provide no evidence for this enhancement.',
          risk: 'Behaviour the test was written for is unverified; the test count overstates real coverage.',
          action: 'Re-enable and fix the test, or remove it and record why the scenario is out of scope.',
          evidence: at(tm.line, '@Disabled / @Ignore'),
        })));
        continue;
      }
      enabledTests.push({ tc, tm });
      // Non-runnable signatures
      const notRun = [];
      if (tm.framework === 'junit5') {
        if (tm.mods.includes('private')) notRun.push('private');
        if (tm.mods.includes('static')) notRun.push('static');
        if (tm.annotation !== '@TestFactory' && tm.returnType && tm.returnType !== 'void') notRun.push('returns ' + tm.returnType);
        if (tm.annotation === '@TestFactory' && tm.returnType === 'void') notRun.push('@TestFactory returning void');
      } else if (tm.framework === 'junit4') {
        if (!tm.mods.includes('public')) notRun.push('not public');
        if (tm.mods.includes('static')) notRun.push('static');
        if (tm.returnType && tm.returnType !== 'void') notRun.push('returns ' + tm.returnType);
      }
      if (notRun.length) {
        out.push(finding('NOT_RUNNABLE', Object.assign({}, base, {
          severity: 'High', observation: 'Test method signature prevents execution (' + notRun.join(', ') + ').',
          explanation: tm.framework === 'junit5'
            ? 'JUnit 5 does not run @Test methods that are private, static or return a value — they are silently skipped.'
            : 'JUnit 4 requires public, non-static, void test methods; otherwise the runner reports an initialisation error.',
          risk: 'The test appears in the source but never runs, so it contributes nothing to the evidence.',
          action: 'Make the method a non-private, non-static void method (public for JUnit 4).',
          evidence: at(tm.nameLine, 'method signature'),
        })));
      }
      if (tm.empty) {
        out.push(finding('EMPTY_TEST', Object.assign({}, base, {
          severity: 'High', observation: 'Test method body is empty.',
          explanation: 'An empty test always passes and checks nothing.',
          risk: 'False confidence: it is counted as a test but verifies no behaviour.',
          action: 'Implement the intended checks or delete the placeholder.',
          evidence: at(tm.nameLine, 'empty body'),
        })));
        continue;
      }
      const unknownHelpers = tm.helperCalls.filter((h) => !h.known);
      const helperChecks = tm.helperCalls.reduce((n, h) => n + h.asserts + h.verifies + h.expects, 0);
      const realAsserts = tm.assertions.filter((a) => a.kind !== 'incomplete');
      const validations = realAsserts.length + tm.verifies.length + tm.expects.filter((e) => !e.viaAssertion).length + helperChecks + (tm.expectedViaAnnotation ? 1 : 0);
      if (validations === 0) {
        const possible = unknownHelpers.length > 0;
        out.push(finding('NO_ASSERTION', Object.assign({}, base, {
          severity: 'High', certainty: possible ? 'Possible' : 'Definite',
          observation: possible
            ? 'No assertions found in the test itself; it calls ' + unknownHelpers.map((h) => h.name + '()').join(', ') + ', which may perform checks but was not supplied.'
            : 'No assertions, Mockito verifications or response expectations found.',
          explanation: 'Without assertions the test passes whenever no exception is thrown. It executes code (and so raises coverage) without checking the outcome.',
          risk: 'Incorrect results would not be detected; coverage figures overstate how well the behaviour is tested.',
          action: possible ? 'Supply the helper method, or add explicit assertions in the test.' : 'Assert the expected result or state, or verify the expected interactions.',
          evidence: at(tm.nameLine, 'test body'),
        })));
      }
      for (const a of tm.assertions.filter((x) => x.kind === 'incomplete')) {
        out.push(finding('INCOMPLETE_ASSERTION', Object.assign({}, base, {
          severity: 'High', observation: 'assertThat(…) at line ' + a.line + ' has no condition chained to it.',
          explanation: 'A fluent assertThat(x) with nothing after it (e.g. .isEqualTo(…)) asserts nothing.',
          risk: 'The check the author intended is not performed.',
          action: 'Complete the assertion with the expected condition.',
          evidence: at(a.line, a.text),
        })));
      }
      for (const a of tm.assertions.filter((x) => x.tautology)) {
        out.push(finding('TAUTOLOGY', Object.assign({}, base, {
          severity: 'High', observation: 'Assertion can never fail: ' + a.tautology + ' (line ' + a.line + ').',
          explanation: 'The assertion compares constants or an expression with itself, so its outcome does not depend on the code under test.',
          risk: 'It reads like a check but provides no protection.',
          action: 'Assert on the actual result produced by the code under test.',
          evidence: at(a.line, a.text),
        })));
      }
      if (validations > 0 && realAsserts.length && !tm.verifies.length && !tm.expects.some((e) => !e.viaAssertion) && !helperChecks && !tm.expectedViaAnnotation &&
          realAsserts.every((a) => a.kind === 'notNull' || a.kind === 'noThrow') && !tm.assertions.some((a) => a.tautology)) {
        const kinds = uniq(realAsserts.map((a) => (a.kind === 'notNull' ? 'not-null' : 'does-not-throw')));
        out.push(finding('WEAK_ASSERTION', Object.assign({}, base, {
          severity: 'Medium', observation: 'Only ' + kinds.join(' and ') + ' checks (' + realAsserts.map((a) => 'line ' + a.line).join(', ') + ').',
          explanation: 'Checking that a result exists, or that no exception occurs, does not confirm the result is correct.',
          risk: 'Wrong values (e.g. an incorrect amount or status) would still pass.',
          action: 'Add assertions on the specific expected values or state.',
          evidence: at(realAsserts[0].line, realAsserts[0].text),
        })));
      }
      if (tm.statusOnly) {
        const st = tm.expects.filter((e) => e.kind === 'status');
        const noBodyExpected = st.every((e) => /isNoContent|204|NO_CONTENT/.test(e.status + e.text)) || tm.requests.every((r) => r.method === 'DELETE' || r.method === 'HEAD');
        const errorOnly = st.every((e) => e.error);
        out.push(finding('STATUS_ONLY', Object.assign({}, base, {
          category: 'Test Quality', severity: noBodyExpected ? 'Low' : errorOnly ? 'Low' : 'Medium',
          observation: 'API test checks only the HTTP status (' + st.map((e) => truncate(e.text, 50)).join('; ') + ') for ' + tm.requests.map((r) => r.method + ' ' + (r.path || '?')).join(', ') + '.',
          explanation: noBodyExpected
            ? 'A status-only check is reasonable when no body is returned, but the side effect (e.g. the service call) is not confirmed.'
            : errorOnly
              ? 'The error status is checked, but not the error payload or that the operation was blocked.'
              : 'The response body, headers and service interaction are not validated, so an incorrect payload with the right status would pass.',
          risk: noBodyExpected ? 'The operation could silently do nothing.' : 'Incorrect response content would not be detected.',
          action: noBodyExpected ? 'Verify the expected service interaction (e.g. verify(service).delete(id)).' : 'Add jsonPath/content assertions for the key response fields, or verify the service call.',
          evidence: at(st[0] ? st[0].line : tm.nameLine, st[0] ? st[0].text : ''),
        })));
      }
      if (tm.requests.length && !tm.expects.some((e) => !e.viaAssertion) && !tm.assertions.some((a) => a.http) && validations > 0 && !tm.statusOnly) {
        out.push(finding('RESPONSE_NOT_VALIDATED', Object.assign({}, base, {
          severity: 'Medium', certainty: 'Possible',
          observation: 'Performs ' + tm.requests.map((r) => r.method + ' ' + (r.path || '?')).join(', ') + ' but no expectation on the HTTP response was found.',
          explanation: 'The test checks other things (e.g. a service call) but not the status or body returned to the client.',
          risk: 'A wrong status code or response payload would not be detected.',
          action: 'Add andExpect(status()…) and response content checks.',
          evidence: at(tm.requests[0].line, 'request'),
        })));
      }
      for (const tr of tm.tries.filter((x) => x.swallows)) {
        const c = tr.catches[0];
        out.push(finding('SWALLOWED_EXCEPTION', Object.assign({}, base, {
          severity: 'High',
          observation: 'try/catch at line ' + tr.line + ' catches ' + (c.types.join(' | ') || 'an exception') + (c.asserts ? ' and checks it' : '') + ', but there is no fail() after the call in the try block.',
          explanation: 'If the exception is not thrown, execution skips the catch block and the test passes anyway.',
          risk: 'A missing validation or error path would go unnoticed.',
          action: 'Use assertThrows(…) / assertThatThrownBy(…), or add fail() as the last statement in the try block.',
          evidence: at(tr.line, 'try/catch'),
        })));
      }
      for (const b of tm.broadExceptions) {
        out.push(finding('BROAD_EXCEPTION', Object.assign({}, base, {
          severity: 'Low', observation: 'Expects the generic ' + b.type + ' (' + b.via + ', line ' + b.line + ').',
          explanation: 'Any failure — including an unrelated NullPointerException — satisfies this check.',
          risk: 'The test can pass for the wrong reason.',
          action: 'Expect the specific exception type and, ideally, its message.',
          evidence: at(b.line, b.via),
        })));
      }
      for (const s of tm.sleeps) {
        out.push(finding('SLEEP', Object.assign({}, base, {
          severity: 'Low', observation: 'Uses ' + truncate(s.text, 60) + ' (line ' + s.line + ').',
          explanation: 'Fixed sleeps make tests slow and timing-dependent.',
          risk: 'Intermittent failures (flaky tests) and longer build times.',
          action: 'Use a controllable clock, Awaitility, or synchronous test doubles.',
          evidence: at(s.line, s.text),
        })));
      }
    }
    // Mixed JUnit 4 / 5
    if (tc.lifecycleMismatch) {
      out.push(finding('MIXED_JUNIT', {
        testClass: tc.fqcn, severity: 'High', certainty: 'Possible',
        observation: tc.lifecycleMismatch,
        explanation: 'JUnit 4 and JUnit 5 annotations are processed by different engines. Lifecycle methods or extensions from one are ignored by the other, and JUnit 4 tests do not run at all without the vintage engine.',
        risk: 'Set-up may not run (causing misleading failures) or tests may be silently skipped.',
        action: 'Use one JUnit generation consistently in the class (prefer org.junit.jupiter.api.*).',
        evidence: [ev(tc.snippetSeq, tc.snippetId, tc.line, 'imports and annotations')],
      }));
    }
    for (const c of tc.commentedTests) {
      out.push(finding('COMMENTED_TEST', {
        testClass: tc.fqcn, severity: 'Low', observation: 'Commented-out test code at line ' + c.line + '.',
        explanation: 'A test that has been commented out does not run.', risk: 'A scenario may have been dropped without review.',
        action: 'Restore the test or delete it and record why.', evidence: [ev(tc.snippetSeq, tc.snippetId, c.line, c.text)],
      }));
    }
    // Mocks never stubbed or verified
    const used = new Set();
    for (const tm of tc.methods) {
      for (const s of tm.stubs) used.add(s.mockVar);
      for (const v of tm.verifies) used.add(v.mockVar);
    }
    for (const s of tc.stubsInSetup) used.add(s.mockVar);
    for (const mk of tc.mocks) {
      if (!used.has(mk.name) && tc.methods.length) {
        out.push(finding('UNUSED_MOCK', {
          testClass: tc.fqcn, severity: 'Info', certainty: 'Possible', observation: 'Mock "' + mk.name + '" (' + mk.type + ') is never stubbed or verified.',
          explanation: 'Interactions with this collaborator are not checked by any test in the class.',
          risk: 'Calls to it (or missing calls) would not be detected.',
          action: 'Verify the expected interaction, or remove the mock if it is not needed.',
          evidence: [ev(tc.snippetSeq, tc.snippetId, mk.line, 'mock field')],
        }));
      }
    }
  }

  // Duplicates and near-duplicates across all collected tests
  const byBody = new Map();
  const byShape = new Map();
  for (const t of enabledTests) {
    if (t.tm.empty || (t.tm.bodyTokens || 0) < 6) continue;
    if (!byBody.has(t.tm.bodyHash)) byBody.set(t.tm.bodyHash, []);
    byBody.get(t.tm.bodyHash).push(t);
    if (!t.tm.parameterized && t.tm.literalCount > 0) {
      if (!byShape.has(t.tm.shapeHash)) byShape.set(t.tm.shapeHash, []);
      byShape.get(t.tm.shapeHash).push(t);
    }
  }
  const dupHashes = new Set();
  for (const [hash, list] of byBody) {
    if (list.length < 2) continue;
    dupHashes.add(hash);
    const [first, ...rest] = list;
    for (const t of rest) {
      out.push(finding('DUPLICATE_TEST', {
        testClass: t.tc.fqcn, testMethod: t.tm.name, severity: 'Medium',
        observation: 'Test body is identical to ' + first.tc.simpleName + '.' + first.tm.name + '().',
        explanation: 'Two tests with the same code check the same thing; one of them was probably meant to cover a different scenario.',
        risk: 'Inflated test count; the intended second scenario may be untested.',
        action: 'Change the duplicate to test the scenario its name describes, or remove it.',
        evidence: [ev(t.tc.snippetSeq, t.tc.snippetId, t.tm.nameLine, 'duplicate'), ev(first.tc.snippetSeq, first.tc.snippetId, first.tm.nameLine, 'original')],
      }));
    }
  }
  for (const [, list] of byShape) {
    const distinct = list.filter((t) => !dupHashes.has(t.tm.bodyHash) || list.filter((x) => x.tm.bodyHash === t.tm.bodyHash)[0] === t);
    if (distinct.length < 3) continue;
    out.push(finding('SIMILAR_TESTS', {
      testClass: distinct[0].tc.fqcn, testMethod: distinct.map((t) => t.tm.name).join(', '), severity: 'Info', certainty: 'Possible',
      observation: plural(distinct.length, 'test') + ' share the same structure and differ only in literal values.',
      explanation: 'This is not a defect, but a @ParameterizedTest would make the input cases explicit and easier to extend.',
      risk: 'Low — maintainability only.', action: 'Consider consolidating into a parameterized test.',
      evidence: distinct.slice(0, 4).map((t) => ev(t.tc.snippetSeq, t.tc.snippetId, t.tm.nameLine, t.tm.name)),
    }));
  }
  return out;
}

/* Scenario-level observations per test class (code evidence only). */
function scenarioFindings(A, traceByClass) {
  const out = [];
  for (const tc of A.testClasses) {
    const tests = tc.methods.filter((m) => !m.disabled);
    if (!tests.length) continue;
    const has = (tag) => tests.some((m) => m.scenario[tag] === 'code');
    const nameOnly = (tag) => tests.filter((m) => m.scenario[tag] === 'name').map((m) => m.name);
    const targets = (tc.targetFqcns || []).map((f) => A.prodIndex.byFqcn.get(f)).filter(Boolean);
    const throwing = targets.flatMap((pc) => pc.methods.filter((m) => m.throwsTypes.length && !(m.ctor && m.visibility === 'private')).map((m) => pc.simpleName + '.' + m.sourceName + '()'));
    const at = [ev(tc.snippetSeq, tc.snippetId, tc.line, 'test class')];
    if (!has('negative')) {
      const hint = nameOnly('negative');
      out.push(finding('NO_ERROR_SCENARIO', {
        testClass: tc.fqcn, sourceClass: targets.map((t) => t.fqcn).join(', '), certainty: 'Possible',
        severity: throwing.length ? 'High' : targets.length && !targets.some((pc) => pc.methods.some((m) => m.nullChecks.length || m.decisions.some((d) => d.kind === 'catch'))) ? 'Info' : 'Medium',
        observation: 'No error-path test identified by code evidence in ' + plural(tests.length, 'test') + (throwing.length ? '; the source shows exceptions thrown by ' + uniq(throwing).slice(0, 4).join(', ') : '') + '.',
        explanation: 'No test asserts an exception, expects an error status, checks that invalid input is rejected, or stubs a collaborator failure.' + (hint.length ? ' ' + hint.slice(0, 3).join(', ') + ' suggest(s) a negative case by name, but no error assertion was found in the code.' : '') + ' This is judged from code, not test names.' +
          (targets.length && !throwing.length ? ' The supplied source for ' + targets.map((t) => t.simpleName).join(', ') + ' throws no exceptions, so error paths may not exist.' : ''),
        risk: 'Invalid input or failure handling may be untested.',
        action: 'Confirm whether error handling is in scope; if so, add tests that assert the expected exception or error response.',
        evidence: at,
      }));
    }
    const sourceComparisons = targets.some((pc) => pc.methods.some((m) => m.comparisons.length));
    const sourceNulls = targets.some((pc) => pc.methods.some((m) => m.nullChecks.length || m.validationAnns.length));
    if (!has('boundary') && !sourceComparisons) {
      out.push(finding('NO_BOUNDARY_INPUT', {
        testClass: tc.fqcn, severity: 'Info', certainty: 'Possible',
        observation: 'No boundary-value inputs identified (e.g. 0, negative numbers, MIN/MAX values, limit ± 1).',
        explanation: sourceComparisons ? 'The production source contains numeric comparisons (see traceability gaps), but the tests do not use values at those limits.' : 'Boundary relevance cannot be judged without production source; this is noted for completeness.',
        risk: 'Off-by-one errors at limits would not be detected.',
        action: sourceComparisons ? 'Add tests at, just below and just above each limit.' : 'Supply the production source to assess, or confirm boundaries are not applicable.',
        evidence: at,
      }));
    }
    if (!has('nullEmpty') && !sourceNulls) {
      out.push(finding('NO_NULL_EMPTY_INPUT', {
        testClass: tc.fqcn, severity: 'Info', certainty: 'Possible',
        observation: 'No test supplies a null, empty or blank input.',
        explanation: sourceNulls ? 'The production source has null/empty checks or validation annotations that no test exercises.' : 'Null/empty relevance cannot be judged without production source; this is noted for completeness.',
        risk: 'Missing-data handling (e.g. NullPointerException instead of a validation error) may be untested.',
        action: sourceNulls ? 'Add tests for null and empty inputs on the validated parameters.' : 'Supply the production source to assess, or confirm not applicable.',
        evidence: at,
      }));
    }
    const isApi = tc.styles.includes('Controller / API');
    if (isApi) {
      const auth = tests.some((m) => m.securityAuth);
      const unauth = tests.some((m) => m.securityUnauth);
      const securedSource = targets.some((pc) => pc.classSecurity.length || pc.methods.some((m) => m.security.length));
      if ((auth || securedSource) && !unauth) {
        out.push(finding('NO_ACCESS_DENIED_TEST', {
          testClass: tc.fqcn, sourceClass: targets.map((t) => t.fqcn).join(', '), severity: 'Medium', certainty: 'Possible',
          observation: (securedSource ? 'The controller source has security annotations' : 'Tests authenticate requests') + ', but no test checks that unauthenticated or unauthorised requests are rejected (401/403).',
          explanation: 'Security evidence was found, so access-control behaviour appears relevant to this class.',
          risk: 'An endpoint could be reachable without the required role and no test would fail.',
          action: 'Add tests for anonymous and insufficient-role requests expecting 401/403.',
          evidence: at,
        }));
      }
    }
  }
  return out;
}

function traceFindings(A) {
  const out = [];
  if (!A.trace) return out;
  for (const cr of A.trace.classRows) {
    const pc = cr.cls;
    const at = (line, what) => [ev(pc.snippetSeq, pc.snippetId, line, what)];
    if (cr.mockedOnly && !A.jacocoSays(pc, 'covered')) {
      out.push(finding('MOCKED_ONLY', {
        category: 'Traceability', sourceClass: pc.fqcn, severity: pc.isInterface ? 'Low' : 'Medium', certainty: 'Possible',
        observation: pc.simpleName + ' is only mocked in the supplied tests; its own implementation is not exercised.',
        explanation: 'Stubbing a class replaces its behaviour, so tests of its callers do not test it.',
        risk: pc.isInterface ? 'Custom query or default methods may be untested.' : 'Logic in this class is untested by the supplied evidence.',
        action: 'Supply or add tests for ' + pc.simpleName + ' itself' + (/Repository|Dao/.test(pc.simpleName) ? ' (e.g. a @DataJpaTest).' : '.'),
        evidence: at(pc.line, 'class declaration'),
      }));
    }
    for (const r of cr.methods) {
      const m = r.method;
      for (const g of r.gaps) {
        if (g.superseded) continue;
        if (g.kind === 'mocked' && cr.mockedOnly) continue;
        let sev = g.kind === 'none'
          ? (m.kind === 'logic' && m.visibility !== 'private' ? 'High' : 'Low')
          : g.kind === 'branches' || g.kind === 'name' ? 'Low' : 'Medium';
        let scopeNote = '';
        if (r.inScope === false) { sev = sev === 'Info' ? 'Info' : 'Low'; scopeNote = ' (class is outside the declared change scope)'; }
        else if (r.changed === false) { sev = sev === 'Info' ? 'Info' : 'Low'; scopeNote = ' (method has no changed lines in the supplied diff)'; }
        else if (r.changed === true) scopeNote = ' (method contains changed line' + (r.changedLines.length > 1 ? 's ' : ' ') + compactRanges(r.changedLines) + ')';
        const rule = { none: 'NO_APPARENT_TEST', mocked: 'MOCKED_ONLY', name: 'NAME_MATCH_ONLY', unvalidated: 'UNVALIDATED_TESTS', exception: 'EXCEPTION_PATH_GAP', null: 'NULL_PATH_GAP', boundary: 'BOUNDARY_GAP', branches: 'BRANCH_GAP', security: 'SECURITY_GAP', interaction: 'UNVERIFIED_INTERACTION' }[g.kind];
        const texts = {
          none: ['Methods without an apparent test may be covered indirectly; JaCoCo is needed to confirm.', 'Logic in this method may be untested.', 'Add or supply a test that calls ' + m.sourceName + '() and checks its result.'],
          mocked: ['Every reference is a stub or verification on a mock.', 'Its real behaviour is untested by these tests.', 'Add a test that exercises the real implementation.'],
          name: ['The call could not be tied to a typed receiver, so the link is uncertain.', 'The method may not actually be exercised.', 'Confirm with JaCoCo method coverage or a direct test.'],
          unvalidated: ['Tests call the method but do not check results.', 'Defects in its output would not be detected.', 'Add assertions to the related tests.'],
          exception: ['Error handling exists in the source but no related test checks it.', 'Failures may not be handled as designed.', 'Add tests asserting the expected exception or error response.'],
          null: ['Null/empty handling exists in the source but no related test triggers it.', 'Missing-data handling may be wrong.', 'Add tests with null and empty inputs.'],
          boundary: ['A numeric limit exists in the source but tests do not probe it.', 'Off-by-one defects at the limit would pass.', 'Add tests at the limit and either side of it.'],
          branches: ['This is a static estimate, not a measurement.', 'Some branches may be unexercised.', 'Check JaCoCo branch coverage for this method.'],
          security: ['Access control is declared on the method.', 'Unauthorised access may not be prevented.', 'Add tests for authorised and unauthorised callers.'],
          interaction: ['The method performs a side effect that no related test verifies.', 'The side effect could be missing or wrong without any test failing.', 'Verify the interaction (verify(mock).method(…)) or assert its effect.'],
        }[g.kind];
        out.push(finding(rule, {
          category: 'Traceability', sourceClass: pc.fqcn, testMethod: r.tests.slice(0, 3).map((t) => t.tc.simpleName + '.' + t.tm.name).join(', '),
          testClass: uniq(r.tests.map((t) => t.tc.fqcn)).slice(0, 2).join(', '),
          severity: sev, certainty: 'Possible',
          observation: m.display + ': ' + g.text + scopeNote,
          explanation: texts[0], risk: texts[1], action: texts[2],
          evidence: at((g.lines && g.lines[0]) || m.nameLine || m.line, m.display),
        }));
      }
    }
  }
  return out;
}

function coverageFindings(A) {
  const out = [];
  const J = A.jacoco;
  if (!J.present) return out;
  const threshold = A.review.threshold;
  const gated = A.review.gatedMetrics;
  const jEv = (seq, id, what) => [ev(seq, id, null, what)];
  const firstJ = A.jacocoSnippets[0] || {};

  // Threshold check on the assessed population — one finding listing every metric that falls short.
  const assessed = A.coverage.assessed;
  const below = assessed.metrics.filter((m) => gated.includes(m.type) && !m.na && !m.meets);
  if (below.length) {
    out.push(finding('COVERAGE_BELOW_THRESHOLD', {
      category: 'Coverage', severity: 'High', certainty: 'Definite', status: STATUS.FAIL, sourceClass: assessed.label,
      observation: (below.length === 1 ? below[0].label + ' coverage is' : 'Coverage is') + ' below the ' + threshold + '% threshold: ' +
        below.map((m) => m.label + ' ' + m.pct + ' (' + fmtInt(m.covered) + ' of ' + fmtInt(m.total) + ', ' + fmtInt(m.missed) + ' missed)').join('; ') + '.',
      explanation: 'Measured by JaCoCo for ' + assessed.description + '.' + (threshold >= 100 ? ' A strict 100% pass requires zero missed elements.' : ''),
      risk: 'Code in scope is not executed by any test.', action: 'Add tests for the uncovered code listed under Uncovered Code Findings, then re-run JaCoCo.',
      evidence: jEv(firstJ.seq, firstJ.id, 'JaCoCo counters'),
    }));
  }
  if (A.coverage.scope && A.coverage.scope.changed && A.coverage.scope.changed.assessable) {
    const ch = A.coverage.scope.changed;
    for (const f of ch.files) {
      if (!f.uncovered.length && !(threshold >= 100 && (f.partial.length || f.branchMisses.length))) continue;
      out.push(finding('CHANGED_CODE_UNCOVERED', {
        category: 'Coverage', severity: 'High', certainty: 'Definite', status: STATUS.FAIL, sourceClass: f.path,
        observation: 'Changed lines not fully covered: ' + [f.uncovered.length ? 'not executed — line ' + compactRanges(f.uncovered) : '', f.partial.length ? 'partly executed — line ' + compactRanges(f.partial) : '', f.branchMisses.length ? 'missed branches — line ' + compactRanges(f.branchMisses.map((b) => b.nr)) : ''].filter(Boolean).join('; ') + '.',
        explanation: 'These lines were added or modified in the supplied diff and JaCoCo shows missed instructions or branches on them.',
        risk: 'New or changed behaviour is not exercised by tests.', action: 'Add tests that execute these lines and branches.',
        evidence: jEv(f.sourcefile.snippetSeq, f.sourcefile.snippetId, f.sourcefile.name + ' line data'),
      }));
    }
  }
  for (const g of A.uncovered) {
    if (!g.inScope && A.coverage.scope && A.coverage.scope.classes.length) continue; // outside declared scope: listed, not failed
    const sev = g.classNotExecuted ? 'High' : 'High';
    const missed = METRICS.map((t) => counterOf(g.counters, t)).filter((c) => c.missed > 0);
    const failStatus = assessed.metrics.some((m) => gated.includes(m.type) && !m.na && !m.meets) ? STATUS.FAIL : STATUS.REVIEW;
    out.push(finding(g.classNotExecuted ? 'CLASS_NOT_EXECUTED' : 'UNCOVERED_CODE', {
      category: 'Coverage', severity: sev, certainty: 'Definite', status: failStatus, sourceClass: g.fqcn,
      observation: g.classNotExecuted
        ? g.simpleName + ' was never executed during the test run (JaCoCo CLASS counter 0 covered).'
        : g.simpleName + ': ' + missed.map((c) => fmtInt(c.missed) + ' ' + COUNTER_NOUN[c.type][c.missed === 1 ? 0 : 1] + ' missed').join(', ') +
          (g.ranges.length ? '; uncovered line' + (g.ranges.length > 1 || g.ranges[0].count > 1 ? 's ' : ' ') + g.ranges.slice(0, 8).map((r) => (r.from === r.to ? r.from : r.from + '–' + r.to)).join(', ') : '') +
          (g.methods.length ? '; methods not fully executed: ' + uniq(g.methods.map((m) => (m.name === '<init>' ? 'constructor' : m.name + '()'))).slice(0, 6).join(', ') : '') + '.',
      explanation: 'Measured execution evidence (JaCoCo).' + (g.sourceAvailable ? ' Source lines are shown under Uncovered Code Findings.' : ' Paste the production source to see the uncovered statements.'),
      risk: 'Untested code paths in ' + (g.inScope ? 'the enhancement scope' : 'the measured code') + '.',
      action: 'Add tests that execute the listed lines/branches, or justify the exclusion.',
      evidence: jEv(g.jacocoSnippetSeq, null, 'JaCoCo class ' + g.outerBinary),
    }));
  }
  if (A.coverage.scope) {
    for (const r of A.coverage.scope.missingFromJacoco) {
      out.push(finding('SCOPE_CLASS_NOT_IN_JACOCO', {
        category: 'Scope', severity: 'High', certainty: 'Definite', status: STATUS.INSUFFICIENT, sourceClass: r.name,
        observation: 'In-scope class ' + r.name + ' does not appear in the supplied JaCoCo report.',
        explanation: 'Either the class was never loaded by the tests, or the report pasted does not cover its module.',
        risk: 'Coverage of this changed class is unknown.', action: 'Supply the JaCoCo report that includes ' + simpleNameOf(r.name) + ', or add tests that load it.',
        evidence: [ev(r.entry.snippetSeq, r.entry.snippetId, r.entry.line, 'scope entry')],
      }));
    }
  }
  for (const pc of A.prodClasses) {
    if (pc.outer || pc.fragment) continue;
    if ((pc.isInterface && !pc.methods.some((m) => m.hasBody)) || pc.kind === 'annotation') continue; // no executable code to measure
    if (!A.jacocoLookup.classFor(pc) && !(A.coverage.scope && A.coverage.scope.missingFromJacoco.some((r) => r.source === pc))) {
      out.push(finding('SOURCE_NOT_IN_JACOCO', {
        category: 'Coverage', severity: 'Medium', certainty: 'Definite', status: STATUS.INSUFFICIENT, sourceClass: pc.fqcn,
        observation: 'Production class ' + pc.simpleName + ' was supplied as source but is not in the JaCoCo report.',
        explanation: 'There is no measured coverage for it.' + (pc.pkg ? '' : ' (It has no package declaration, which may also prevent matching.)'),
        risk: 'Its coverage cannot be verified.', action: 'Supply JaCoCo evidence that includes this class, or confirm it is out of scope.',
        evidence: [ev(pc.snippetSeq, pc.snippetId, pc.line, 'class declaration')],
      }));
    } else {
      const jc = A.jacocoLookup.classFor(pc);
      const al = jc ? A.jacocoLookup.alignment(pc, jc) : null;
      if (al && !al.ok && al.checked >= 2) {
        out.push(finding('LINE_MISMATCH', {
          category: 'Evidence', severity: 'Low', certainty: 'Possible', sourceClass: pc.fqcn,
          observation: 'Line numbers in the pasted ' + pc.simpleName + ' source do not line up with the JaCoCo method lines (' + Math.round(al.ratio * 100) + '% agree).',
          explanation: 'The paste may not start at line 1 of the file, or the source differs from the build that was measured.',
          risk: 'Uncovered lines cannot be shown against the source; the source reviewed may not be the version tested.',
          action: 'Paste the complete file from the same commit as the JaCoCo run.',
          evidence: [ev(pc.snippetSeq, pc.snippetId, pc.line, 'source')],
        }));
      }
    }
  }
  for (const w of J.warnings) {
    out.push(finding('JACOCO_INTEGRITY', {
      category: 'Evidence', severity: /do not equal|cut off/.test(w.text) ? 'Medium' : 'Low', certainty: 'Definite', status: STATUS.REVIEW,
      observation: w.text, explanation: 'Raised while reading the JaCoCo evidence.', risk: 'Figures may not represent the full test run.',
      action: 'Paste the complete, unedited jacoco.xml produced by the build.', evidence: [ev(w.snippetSeq, w.snippetId, null, 'JaCoCo report')],
    }));
  }
  for (const c of J.conflicts) {
    out.push(finding('JACOCO_CONFLICT', {
      category: 'Evidence', severity: 'Medium', certainty: 'Definite', status: STATUS.REVIEW, sourceClass: c.cls.replace(/\//g, '.'),
      observation: 'Class ' + c.cls.replace(/\//g, '.') + ' appears in two JaCoCo pastes with different counters (snippets #' + c.from + ' and #' + c.to + '). The later one is used.',
      explanation: 'Two reports for the same class usually means two different test runs.', risk: 'The figures shown may not be from the intended run.',
      action: 'Remove the outdated report.', evidence: [ev(c.to, null, null, 'JaCoCo report')],
    }));
  }
  return out;
}

function compactRanges(nums) {
  const s = uniq(nums).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(i === j ? String(s[i]) : s[i] + '–' + s[j]);
    i = j;
  }
  return parts.slice(0, 12).join(', ') + (parts.length > 12 ? ', …' : '');
}

function executionFindings(A) {
  const out = [];
  const R = A.execution;
  if (!R.present) return out;
  for (const c of R.cases.filter((x) => x.status === 'failed' || x.status === 'error')) {
    out.push(finding('TEST_FAILED', {
      category: 'Execution', severity: 'High', certainty: 'Definite', status: STATUS.FAIL, testClass: c.classname, testMethod: c.normName || c.name,
      observation: 'Test ' + (c.status === 'error' ? 'errored' : 'failed') + ' in the execution results' + (c.message ? ': ' + truncate(c.message, 160) : '.'),
      explanation: 'The supplied JUnit results record this test as ' + (c.status === 'error' ? 'an error' : 'a failure') + '.',
      risk: 'The behaviour it checks does not work as expected, or the test is broken.', action: 'Fix the defect or the test and re-run.',
      evidence: [ev(c.snippetSeq, c.snippetId, c.line, 'test result')],
    }));
  }
  for (const c of R.cases.filter((x) => x.status === 'skipped')) {
    out.push(finding('TEST_SKIPPED', {
      category: 'Execution', severity: 'Medium', certainty: 'Definite', status: STATUS.REVIEW, testClass: c.classname, testMethod: c.normName || c.name,
      observation: 'Test was skipped in the execution results' + (c.message ? ': ' + truncate(c.message, 120) : '.'),
      explanation: 'Skipped tests do not execute.', risk: 'The scenario is untested in this run.', action: 'Confirm why it was skipped and re-enable it if it is in scope.',
      evidence: [ev(c.snippetSeq, c.snippetId, c.line, 'test result')],
    }));
  }
  for (const s of R.suiteFailures) {
    out.push(finding('SUITE_FAILED', {
      category: 'Execution', severity: 'High', certainty: 'Definite', status: STATUS.FAIL, testClass: s.name,
      observation: s.name + ': ' + s.failures + ' failure(s), ' + s.errors + ' error(s) of ' + s.tests + ' tests run.',
      explanation: 'Summary line from the supplied test output.', risk: 'Failing tests in the evidence.', action: 'Fix the failures and re-run.',
      evidence: [ev(s.snippetSeq, s.snippetId, s.line, 'summary line')],
    }));
  }
  for (const nx of R.notExecuted) {
    out.push(finding('NO_EXECUTION_RECORD', {
      category: 'Execution', severity: 'Medium', certainty: 'Possible', status: STATUS.REVIEW, testClass: nx.tc.fqcn, testMethod: nx.tm ? nx.tm.name : '',
      observation: nx.tm ? 'No execution record found for this test in the supplied results.' : 'No execution results were supplied for test class ' + nx.tc.simpleName + '.',
      explanation: nx.tm ? 'Results exist for the class but this method does not appear in them (it may have been added after the run, or not been discovered).' : 'The class appears in the test code but not in any pasted results.',
      risk: 'The test may not have run.', action: 'Re-run the tests and paste the complete results.',
      evidence: [ev(nx.tc.snippetSeq, nx.tc.snippetId, nx.tm ? nx.tm.nameLine : nx.tc.line, 'test method')],
    }));
  }
  if (R.countMismatch.length) {
    for (const s of R.countMismatch) {
      out.push(finding('RESULT_COUNT_MISMATCH', {
        category: 'Execution', severity: 'Low', certainty: 'Possible', status: STATUS.REVIEW, testClass: s.name,
        observation: s.name + ': ' + s.ran + ' test executions recorded but ' + s.declared + ' enabled test methods are in the pasted code.',
        explanation: 'Parameterized and repeated tests produce several executions per method, so the numbers can legitimately differ; fewer executions than methods suggests tests that did not run.',
        risk: 'Some tests may not have run.', action: 'Check the run included all test methods.',
        evidence: [ev(s.snippetSeq, s.snippetId, s.line, 'results')],
      }));
    }
  }
  return out;
}

function scopeAndEvidenceFindings(A) {
  const out = [];
  const S = A.coverage.scope;
  if (!A.scopeSnippets.length) {
    out.push(finding('SCOPE_MISSING', {
      category: 'Scope', severity: 'High', certainty: 'Definite', status: STATUS.INSUFFICIENT,
      observation: 'No enhancement change scope was supplied (git diff, changed-file list or affected classes).',
      explanation: 'Without the scope it cannot be shown that the measured classes are the ones changed by this enhancement. Whole-project or report-wide figures are not inferred from a subset.',
      risk: 'Changed code outside the supplied evidence could be untested.', action: 'Paste the git diff or the list of changed/affected classes.',
      evidence: [],
    }));
  }
  if (S) {
    for (const r of S.classes) {
      if (r.source || !A.prodClasses.length) continue;
      out.push(finding('SCOPE_SOURCE_MISSING', {
        category: 'Scope', severity: 'Low', certainty: 'Definite', status: STATUS.REVIEW, sourceClass: r.name,
        observation: 'Production source for in-scope class ' + simpleNameOf(r.name) + ' was not supplied.',
        explanation: 'Static traceability (which tests exercise which methods, conditions, exceptions) is not available for it.',
        risk: 'Gaps in its tests cannot be explained beyond the measured figures.', action: 'Paste the class source if a method-level review is required.',
        evidence: [ev(r.entry.snippetSeq, r.entry.snippetId, r.entry.line, 'scope entry')],
      }));
    }
    for (const r of S.classes) {
      if (r.tests.length || !A.testClasses.length) continue;
      if (r.source && A.trace && A.trace.classRows.some((cr) => cr.cls === r.source && cr.methods.some((m) => m.status === TRACE.TESTED || m.status === TRACE.API))) continue;
      out.push(finding('SCOPE_NO_TESTS', {
        category: 'Scope', severity: 'Medium', certainty: 'Possible', status: STATUS.REVIEW, sourceClass: r.name,
        observation: 'No supplied test class appears to target in-scope class ' + simpleNameOf(r.name) + '.',
        explanation: 'No test class is named after it, injects it, or calls it directly.', risk: 'Changes to it may be untested, unless tested indirectly (check measured coverage).',
        action: 'Supply its test class, or confirm it is covered through other tests.', evidence: [ev(r.entry.snippetSeq, r.entry.snippetId, r.entry.line, 'scope entry')],
      }));
    }
    for (const w of S.warnings || []) {
      out.push(finding('SCOPE_NOTE', { category: 'Scope', severity: 'Info', certainty: 'Definite', status: STATUS.NA, observation: w, explanation: 'Noted from the change scope.', risk: 'Not measurable by JaCoCo.', action: 'Review separately if relevant.', evidence: [] }));
    }
    for (const e of S.entries.filter((x) => x.ambiguous)) {
      out.push(finding('SCOPE_AMBIGUOUS', {
        category: 'Scope', severity: 'Low', certainty: 'Definite', status: STATUS.REVIEW, sourceClass: e.simpleName,
        observation: 'Scope entry "' + e.simpleName + '" matches several classes in the JaCoCo report (' + e.ambiguous.slice(0, 3).join(', ') + ').',
        explanation: 'A simple class name without a package is ambiguous.', risk: 'The wrong class could be assessed.', action: 'Use the fully-qualified class name or file path.',
        evidence: [ev(e.snippetSeq, e.snippetId, e.line, 'scope entry')],
      }));
    }
  }
  for (const s of A.snippets) {
    const at = [ev(s.seq, s.id, null, s.label)];
    if (s.incomplete) {
      out.push(finding('PARTIAL_SNIPPET', {
        category: 'Evidence', severity: 'Medium', certainty: 'Definite', status: STATUS.REVIEW,
        observation: 'Snippet #' + s.seq + ' appears incomplete: ' + s.incompleteReasons.slice(0, 3).join(' ') ,
        explanation: 'Analysis used whatever could be read; results for this snippet may be partial.', risk: 'Tests or code missing from the paste are not reviewed.',
        action: 'Re-copy the complete file and replace the snippet.', evidence: at,
      }));
    }
    if (s.duplicateOf) {
      out.push(finding('DUPLICATE_SNIPPET', {
        category: 'Evidence', severity: 'Info', certainty: 'Definite', status: STATUS.NA,
        observation: 'Snippet #' + s.seq + ' is identical to snippet #' + s.duplicateOf + '; it is counted once.', explanation: 'Duplicate pastes are ignored.',
        risk: 'None.', action: 'Remove the duplicate snippet.', evidence: at,
      }));
    }
    if (s.typeWarning) {
      out.push(finding('TYPE_MISMATCH', { category: 'Evidence', severity: 'Low', certainty: 'Definite', status: STATUS.REVIEW, observation: s.typeWarning, explanation: 'The selected input type differs from what the content looks like.', risk: 'The snippet may be misinterpreted.', action: 'Check the input type for this snippet.', evidence: at }));
    }
    if (s.unrecognised) {
      out.push(finding('UNRECOGNISED_INPUT', { category: 'Evidence', severity: 'Medium', certainty: 'Definite', status: STATUS.REVIEW, observation: 'Snippet #' + s.seq + ' could not be interpreted as any supported input.', explanation: s.unrecognised, risk: 'Its content is not part of the review.', action: 'Choose the input type explicitly, or check the copied text.', evidence: at }));
    }
  }
  for (const d of A.duplicateClasses) {
    const parts = d.details.map((x) => {
      if (x.kind === 'no-package') return 'snippet #' + x.seq + ' has no package line and ' + (x.sameBody ? 'is otherwise identical — treated as a copy' : 'shares most test names — treated as a copy (contents differ)');
      if (x.kind === 'identical') return 'snippet #' + x.seq + ' is identical';
      return 'snippet #' + x.seq + ' is an earlier, different version (superseded)';
    });
    out.push(finding(d.identical ? 'DUPLICATE_CLASS' : 'CONFLICTING_CLASS_VERSIONS', {
      category: 'Evidence', severity: d.identical ? 'Info' : 'Medium', certainty: d.possible ? 'Possible' : 'Definite', status: d.identical ? STATUS.NA : STATUS.REVIEW,
      testClass: d.role === 'test' ? d.fqcn : '', sourceClass: d.role === 'test' ? '' : d.fqcn,
      observation: simpleNameOf(d.fqcn) + ' was pasted ' + (d.dropped.length + 1) + ' times; snippet #' + d.kept + ' is used. ' + parts.join('; ') + '.',
      explanation: 'Each class is analysed once (the most recently added or edited copy that has its package line), so tests are not double-counted.',
      risk: d.identical ? 'None.' : 'If the wrong copy is current, the review describes code that was not tested.', action: d.identical ? 'Remove the duplicate snippet(s).' : 'Remove or replace the outdated snippet(s).',
      evidence: d.dropped.map((seq) => ev(seq, null, null, 'duplicate')).concat([ev(d.kept, null, null, 'used')]),
    }));
  }
  for (const d of A.declared.conflicts) {
    out.push(finding('DECLARED_CONFLICT', {
      category: 'Coverage', severity: 'High', certainty: 'Definite', status: STATUS.REVIEW,
      observation: 'Declared ' + METRIC_LABEL[d.metric] + ' coverage "' + d.declared + '" (' + d.provenance + ') conflicts with JaCoCo measured ' + d.measured + '.',
      explanation: 'The declared figure is not independently verified; the JaCoCo measurement is the evidence used.',
      risk: 'The declaration overstates (or misstates) actual coverage.', action: 'Ask the vendor to reconcile the declaration with the JaCoCo report.',
      evidence: [ev(d.snippetSeq, d.snippetId, d.line, 'declared summary')],
    }));
  }
  return out;
}

function rankFindings(list) {
  const statusOrder = { [STATUS.FAIL]: 0, [STATUS.INSUFFICIENT]: 1, [STATUS.REVIEW]: 2, [STATUS.PASS]: 3, [STATUS.NA]: 4 };
  list.sort((a, b) => (statusOrder[a.status] - statusOrder[b.status]) || (SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]) ||
    ((a.certainty === 'Definite' ? 0 : 1) - (b.certainty === 'Definite' ? 0 : 1)) || a.category.localeCompare(b.category));
  list.forEach((f, i) => { f.id = 'F-' + String(i + 1).padStart(3, '0'); });
  return list;
}
