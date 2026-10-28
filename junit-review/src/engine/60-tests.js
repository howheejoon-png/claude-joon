/* ------------------------------------------------------------------------
 * Test-class analysis: framework, style, lifecycle, and for every test
 * method its assertions, Mockito usage, API requests, scenario evidence and
 * the production methods it references.
 * --------------------------------------------------------------------- */

const ASSERT_FNS = new Set([
  'assertEquals', 'assertNotEquals', 'assertTrue', 'assertFalse', 'assertNull', 'assertNotNull', 'assertSame',
  'assertNotSame', 'assertArrayEquals', 'assertIterableEquals', 'assertLinesMatch', 'assertThrows',
  'assertThrowsExactly', 'assertDoesNotThrow', 'assertAll', 'assertTimeout', 'assertTimeoutPreemptively',
  'assertInstanceOf', 'assertThat', 'assertThatThrownBy', 'assertThatCode', 'assertThatExceptionOfType',
  'assertThatNullPointerException', 'assertThatIllegalArgumentException', 'assertThatIllegalStateException',
  'assertThatIOException', 'assertThatObject', 'assertThatList', 'assertThatNoException', 'assertWithMessage',
  'assertAbout', 'assertSoftly', 'assertJsonEquals', 'assertEqualsNoOrder', 'checkThat', 'expectThrows',
]);
const ASSERT_HOLDERS = new Set([
  'Assert', 'Assertions', 'MatcherAssert', 'Truth', 'Truth8', 'AssertionsForClassTypes', 'AssertionsForInterfaceTypes',
  'BDDAssertions', 'Assume', 'Assumptions', 'StepVerifier', 'JSONAssert', 'SoftAssertions', 'ArrayAsserts', 'TestCase',
]);
const EXCEPTION_ASSERTS = new Set([
  'assertThrows', 'assertThrowsExactly', 'assertThatThrownBy', 'assertThatExceptionOfType', 'assertThatNullPointerException',
  'assertThatIllegalArgumentException', 'assertThatIllegalStateException', 'assertThatIOException', 'expectThrows', 'catchThrowable',
  'catchThrowableOfType', 'catchException',
]);
// Assertions whose lambda argument runs the code under test.
const LAMBDA_ASSERTS = new Set([
  'assertThrows', 'assertThrowsExactly', 'assertThatThrownBy', 'assertThatCode', 'assertDoesNotThrow', 'assertAll', 'assertTimeout',
  'assertTimeoutPreemptively', 'catchThrowable', 'catchThrowableOfType', 'catchException', 'expectThrows', 'assertSoftly',
]);
const MOCKITO_CALLS = new Set([
  'when', 'given', 'verify', 'times', 'never', 'atLeast', 'atLeastOnce', 'atMost', 'only', 'thenReturn', 'thenThrow', 'thenAnswer',
  'willReturn', 'willThrow', 'willAnswer', 'doReturn', 'doThrow', 'doNothing', 'doAnswer', 'any', 'anyInt', 'anyLong', 'anyString',
  'anyList', 'anyMap', 'anySet', 'anyBoolean', 'anyDouble', 'anyCollection', 'eq', 'argThat', 'isA', 'same', 'refEq', 'nullable',
  'should', 'calls', 'mock', 'spy', 'verifyNoInteractions', 'verifyNoMoreInteractions', 'thenCallRealMethod',
]);
const SUCCESS_STATUS = new Set(['isOk', 'is2xxSuccessful', 'isCreated', 'isAccepted', 'isNoContent', 'isFound', 'isMovedPermanently', 'is3xxRedirection', 'isPartialContent']);
const ERROR_STATUS = new Set([
  'isBadRequest', 'isNotFound', 'isUnauthorized', 'isForbidden', 'isConflict', 'isUnprocessableEntity', 'is4xxClientError',
  'is5xxServerError', 'isInternalServerError', 'isMethodNotAllowed', 'isUnsupportedMediaType', 'isNotAcceptable', 'isGone',
  'isPreconditionFailed', 'isTooManyRequests', 'isServiceUnavailable', 'isPayloadTooLarge', 'isRequestTimeout', 'isNotImplemented',
  'isBadGateway', 'isGatewayTimeout', 'isLocked', 'isPaymentRequired',
]);
const SECURITY_STATUS = new Set(['isUnauthorized', 'isForbidden']);
const BODY_MATCHERS = new Set(['jsonPath', 'content', 'header', 'model', 'view', 'redirectedUrl', 'forwardedUrl', 'cookie', 'request', 'flash', 'xpath', 'redirectedUrlPattern', 'forwardedUrlPattern', 'handler']);
const HTTP_VERBS = { get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE', patch: 'PATCH', head: 'HEAD', options: 'OPTIONS', multipart: 'POST' };
const REST_TEMPLATE_VERBS = {
  getForEntity: 'GET', getForObject: 'GET', postForEntity: 'POST', postForObject: 'POST', postForLocation: 'POST',
  put: 'PUT', delete: 'DELETE', patchForObject: 'PATCH', headForHeaders: 'HEAD', optionsForAllow: 'OPTIONS',
};
const FRAMEWORK_TYPES = new Set([
  'MockMvc', 'WebTestClient', 'TestRestTemplate', 'RestTemplate', 'ObjectMapper', 'TestEntityManager', 'EntityManager',
  'JdbcTemplate', 'NamedParameterJdbcTemplate', 'WebApplicationContext', 'ApplicationContext', 'MockRestServiceServer',
  'ArgumentCaptor', 'InOrder', 'ExpectedException', 'TemporaryFolder', 'Validator', 'ValidatorFactory', 'Clock', 'String',
  'Integer', 'Long', 'Double', 'BigDecimal', 'List', 'Map', 'Set', 'Optional', 'Object', 'MockHttpServletRequest',
  'MockHttpServletResponse', 'MvcResult', 'ResultActions', 'ResponseEntity', 'HttpHeaders', 'HttpEntity', 'TestInfo', 'Path',
  'File', 'SoftAssertions', 'LocalDate', 'LocalDateTime', 'Instant', 'UUID', 'Random', 'Faker',
]);
const SECURITY_ANNOTATIONS = new Set(['WithMockUser', 'WithAnonymousUser', 'WithUserDetails', 'WithSecurityContext', 'WithMockJwtAuth', 'WithJwt']);
const SECURITY_POSTPROCESSORS = new Set(['user', 'csrf', 'jwt', 'oauth2Login', 'oauth2Client', 'opaqueToken', 'httpBasic', 'anonymous', 'authentication', 'oidcLogin', 'securityContext', 'testSecurityContext', 'x509', 'digest']);
const INDEX_CALLS = new Set(['get', 'getArgument', 'getArguments', 'charAt', 'subList', 'substring', 'times', 'atLeast', 'atMost', 'setScale', 'sleep', 'calls', 'nth', 'element', 'skip', 'limit', 'plusDays', 'minusDays', 'plusSeconds', 'withNano', 'ofSeconds', 'ofMillis', 'remove', 'index', 'jsonPath', 'value', 'hasSize', 'isEqualTo', 'size']);
const NEGATIVE_WORDS = /(invalid|fail|error|exception|throw|notfound|not_found|missing|reject|unauthori[sz]ed|unauthenticated|forbidden|denied|illegal|bad|wrong|duplicate|conflict|expired|exceed|overflow|timeout|negative|nonexist|unknown|disallow|insufficient|cannot|refuse|block)/i;
const BOUNDARY_WORDS = /(boundary|edge|limit|maximum|minimum|\bmax|\bmin|zero|threshold|exactly|upper|lower|overflow|exceed)/i;
const NULL_WORDS = /(null|empty|blank|absent)/i;
const SECURITY_WORDS = /(auth|unauthori[sz]ed|unauthenticated|forbidden|role|permission|access|secur|csrf|token|jwt|admin|login)/i;

function splitWords(name) {
  return String(name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_$]+/g, ' ').toLowerCase();
}

function frameworkOfClass(unit, cls) {
  const imps = unit ? unit.imports.map((i) => i.name) : [];
  const j5 = imps.some((n) => n.startsWith('org.junit.jupiter.'));
  const j4 = imps.some((n) => /^org\.junit\.(Test|Before|After|BeforeClass|AfterClass|Rule|ClassRule|Ignore|runner\.|runners\.|rules\.|Assert|\*)/.test(n));
  const testImport = imps.find((n) => n === 'org.junit.Test' || n === 'org.junit.jupiter.api.Test' || n === 'org.junit.*' || n === 'org.junit.jupiter.api.*' || n === 'org.testng.annotations.Test');
  const testng = imps.some((n) => n.startsWith('org.testng.'));
  return { j5, j4, testng, testImport: testImport || '' };
}

function testAnnotationOf(m) {
  for (const a of m.anns) {
    if (TEST_ANNOTATIONS.has(a.name)) return a;
  }
  return null;
}

function annFramework(a, fw) {
  if (!a) return '';
  if (/^org\.junit\.jupiter\./.test(a.qname)) return 'junit5';
  if (/^org\.junit\./.test(a.qname)) return 'junit4';
  if (/^org\.testng\./.test(a.qname)) return 'testng';
  if (a.name !== 'Test') return 'junit5'; // ParameterizedTest etc. are Jupiter-only
  if (fw.testImport === 'org.junit.Test' || fw.testImport === 'org.junit.*') return 'junit4';
  if (fw.testImport === 'org.junit.jupiter.api.Test' || fw.testImport === 'org.junit.jupiter.api.*') return 'junit5';
  if (fw.testImport === 'org.testng.annotations.Test') return 'testng';
  if (fw.j5 && !fw.j4) return 'junit5';
  if (fw.j4 && !fw.j5) return 'junit4';
  return 'unknown';
}

/* Analyse one test class (and its @Nested inner classes).
 * ctx: { snippet, P, unit, prod (production index), supportTypes }
 */
function analyzeTestClass(ctx, cls) {
  const { P, unit } = ctx;
  const fw = frameworkOfClass(unit, cls);
  const classAnnNames = cls.anns.map((a) => a.name);
  const out = {
    fqcn: cls.fqcn, simpleName: cls.name, pkg: cls.pkg || '', binaryName: cls.binaryName, snippetId: ctx.snippet.id,
    snippetSeq: ctx.snippet.seq, line: cls.startLine, endLine: cls.endLine, complete: cls.complete && !ctx.incomplete,
    frameworks: [], framework: '', styles: [], primaryStyle: '', methods: [], lifecycle: [], fields: [], targets: [],
    classAnns: classAnnNames, disabled: !!annNamed(cls.anns, 'Disabled', 'Ignore'), springContext: '',
    commentedTests: [], helperMethods: [], issues: [], stubsInSetup: [], fragment: cls.kind === 'fragment',
  };

  // Fields across the class, its outer classes (for @Nested) and pasted superclasses.
  const fieldMap = new Map();
  const addFields = (ty) => {
    for (const f of ty.fields) {
      if (fieldMap.has(f.name)) continue;
      const annN = f.anns.map((a) => a.name);
      const mockByInit = /^(?:Mockito\.)?mock\s*\(/.test(f.init);
      const spyByInit = /^(?:Mockito\.)?spy\s*\(/.test(f.init);
      const initNew = /^new\s+([\w.]+)/.exec(f.init);
      const initMockType = /^(?:Mockito\.)?(?:mock|spy)\s*\(\s*([\w.]+)\.class/.exec(f.init);
      fieldMap.set(f.name, {
        name: f.name, type: simpleNameOf(initMockType ? initMockType[1] : initNew ? initNew[1] : f.base), declaredType: simpleNameOf(f.base), anns: annN,
        mock: annN.includes('Mock') || annN.includes('MockBean') || annN.includes('MockitoBean') || mockByInit,
        spy: annN.includes('Spy') || annN.includes('SpyBean') || annN.includes('MockitoSpyBean') || spyByInit,
        injectMocks: annN.includes('InjectMocks'), autowired: annN.includes('Autowired') || annN.includes('Inject') || annN.includes('Resource'),
        newType: initNew ? simpleNameOf(initNew[1]) : '', line: f.nameLine, owner: ty.name,
      });
    }
  };
  for (let t = cls; t; t = t.outer) addFields(t);
  for (const sup of cls.ext) {
    const base = ctx.supportTypes && ctx.supportTypes.get(sup);
    if (base) addFields(base);
  }
  out.fields = Array.from(fieldMap.values());

  // Spring / runner context
  if (annNamed(cls.anns, 'WebMvcTest')) out.springContext = 'WebMvcTest';
  else if (annNamed(cls.anns, 'DataJpaTest', 'DataJdbcTest', 'JdbcTest', 'DataMongoTest', 'JooqTest', 'DataR2dbcTest', 'MybatisTest')) out.springContext = annNamed(cls.anns, 'DataJpaTest', 'DataJdbcTest', 'JdbcTest', 'DataMongoTest', 'JooqTest', 'DataR2dbcTest', 'MybatisTest').name;
  else if (annNamed(cls.anns, 'SpringBootTest')) out.springContext = 'SpringBootTest';
  else if (annNamed(cls.anns, 'WebFluxTest')) out.springContext = 'WebFluxTest';
  else if (annNamed(cls.anns, 'JsonTest')) out.springContext = 'JsonTest';

  // Targets (unit under test)
  const targets = [];
  const addTarget = (name, basis) => { if (name && !targets.some((t) => t.name === name)) targets.push({ name, basis }); };
  for (const a of cls.anns) if (a.name === 'WebMvcTest' || a.name === 'WebFluxTest') for (const c of annClassRefs(a)) addTarget(c, '@' + a.name);
  for (const f of out.fields) if (f.injectMocks) addTarget(f.type, '@InjectMocks field');
  for (const f of out.fields) if (f.autowired && !FRAMEWORK_TYPES.has(f.type) && !f.mock) addTarget(f.type, '@Autowired field');
  for (const f of out.fields) if (f.newType && !f.mock && !FRAMEWORK_TYPES.has(f.newType)) addTarget(f.newType, 'field created with new');
  const conv = /^(.+?)(?:Tests?|IT|ITCase|TestCase|Spec|UnitTest|IntegrationTest)$/.exec(cls.name) || /^Test(.+)$/.exec(cls.name);
  if (conv) addTarget(conv[1], 'naming convention');

  // Lifecycle & helpers
  const testMethods = [];
  const collect = (ty, prefix) => {
    for (const m of ty.methods) {
      const ta = testAnnotationOf(m);
      if (ta) testMethods.push({ m, ta, owner: ty, prefix });
      else if (annNamed(m.anns, 'BeforeEach', 'Before', 'BeforeAll', 'BeforeClass', 'AfterEach', 'After', 'AfterAll', 'AfterClass', 'BeforeMethod', 'AfterMethod')) out.lifecycle.push({ m, owner: ty, kind: annNamed(m.anns, 'BeforeEach', 'Before', 'BeforeAll', 'BeforeClass', 'AfterEach', 'After', 'AfterAll', 'AfterClass', 'BeforeMethod', 'AfterMethod').name });
      else out.helperMethods.push(m);
    }
    for (const n of ty.types) {
      if (annNamed(n.anns, 'Nested') || n.methods.some((x) => testAnnotationOf(x))) collect(n, (prefix ? prefix + '.' : '') + n.name);
    }
  };
  collect(cls, '');

  const helperByName = new Map();
  for (const h of out.helperMethods) if (h.hasBody) helperByName.set(h.name, h);

  // Assertions inside helper methods (one level), so delegated checks are credited.
  const helperFacts = new Map();
  for (const h of out.helperMethods) {
    if (!h.hasBody) continue;
    const b = scanBody(P, h.bodyStart, h.bodyEnd);
    const facts = { asserts: 0, verifies: 0, expects: 0 };
    for (const c of b.calls) {
      if (isAssertionCall(c, fieldMap)) facts.asserts++;
      if (c.name === 'verify' || c.name === 'verifyNoInteractions' || c.name === 'verifyNoMoreInteractions' || c.name === 'should') facts.verifies++;
      if (c.name === 'andExpect' || c.name === 'andExpectAll' || c.name === 'expectStatus' || c.name === 'expectBody') facts.expects++;
    }
    helperFacts.set(h.name, facts);
  }

  // Stubs declared in @BeforeEach / @Before apply to every test.
  for (const lc of out.lifecycle) {
    if (!lc.m.hasBody || !/Before/.test(lc.kind)) continue;
    const b = scanBody(P, lc.m.bodyStart, lc.m.bodyEnd);
    for (const s of mockitoStubs(P, b, fieldMap, new Map())) out.stubsInSetup.push(s);
  }

  for (const tm of testMethods) out.methods.push(analyzeTestMethod(ctx, out, tm, fw, fieldMap, helperFacts, helperByName));

  // Framework summary
  const fws = uniq(out.methods.map((m) => m.framework).filter((x) => x && x !== 'unknown'));
  out.frameworks = fws;
  out.framework = fws.length > 1 ? 'mixed' : fws[0] || (fw.j5 ? 'junit5' : fw.j4 ? 'junit4' : fw.testng ? 'testng' : 'unknown');
  const j5Life = out.lifecycle.some((l) => /Each|All/.test(l.kind)) || cls.anns.some((a) => a.name === 'ExtendWith' || a.name === 'Nested' || a.name === 'DisplayName' || a.name === 'TestInstance');
  const j4Life = out.lifecycle.some((l) => /^(Before|After|BeforeClass|AfterClass)$/.test(l.kind)) || cls.anns.some((a) => a.name === 'RunWith') || cls.fields.some((f) => f.anns.some((a) => a.name === 'Rule' || a.name === 'ClassRule'));
  out.lifecycleMismatch = '';
  if (out.framework === 'junit4' && j5Life) out.lifecycleMismatch = 'JUnit 4 @Test methods are combined with JUnit 5 annotations (' + (out.lifecycle.filter((l) => /Each|All/.test(l.kind)).map((l) => '@' + l.kind).concat(cls.anns.filter((a) => a.name === 'ExtendWith').map(() => '@ExtendWith')).join(', ') || 'Jupiter annotations') + ').';
  if (out.framework === 'junit5' && j4Life) out.lifecycleMismatch = 'JUnit 5 @Test methods are combined with JUnit 4 constructs (' + (out.lifecycle.filter((l) => /^(Before|After|BeforeClass|AfterClass)$/.test(l.kind)).map((l) => '@' + l.kind).concat(cls.anns.filter((a) => a.name === 'RunWith').map(() => '@RunWith')).join(', ') || '@Rule') + ').';
  if (out.framework === 'mixed') out.lifecycleMismatch = 'The class contains both JUnit 4 and JUnit 5 test methods.';

  // Style classification
  const styles = [];
  const hasMockMvc = out.fields.some((f) => f.type === 'MockMvc' || f.type === 'WebTestClient' || f.type === 'TestRestTemplate') || out.methods.some((m) => m.requests.length);
  const targetNames = targets.map((t) => t.name).join(' ');
  if (out.springContext === 'WebMvcTest' || out.springContext === 'WebFluxTest' || hasMockMvc || /(Controller|Resource|Endpoint|Api)\b/.test(cls.name + ' ' + targetNames)) styles.push('Controller / API');
  if (/^(DataJpaTest|DataJdbcTest|JdbcTest|DataMongoTest|JooqTest|DataR2dbcTest|MybatisTest)$/.test(out.springContext) || /(Repository|Dao|Mapper)\b/.test(cls.name.replace(/Tests?$|IT$/, '') + ' ' + targetNames)) styles.push('Repository');
  if (/(Service|ServiceImpl|Manager|Handler|Processor|Facade|UseCase|Engine)(Impl)?\b/.test(cls.name.replace(/Tests?$|IT$/, '') + ' ' + targetNames) || (out.fields.some((f) => f.injectMocks) && !styles.length)) styles.push('Service');
  if (/(Dto|DTO|Request|Response|Entity|Model|Vo|VO|Record|Payload|Bean|Pojo|Domain|Event|Command)\b/.test(cls.name.replace(/Tests?$|IT$/, '') + ' ' + targetNames) || /\.(model|dto|entity|domain|vo|payload)s?(\.|$)/.test(cls.pkg || '')) styles.push('Model / DTO');
  if (/(Util|Utils|Helper|Helpers|Validator|Converter|Formatter|Parser|Calculator|Mapper|Builder|Factory|Constants|Support)\b/.test(cls.name.replace(/Tests?$|IT$/, '') + ' ' + targetNames) || /\.util(s)?(\.|$)/.test(cls.pkg || '')) styles.push('Utility');
  if (out.springContext === 'SpringBootTest' || /IT$|IntegrationTest$/.test(cls.name)) styles.push('Integration');
  if (out.methods.some((m) => m.parameterized) || annNamed(cls.anns, 'RunWith') && /Parameterized|JUnitParamsRunner/.test(annNamed(cls.anns, 'RunWith').args)) styles.push('Parameterized');
  if (out.fields.some((f) => f.mock) || out.methods.some((m) => m.stubs.length || m.verifies.length)) styles.push('Mockito');
  out.styles = uniq(styles);
  out.primaryStyle = out.styles.find((s) => s !== 'Mockito' && s !== 'Parameterized') || (out.styles[0] || 'General');

  out.targets = targets;
  out.mocks = out.fields.filter((f) => f.mock).map((f) => ({ name: f.name, type: f.type, line: f.line }));

  // Commented-out tests anywhere in the class range
  for (const c of ctx.comments || []) {
    if (c.line < cls.startLine || c.line > cls.endLine) continue;
    if (/@(?:Test|ParameterizedTest)\b/.test(c.text) && (/\bvoid\s+\w+\s*\(/.test(c.text) || !c.block)) {
      out.commentedTests.push({ line: c.line, text: truncate(oneLine(c.text), 120) });
    }
  }
  return out;
}

function isAssertionCall(c, fieldMap) {
  const r = c.recv;
  if (ASSERT_FNS.has(c.name)) {
    if (r.kind === 'none') return true;
    if (r.kind === 'name' && (ASSERT_HOLDERS.has(r.name) || /^(softly|soft|softAssertions?|collector|errorCollector|assertions)$/i.test(r.root))) return true;
    if (r.kind === 'name' && fieldMap && fieldMap.has(r.root) && /Soft|ErrorCollector/.test(fieldMap.get(r.root).type)) return true;
    if (r.kind === 'name' && /\.(?:Assert|Assertions|MatcherAssert|Truth)$/.test('.' + r.qualified)) return true;
    return false;
  }
  if (c.name === 'fail' && (r.kind === 'none' || (r.kind === 'name' && ASSERT_HOLDERS.has(r.name)))) return true;
  if (c.name === 'then' && r.kind === 'none' && !c.chainNext.some((n) => n.name === 'should' || n.name === 'shouldHaveNoInteractions' || n.name === 'shouldHaveNoMoreInteractions')) return true;
  if ((c.name === 'verifyComplete' || c.name === 'expectNext' || c.name === 'expectError' || c.name === 'expectErrorMatches' || c.name === 'expectNextCount') && r.kind === 'call') return true;
  return false;
}

function chainMatchers(c) {
  // assertThat(x).a().b() → ['a', 'b']
  const out = [];
  let cur = c;
  let guard = 0;
  while (cur.chainNext.length && guard++ < 40) {
    cur = cur.chainNext[0];
    out.push(cur);
  }
  return out;
}

function mockitoStubs(P, b, fieldMap, localMocks) {
  const stubs = [];
  const isMockVar = (name) => (fieldMap.has(name) && (fieldMap.get(name).mock || fieldMap.get(name).spy)) || localMocks.has(name);
  for (const c of b.calls) {
    const r = c.recv;
    if ((c.name === 'when' || c.name === 'given') && (r.kind === 'none' || (r.kind === 'name' && /^(Mockito|BDDMockito)$/.test(r.name))) && c.close > c.open + 1) {
      const target = b.calls.find((x) => x.parent === c && x.recv.kind === 'name');
      const answer = c.chainNext.find((x) => /^(then|will)(Return|Throw|Answer|CallRealMethod)$/.test(x.name));
      if (!target && !answer) continue;
      if (c.name === 'given' && !answer) continue; // RestAssured given() has no args; BDDMockito given always has an answer
      stubs.push({
        kind: 'stub', style: c.name, mockVar: target ? target.recv.root : '', method: target ? target.name : '', line: c.line,
        throws: !!(answer && /Throw/.test(answer.name)), answer: answer ? answer.name : '',
        answerText: answer ? oneLine(sliceText(P, answer.open, answer.close)) : '', isMock: target ? isMockVar(target.recv.root) : false,
        idx: c.idx, end: answer ? answer.close : c.close,
      });
      continue;
    }
    if (/^(do|will)(Return|Throw|Nothing|Answer|CallRealMethod)$/.test(c.name) && r.kind !== 'call') {
      const w = c.chainNext.find((x) => x.name === 'when' || x.name === 'given');
      if (!w) continue;
      const mockArg = argText(P, w, 0);
      const target = w.chainNext[0];
      stubs.push({
        kind: 'stub', style: c.name, mockVar: mockArg, method: target ? target.name : '', line: c.line, throws: /Throw/.test(c.name),
        answer: c.name, answerText: oneLine(sliceText(P, c.open, c.close)), isMock: isMockVar(mockArg), idx: c.idx, end: target ? target.close : w.close,
      });
    }
  }
  return stubs;
}

function analyzeTestMethod(ctx, tc, tm, fw, fieldMap, helperFacts, helperByName) {
  const { P } = ctx;
  const T = P.T;
  const m = tm.m;
  const name = (tm.prefix ? tm.prefix + '.' : '') + m.name;
  const display = annNamed(m.anns, 'DisplayName');
  const res = {
    name, methodName: m.name, nestedIn: tm.prefix, line: m.line, nameLine: m.nameLine, endLine: m.endLine, annotation: '@' + tm.ta.name,
    framework: annFramework(tm.ta, fw), displayName: display ? (annStrings(display)[0] || '') : '', disabled: false, disabledReason: '',
    mods: m.mods, returnType: m.returnType, params: m.params.length, parameterized: tm.ta.name === 'ParameterizedTest' || tm.ta.name === 'TestTemplate',
    sources: [], assertions: [], verifies: [], stubs: [], requests: [], expects: [], refs: [], unresolved: [], helperCalls: [],
    exceptions: [], scenario: {}, evidence: {}, tries: [], sleeps: [], broadExceptions: [], empty: false, complete: m.complete,
    bodyHash: '', shapeHash: '', literalCount: 0, statements: 0, snippetId: ctx.snippet.id, snippetSeq: ctx.snippet.seq,
    securityAnns: [], expectedViaAnnotation: '', inputLiterals: { nulls: [], empties: [], boundaries: [], numbers: [] },
  };
  const dis = annNamed(m.anns, 'Disabled', 'Ignore') || (tc.disabled ? { name: 'class-level' } : null);
  if (dis) { res.disabled = true; res.disabledReason = dis.args ? oneLine(dis.args).replace(/^"|"$/g, '') : ''; }
  for (const a of m.anns) {
    if (/^(ValueSource|CsvSource|CsvFileSource|MethodSource|EnumSource|NullSource|EmptySource|NullAndEmptySource|ArgumentsSource|FieldSource)$/.test(a.name)) res.sources.push({ name: a.name, args: a.args, line: a.line });
  }
  res.securityAnns = m.anns.filter((a) => SECURITY_ANNOTATIONS.has(a.name)).map((a) => '@' + a.name)
    .concat(tm.owner.anns.filter((a) => SECURITY_ANNOTATIONS.has(a.name)).map((a) => '@' + a.name + ' (class)'));
  if (tm.ta.name === 'Test' && tm.ta.args) {
    const ex = /expected\s*=\s*([\w.]+)\.class/.exec(tm.ta.args);
    if (ex) { res.expectedViaAnnotation = simpleNameOf(ex[1]); res.exceptions.push({ type: simpleNameOf(ex[1]), via: '@Test(expected)', line: tm.ta.line }); }
  }

  if (!m.hasBody) { res.empty = true; return res; }
  const b = scanBody(P, m.bodyStart, m.bodyEnd);
  const bodyToks = T.slice(m.bodyStart + 1, m.bodyEnd);
  res.empty = bodyToks.length === 0;
  res.statements = bodyToks.filter((t) => isOp(t, ';')).length;
  res.bodyHash = hashText(bodyToks.map((t) => t.v).join(' '));
  res.shapeHash = hashText(bodyToks.map((t) => (t.t === 'num' || t.t === 'str' || t.t === 'chr' ? '#' : t.v)).join(' '));
  res.literalCount = bodyToks.filter((t) => t.t === 'num' || t.t === 'str').length;
  res.bodyTokens = bodyToks.length;

  // Local variable types and mocks
  const locals = new Map();
  const localMocks = new Map();
  for (const d of b.decls) {
    let type = d.type;
    let mock = false;
    let spy = false;
    if (d.initIdx >= 0) {
      const it = T[d.initIdx];
      if (isIdent(it, 'new') && isIdent(T[d.initIdx + 1])) { if (type === 'var') type = simpleNameOf(readQualified(P, d.initIdx + 1).name); }
      else if (isIdent(it) && (it.v === 'mock' || it.v === 'spy' || (it.v === 'Mockito' && isIdent(T[d.initIdx + 2]) && /^(mock|spy)$/.test(T[d.initIdx + 2].v)))) {
        const callName = it.v === 'Mockito' ? T[d.initIdx + 2].v : it.v;
        mock = callName === 'mock';
        spy = callName === 'spy';
        const mt = /^\(\s*([\w.]+)\.class/.exec(P.src.slice(T[it.v === 'Mockito' ? d.initIdx + 3 : d.initIdx + 1].pos, T[it.v === 'Mockito' ? d.initIdx + 3 : d.initIdx + 1].pos + 120));
        if (mt && type === 'var') type = simpleNameOf(mt[1]);
      }
    }
    locals.set(d.name, { type: simpleNameOf(type), mock, spy, line: d.line });
    if (mock || spy) localMocks.set(d.name, true);
  }
  for (const p of m.params) {
    locals.set(p.name, { type: simpleNameOf(p.base), mock: p.anns.some((a) => a.name === 'Mock'), spy: false, line: m.nameLine, param: true });
  }
  const varInfo = (name) => locals.get(name) || fieldMap.get(name) || null;
  const isMockVar = (name) => { const v = varInfo(name); return !!(v && (v.mock || v.spy)); };

  // Excluded ranges (assertion / verification / stubbing arguments) for "input" literal scanning
  const excluded = [];
  const verifyRanges = [];

  // ---- Assertions
  for (const c of b.calls) {
    if (!isAssertionCall(c, fieldMap)) continue;
    const matchers = chainMatchers(c);
    const end = matchers.length ? matchers[matchers.length - 1].close : c.close;
    excluded.push([c.idx, end]);
    const text = oneLine(sliceText(P, c.idx, end));
    const a = { fn: c.name, line: c.line, text: truncate(text, 160), matchers: matchers.map((x) => x.name), idx: c.idx, end, kind: 'value' };
    const args = callArgs(P, c);
    const argStr = args.map(([x, y]) => oneLine(sliceText(P, x, y)));
    // Classify
    if (EXCEPTION_ASSERTS.has(c.name)) {
      a.kind = 'exception';
      let type = '';
      const m1 = /^([\w.]+)\.class$/.exec(argStr[0] || '');
      if (m1) type = simpleNameOf(m1[1]);
      const special = /^assertThat(NullPointer|IllegalArgument|IllegalState|IO)Exception$/.exec(c.name);
      if (special) type = special[1] === 'IO' ? 'IOException' : special[1] + 'Exception';
      const inst = matchers.find((x) => /^(isInstanceOf|isExactlyInstanceOf|isOfAnyClassIn)$/.test(x.name));
      if (inst) { const mm = /([\w.]+)\.class/.exec(sliceText(P, inst.open, inst.close)); if (mm) type = simpleNameOf(mm[1]); }
      res.exceptions.push({ type: type || '(unspecified)', via: c.name, line: c.line });
    } else if (c.name === 'assertDoesNotThrow' || c.name === 'assertThatCode' || c.name === 'assertThatNoException') {
      a.kind = 'noThrow';
    } else if (c.name === 'fail') {
      a.kind = 'fail';
    } else if (c.name === 'assertNotNull') {
      a.kind = 'notNull';
      if (/^new\s+[\w.<>]+\s*\(/.test(argStr[argStr.length - 1] || '')) a.tautology = 'assertNotNull on a newly constructed object is always true';
    } else if (c.name === 'assertNull') a.kind = 'null';
    else if (c.name === 'assertTrue' || c.name === 'assertFalse') {
      const cond = argStr[argStr.length - 1] || argStr[0] || '';
      const cond0 = argStr[0] || '';
      if (/^(true|false)$/.test(cond0) || /^(true|false)$/.test(cond)) a.tautology = c.name + '(' + (/^(true|false)$/.test(cond0) ? cond0 : cond) + ') never fails';
      if ((c.name === 'assertTrue' && /^[\w.()]+\s*!=\s*null$/.test(cond0)) || (c.name === 'assertFalse' && /^[\w.()]+\s*==\s*null$/.test(cond0))) a.kind = 'notNull';
      else a.kind = 'truth';
    } else if (c.name === 'assertEquals' || c.name === 'assertSame' || c.name === 'assertArrayEquals' || c.name === 'assertIterableEquals') {
      a.kind = 'equality';
      const vals = argStr.length >= 3 && /^"/.test(argStr[0]) ? argStr.slice(1) : argStr;
      if (vals.length >= 2 && vals[0] === vals[1] && !/\(/.test(vals[0])) a.tautology = 'both sides of ' + c.name + ' are the same expression (' + truncate(vals[0], 40) + ')';
    } else if (c.name === 'assertThat' || c.name === 'then' || c.name === 'assertWithMessage') {
      if (args.length >= 2 && c.name === 'assertThat') {
        a.kind = 'hamcrest';
        const matcherText = argStr[argStr.length - 1];
        a.matchers = [matcherText.split('(')[0]];
        if (/^(?:is\()?\s*(notNullValue|not\(nullValue)\b/.test(matcherText)) a.kind = 'notNull';
      } else {
        a.kind = 'fluent';
        const names = a.matchers.filter((x) => !/^(as|describedAs|withFailMessage|overridingErrorMessage|usingRecursiveComparison|extracting|first|last|element|singleElement|that|isNotNull)$/.test(x));
        if (!names.length && a.matchers.includes('isNotNull')) a.kind = 'notNull';
        else if (!a.matchers.length) a.kind = 'incomplete';
        if (/^(true|false)$/.test(argStr[0] || '') && a.matchers.some((x) => x === 'isTrue' || x === 'isFalse')) a.tautology = 'assertThat(' + argStr[0] + ') is a constant';
      }
    }
    // Status-only vs body for REST responses checked through assertions
    if (/getStatusCode|getStatusCodeValue|statusCode\(\)|HttpStatus\.|\.getStatus\(\)/.test(text) && !/getBody|getHeaders|getContent|body\(\)|jsonPath/.test(text)) a.http = 'status';
    else if (/getBody|getContentAsString|getHeaders|jsonPath|body\(\)/.test(text)) a.http = 'body';
    res.assertions.push(a);
  }

  // ---- Mockito
  const stubs = mockitoStubs(P, b, fieldMap, localMocks);
  for (const s of stubs) { excluded.push([s.idx, s.end]); res.stubs.push(s); }
  for (const c of b.calls) {
    const r = c.recv;
    if (c.name === 'verify' && (r.kind === 'none' || (r.kind === 'name' && (/^(Mockito|BDDMockito)$/.test(r.name) || /inOrder|order/i.test(r.root) || (varInfo(r.root) && varInfo(r.root).type === 'InOrder'))))) {
      const mockArg = argText(P, c, 0);
      const mode = argText(P, c, 1);
      const target = c.chainNext[0];
      if (callArgs(P, c).length === 0) continue; // e.g. mockServer.verify()
      excluded.push([c.idx, target ? target.close : c.close]);
      verifyRanges.push([c.idx, target ? target.close : c.close]);
      res.verifies.push({ mockVar: mockArg, method: target ? target.name : '', mode: mode || 'times(1)', never: /never\(\)|times\(\s*0\s*\)/.test(mode), line: c.line, isMock: isMockVar(mockArg) });
    } else if (/^(verifyNoInteractions|verifyNoMoreInteractions|verifyZeroInteractions)$/.test(c.name)) {
      excluded.push([c.idx, c.close]);
      res.verifies.push({ mockVar: argText(P, c, 0), method: '*', mode: c.name, never: c.name !== 'verifyNoMoreInteractions', line: c.line, isMock: true });
    } else if (c.name === 'should' && r.kind === 'call' && r.call && r.call.name === 'then') {
      const target = c.chainNext[0];
      const mockArg = argText(P, r.call, 0);
      excluded.push([r.call.idx, target ? target.close : c.close]);
      verifyRanges.push([r.call.idx, target ? target.close : c.close]);
      const mode = argText(P, c, 0);
      res.verifies.push({ mockVar: mockArg, method: target ? target.name : '', mode: mode || 'times(1)', never: /never\(\)|times\(\s*0\s*\)/.test(mode), line: c.line, isMock: isMockVar(mockArg) });
    } else if ((c.name === 'shouldHaveNoInteractions' || c.name === 'shouldHaveNoMoreInteractions') && r.kind === 'call') {
      res.verifies.push({ mockVar: r.call ? argText(P, r.call, 0) : '', method: '*', mode: c.name, never: true, line: c.line, isMock: true });
    }
  }

  // ---- API requests & response expectations
  for (const c of b.calls) {
    const r = c.recv;
    if (HTTP_VERBS[c.name] && (r.kind === 'none' || (r.kind === 'name' && /RequestBuilders$|^MockMvcRequestBuilders$|^RestDocumentationRequestBuilders$/.test(r.name)))) {
      let p = c.parent;
      while (p && p.name !== 'perform') p = p.parent;
      if (p || /RequestBuilders/.test(r.name || '')) {
        res.requests.push({ client: 'MockMvc', method: HTTP_VERBS[c.name], path: pathFromArg(P, c, 0), line: c.line, idx: c.idx });
        continue;
      }
    }
    if (c.name === 'request' && r.kind === 'none' && c.parent && c.parent.name === 'perform') {
      const verb = /HttpMethod\.(\w+)/.exec(argText(P, c, 0));
      res.requests.push({ client: 'MockMvc', method: verb ? verb[1] : 'ANY', path: pathFromArg(P, c, 1), line: c.line, idx: c.idx });
      continue;
    }
    // WebTestClient: client.get().uri("/x")
    if (HTTP_VERBS[c.name] && r.kind === 'name' && callArgs(P, c).length === 0) {
      const v = varInfo(r.root);
      if ((v && /WebTestClient|WebClient/.test(v.type)) || /client/i.test(r.root)) {
        const uri = c.chainNext.find((x) => x.name === 'uri');
        res.requests.push({ client: 'WebTestClient', method: HTTP_VERBS[c.name], path: uri ? pathFromArg(P, uri, 0) : null, line: c.line, idx: c.idx });
        continue;
      }
    }
    // RestAssured: given()...when().get("/x")
    if (HTTP_VERBS[c.name] && r.kind === 'call' && callArgs(P, c).length >= 1) {
      let root = c.chainRoot;
      if (root && /^(given|when|with)$/.test(root.name)) {
        res.requests.push({ client: 'RestAssured', method: HTTP_VERBS[c.name], path: pathFromArg(P, c, 0), line: c.line, idx: c.idx });
        continue;
      }
    }
    // TestRestTemplate / RestTemplate
    if ((REST_TEMPLATE_VERBS[c.name] || c.name === 'exchange') && r.kind === 'name') {
      const v = varInfo(r.root);
      if ((v && /RestTemplate|TestRestTemplate/.test(v.type)) || /restTemplate|template/i.test(r.root)) {
        let verb = REST_TEMPLATE_VERBS[c.name];
        if (c.name === 'exchange') { const vm = /HttpMethod\.(\w+)/.exec(argText(P, c, 1)); verb = vm ? vm[1] : 'ANY'; }
        res.requests.push({ client: 'TestRestTemplate', method: verb, path: pathFromArg(P, c, 0), line: c.line, idx: c.idx });
        continue;
      }
    }
  }
  for (const c of b.calls) {
    if (c.name === 'andExpect' || c.name === 'andExpectAll') {
      excluded.push([c.idx, c.close]);
      const inner = b.calls.filter((x) => x.parent === c);
      const head = inner[0];
      if (!head) { res.expects.push({ kind: 'custom', line: c.line, text: callText(P, c) }); continue; }
      const parts = c.name === 'andExpectAll' ? inner : [head];
      for (const h of parts) {
        if (h.name === 'status') {
          const st = h.chainNext[0];
          const n = st ? st.name : '';
          let code = '';
          if (n === 'is' && st) code = argText(P, st, 0);
          const err = ERROR_STATUS.has(n) || /^[45]\d\d$/.test(code);
          res.expects.push({ kind: 'status', status: n || code, error: err, security: SECURITY_STATUS.has(n) || /^40[13]$/.test(code), success: SUCCESS_STATUS.has(n) || /^2\d\d$/.test(code), line: h.line, text: callText(P, h) + (st ? '.' + callText(P, st) : '') });
        } else if (BODY_MATCHERS.has(h.name)) {
          res.expects.push({ kind: h.name === 'header' || h.name === 'cookie' ? 'header' : 'body', line: h.line, text: truncate(callText(P, c), 140) });
        } else {
          res.expects.push({ kind: 'custom', line: h.line, text: truncate(callText(P, c), 140) });
        }
      }
    } else if (c.name === 'expectStatus' && c.recv.kind === 'call') {
      const st = c.chainNext[0];
      const n = st ? st.name : '';
      let code = n === 'isEqualTo' || n === 'value' ? argText(P, st, 0) : '';
      excluded.push([c.idx, st ? st.close : c.close]);
      res.expects.push({ kind: 'status', status: n, error: ERROR_STATUS.has(n) || /^[45]\d\d$/.test(code) || /HttpStatus\.(BAD|NOT_FOUND|UNAUTH|FORBIDDEN|CONFLICT|INTERNAL)/.test(code), security: SECURITY_STATUS.has(n) || /40[13]|UNAUTHORIZED|FORBIDDEN/.test(code), success: SUCCESS_STATUS.has(n) || /^2\d\d$/.test(code), line: c.line, text: callText(P, c) });
    } else if ((c.name === 'expectBody' || c.name === 'expectBodyList' || c.name === 'expectHeader' || c.name === 'expectCookie') && c.recv.kind === 'call') {
      excluded.push([c.idx, c.close]);
      res.expects.push({ kind: c.name === 'expectHeader' || c.name === 'expectCookie' ? 'header' : 'body', line: c.line, text: callText(P, c) });
    } else if (c.name === 'statusCode' && c.recv.kind === 'call' && callArgs(P, c).length) {
      const code = argText(P, c, 0);
      excluded.push([c.idx, c.close]);
      res.expects.push({ kind: 'status', status: code, error: /^[45]\d\d$/.test(code) || /SC_(BAD|NOT_FOUND|UNAUTH|FORBIDDEN|CONFLICT|INTERNAL)/.test(code), security: /^40[13]$/.test(code) || /UNAUTHORIZED|FORBIDDEN/.test(code), success: /^2\d\d$/.test(code) || /SC_OK|SC_CREATED/.test(code), line: c.line, text: callText(P, c) });
    } else if (c.name === 'body' && c.recv.kind === 'call' && c.chainRoot && /^(given|when|then)$/.test(c.chainRoot.name) && callArgs(P, c).length >= 1) {
      excluded.push([c.idx, c.close]);
      if (b.calls.some((x) => x.name === 'then' && x.recv.kind === 'call' && x.idx < c.idx && x.chainRoot === c.chainRoot)) res.expects.push({ kind: 'body', line: c.line, text: callText(P, c) });
    }
  }
  // TestRestTemplate-style status/body checks via plain assertions
  for (const a of res.assertions) {
    if (a.http === 'status') {
      const err = /HttpStatus\.(BAD_REQUEST|NOT_FOUND|UNAUTHORIZED|FORBIDDEN|CONFLICT|INTERNAL_SERVER_ERROR|UNPROCESSABLE_ENTITY|METHOD_NOT_ALLOWED|SERVICE_UNAVAILABLE)|\b[45]\d\d\b/.test(a.text);
      res.expects.push({ kind: 'status', status: a.text, error: err, security: /UNAUTHORIZED|FORBIDDEN|\b40[13]\b/.test(a.text), success: /HttpStatus\.(OK|CREATED|ACCEPTED|NO_CONTENT)|\b2\d\d\b/.test(a.text), line: a.line, text: a.text, viaAssertion: true });
    } else if (a.http === 'body') res.expects.push({ kind: 'body', line: a.line, text: a.text, viaAssertion: true });
  }

  // ---- Try / catch
  for (const tr of b.tries) {
    const inTry = b.calls.filter((c) => within(c.idx, tr.tryOpen, tr.tryClose));
    const tryHasFail = inTry.some((c) => c.name === 'fail' || (c.name === 'assertTrue' && /false/.test(argText(P, c, 0))));
    const catchInfo = tr.catches.map((cb) => {
      const cc = b.calls.filter((c) => within(c.idx, cb.open, cb.close));
      const hasThrow = T.slice(cb.open, cb.close).some((t) => isIdent(t, 'throw'));
      return { types: cb.types, line: cb.line, hasFail: cc.some((c) => c.name === 'fail'), hasThrow, asserts: cc.filter((c) => isAssertionCall(c, fieldMap)).length, empty: cb.close === cb.open + 1 };
    });
    if (!catchInfo.length) continue;
    const ok = tryHasFail || catchInfo.every((ci) => ci.hasFail || ci.hasThrow);
    res.tries.push({ line: tr.line, tryHasFail, catches: catchInfo, swallows: !ok, idiom: tryHasFail && catchInfo.some((ci) => !ci.hasFail) });
    if (tryHasFail) for (const ci of catchInfo) if (!ci.hasFail && !ci.hasThrow) res.exceptions.push({ type: ci.types[0] || 'Exception', via: 'try/fail/catch', line: ci.line });
  }

  // ExpectedException rule / catchThrowable / StepVerifier.expectError
  for (const c of b.calls) {
    if ((c.name === 'expect' || c.name === 'expectMessage') && c.recv.kind === 'name') {
      const v = varInfo(c.recv.root);
      if ((v && v.type === 'ExpectedException') || /^(thrown|exception|expectedException|exceptionRule|expected)$/.test(c.recv.root)) {
        const mm = /([\w.]+)\.class/.exec(argText(P, c, 0));
        if (c.name === 'expect') res.exceptions.push({ type: mm ? simpleNameOf(mm[1]) : '(rule)', via: 'ExpectedException', line: c.line });
        excluded.push([c.idx, c.close]);
        res.assertions.push({ fn: c.recv.root + '.' + c.name, line: c.line, text: callText(P, c), matchers: [], kind: 'exception', idx: c.idx, end: c.close });
      }
    }
    if ((c.name === 'expectError' || c.name === 'expectErrorMatches' || c.name === 'expectErrorMessage') && c.recv.kind === 'call') {
      const mm = /([\w.]+)\.class/.exec(argText(P, c, 0));
      res.exceptions.push({ type: mm ? simpleNameOf(mm[1]) : '(error signal)', via: 'StepVerifier', line: c.line });
    }
    if (c.name === 'sleep' && c.recv.kind === 'name' && (c.recv.name === 'Thread' || /^(SECONDS|MILLISECONDS|MINUTES|MICROSECONDS|NANOSECONDS)$/.test(c.recv.name))) res.sleeps.push({ line: c.line, text: callText(P, c) });
  }
  for (const e of res.exceptions) if (/^(Exception|Throwable|RuntimeException|Error)$/.test(e.type)) res.broadExceptions.push(e);

  // ---- Helper calls (custom assertions in the same class)
  for (const c of b.calls) {
    if (c.recv.kind !== 'none' && c.recv.kind !== 'this') continue;
    if (helperFacts.has(c.name)) {
      const f = helperFacts.get(c.name);
      res.helperCalls.push({ name: c.name, line: c.line, asserts: f.asserts, verifies: f.verifies, expects: f.expects, known: true });
    } else if (/^(assert|verify|check|expect|validate|should|ensure)[A-Z_]/.test(c.name) && !ASSERT_FNS.has(c.name) && c.name !== 'verifyNoInteractions' && c.name !== 'verifyNoMoreInteractions') {
      res.helperCalls.push({ name: c.name, line: c.line, asserts: 0, verifies: 0, expects: 0, known: false });
    }
  }

  // ---- Production references
  const inRange = (idx) => excluded.some(([x, y]) => idx >= x && idx <= y);
  const typeOfCallMemo = new Map();
  const typeOfCall = (c) => {
    if (c.isCtor) return c.name;
    if (typeOfCallMemo.has(c)) return typeOfCallMemo.get(c);
    typeOfCallMemo.set(c, null);
    let t = null;
    const recvType = receiverType(c);
    if (recvType && ctx.prod) {
      const pc = ctx.prod.resolve(recvType, ctx.unit);
      if (pc) {
        const pm = pc.methodsByName.get(c.name);
        if (pm && pm.length && pm[0].returnBase) t = simpleNameOf(pm[0].returnBase);
      }
    }
    typeOfCallMemo.set(c, t);
    return t;
  };
  const receiverType = (c) => {
    const r = c.recv;
    if (r.kind === 'name') {
      if (r.qualified.indexOf('.') < 0 || r.thisRef) {
        const v = varInfo(r.root);
        if (v) return v.type;
        if (/^[A-Z]/.test(r.root)) return r.root; // static call on a type
        return null;
      }
      // a.b.c → static nested access or field chain; take last capitalised segment
      const segs = r.qualified.split('.');
      const v = varInfo(segs[0]);
      if (v) return null;
      for (let i = segs.length - 1; i >= 0; i--) if (/^[A-Z]/.test(segs[i])) return segs[i];
      return null;
    }
    if (r.kind === 'call' && r.call) return typeOfCall(r.call);
    return null;
  };
  const staticImports = new Map();
  for (const imp of ctx.unit ? ctx.unit.imports : []) {
    if (!imp.isStatic) continue;
    const segs = imp.name.split('.');
    const member = segs.pop();
    const owner = segs[segs.length - 1];
    if (member === '*') staticImports.set('*' + owner, owner);
    else staticImports.set(member, owner);
  }

  const seenRef = new Set();
  const pushRef = (ref) => {
    const key = ref.cls + '#' + ref.method + '#' + ref.basis + '#' + ref.viaMock + '#' + ref.line;
    if (seenRef.has(key)) return;
    seenRef.add(key);
    res.refs.push(ref);
  };
  for (const c of b.calls) {
    if (c.isCtor || isAssertionCall(c, fieldMap)) continue;
    const r = c.recv;
    let typeName = null;
    let basis = 'typed';
    let viaMock = false;
    let viaSpy = false;
    if (r.kind === 'name') {
      const v = r.qualified.indexOf('.') < 0 || r.thisRef ? varInfo(r.root) : null;
      if (v) { typeName = v.type; viaMock = !!v.mock; viaSpy = !!v.spy; }
      else { typeName = receiverType(c); basis = 'static'; }
    } else if (r.kind === 'call') {
      typeName = receiverType(c);
      basis = 'chain';
    } else if (r.kind === 'none') {
      if (staticImports.has(c.name)) { typeName = staticImports.get(c.name); basis = 'static-import'; }
    }
    const inStub = res.stubs.some((s) => c.idx > s.idx && c.idx <= s.end);
    const inVerify = verifyRanges.some(([x, y]) => c.idx > x && c.idx <= y);
    if (typeName && ctx.prod) {
      const pc = ctx.prod.resolve(typeName, ctx.unit);
      if (pc) {
        pushRef({ cls: pc.fqcn, method: c.name, argc: callArgs(P, c).length, basis, viaMock: viaMock || inStub || inVerify, viaSpy, inStub, inVerify, line: c.line, inAssertion: inRange(c.idx) && !inStub && !inVerify });
        continue;
      }
    }
    if (!typeName && (r.kind === 'call' || r.kind === 'name') && !ASSERT_FNS.has(c.name)) {
      res.unresolved.push({ method: c.name, line: c.line, viaMock: inStub || inVerify });
    }
  }
  // An exception class the test expects is constructed when the code under test throws it.
  for (const e of res.exceptions) {
    if (!ctx.prod || !e.type || /^\(/.test(e.type)) continue;
    const pc = ctx.prod.resolve(e.type, ctx.unit);
    if (pc) pushRef({ cls: pc.fqcn, method: '<init>', argc: -1, basis: 'thrown', viaMock: false, line: e.line });
  }
  for (const nw of b.news) {
    if (!ctx.prod) break;
    const pc = ctx.prod.resolve(nw.type, ctx.unit);
    if (pc) pushRef({ cls: pc.fqcn, method: '<init>', argc: -1, basis: 'ctor', viaMock: false, line: nw.line });
  }
  for (const rf of b.refs) {
    if (!ctx.prod) break;
    let typeName = rf.target;
    const v = varInfo(rf.target);
    if (v) typeName = v.type;
    const pc = typeName ? ctx.prod.resolve(typeName, ctx.unit) : null;
    if (pc) pushRef({ cls: pc.fqcn, method: rf.name === 'new' ? '<init>' : rf.name, argc: -1, basis: 'method-ref', viaMock: !!(v && v.mock), line: rf.line });
  }

  // ---- Input literals. A literal counts as test input unless its innermost
  // enclosing call is an expectation: an assertion's own argument (the
  // expected value), a matcher, a Mockito stub/verify argument, a call on a
  // mock, or a MockMvc expectation. So in assertEquals(5, calc.add(2, 3)) the
  // 2 and 3 are inputs and the 5 is not; inside assertThrows(() -> …) the
  // lambda body is input.
  const callAt = (idx) => {
    let best = null;
    for (const c of b.calls) if (c.open < idx && c.close > idx && (!best || c.open > best.open)) best = c;
    return best;
  };
  // Innermost call or constructor call that encloses a token.
  const containerAt = (idx) => {
    let best = callAt(idx);
    for (const nw of b.news) if (nw.open < idx && nw.close > idx && (!best || nw.open > best.open)) best = Object.assign({ isNew: true }, nw);
    return best;
  };
  const inExpectChain = (c) => {
    for (let p = c; p; p = p.parent) if (p.name === 'andExpect' || p.name === 'andExpectAll' || p.name === 'expectStatus' || p.name === 'expectBody') return true;
    return false;
  };
  const callExcludes = (c) => {
    if (isAssertionCall(c, fieldMap)) return !LAMBDA_ASSERTS.has(c.name);
    if (c.chainRoot !== c && isAssertionCall(c.chainRoot, fieldMap)) return true; // assertThat(x).isEqualTo(5)
    if (c.recv.kind === 'none' && c.parent && isAssertionCall(c.parent, fieldMap) && !LAMBDA_ASSERTS.has(c.parent.name)) return true; // hamcrest is(5)
    if (MOCKITO_CALLS.has(c.name)) return true;
    if (c.recv.kind === 'name' && isMockVar(c.recv.root)) return true;
    return inExpectChain(c);
  };
  const underMockito = (c) => {
    for (let p = c; p; p = p.parent) if (MOCKITO_CALLS.has(p.name) || (p.recv.kind === 'name' && isMockVar(p.recv.root))) return true;
    return false;
  };
  const literalExcluded = (k) => {
    const c = containerAt(k);
    if (!c) return false;
    if (c.isNew) return !!c.parent && (callExcludes(c.parent) || underMockito(c.parent));
    return callExcludes(c) || underMockito(c);
  };
  for (let k = m.bodyStart + 1; k < m.bodyEnd; k++) {
    const t = T[k];
    if ((t.t === 'num' || t.t === 'str' || isIdent(t, 'null') || t.t === 'id') && literalExcluded(k)) continue;
    const prev = T[k - 1];
    const next = T[k + 1];
    if (isIdent(t, 'null')) {
      if ((prev && (isOp(prev, '==') || isOp(prev, '!='))) || (next && (isOp(next, '==') || isOp(next, '!=')))) continue;
      if (prev && isOp(prev, '=') && T[k - 2] && T[k - 2].t === 'id' && isOp(next, ';')) { res.inputLiterals.nulls.push({ line: t.line, text: 'variable initialised to null' }); continue; }
      const c = containerAt(k);
      if (c || isOp(prev, ',')) res.inputLiterals.nulls.push({ line: t.line, text: c ? (c.isNew ? 'null passed to new ' + c.type + '(…)' : truncate(callText(P, c), 80)) : 'null argument' });
      continue;
    }
    if (t.t === 'str' && /^"\s*"$/.test(t.v)) {
      const c = callAt(k);
      if (c && INDEX_CALLS.has(c.name)) continue;
      res.inputLiterals.empties.push({ line: t.line, text: (t.v === '""' ? 'empty string' : 'blank string') + (c ? ' in ' + truncate(callText(P, c), 70) : '') });
      continue;
    }
    if (t.t === 'id' && /^(emptyList|emptySet|emptyMap|emptyIterator|emptyCollection|emptyIterable)$/.test(t.v) && isOp(next, '(')) {
      res.inputLiterals.empties.push({ line: t.line, text: t.v + '()' });
      continue;
    }
    if (t.t === 'id' && t.v === 'of' && isOp(prev, '.') && /^(List|Set|Map|Stream|ImmutableList|ImmutableSet)$/.test((T[k - 2] || {}).v) && isOp(next, '(') && isOp(T[k + 2], ')')) {
      res.inputLiterals.empties.push({ line: t.line, text: T[k - 2].v + '.of()' });
      continue;
    }
    if (t.t === 'id' && /^(MAX_VALUE|MIN_VALUE|POSITIVE_INFINITY|NEGATIVE_INFINITY|NaN|MAX|MIN|EPOCH)$/.test(t.v) && isOp(prev, '.')) {
      res.inputLiterals.boundaries.push({ line: t.line, text: (T[k - 2] ? T[k - 2].v + '.' : '') + t.v });
      continue;
    }
    if (t.t === 'id' && t.v === 'ZERO' && isOp(prev, '.')) { res.inputLiterals.boundaries.push({ line: t.line, text: (T[k - 2] ? T[k - 2].v : '') + '.ZERO' }); continue; }
    if (t.t === 'num') {
      const c = callAt(k);
      if (c && INDEX_CALLS.has(c.name)) continue;
      const neg = prev && isOp(prev, '-') && T[k - 2] && (isOp(T[k - 2], '(') || isOp(T[k - 2], ',') || isOp(T[k - 2], '=') || isIdent(T[k - 2], 'return'));
      const raw = t.v.replace(/[_lLfFdD]/g, '');
      const val = Number(raw);
      res.inputLiterals.numbers.push({ value: neg ? -val : val, line: t.line });
      if (Number.isFinite(val) && (val === 0 || neg)) res.inputLiterals.boundaries.push({ line: t.line, text: (neg ? '-' : '') + t.v + (c ? ' in ' + truncate(callText(P, c), 60) : '') });
    }
    if (t.t === 'str') {
      // numbers embedded in JSON bodies or CSV rows still count as candidate input values
      const s = unquote(t.v);
      const nums = s.match(/-?\d+(?:\.\d+)?/g);
      if (nums && nums.length <= 50) for (const x of nums) res.inputLiterals.numbers.push({ value: Number(x), line: t.line, inString: true });
      if (/:\s*null\b/.test(s)) res.inputLiterals.nulls.push({ line: t.line, text: 'null value in request body' });
      if (/:\s*"\s*"/.test(s)) res.inputLiterals.empties.push({ line: t.line, text: 'empty or blank value in request body' });
    }
  }
  for (const src of res.sources) {
    if (src.name === 'NullSource' || src.name === 'NullAndEmptySource') res.inputLiterals.nulls.push({ line: src.line, text: '@' + src.name });
    if (src.name === 'EmptySource' || src.name === 'NullAndEmptySource') res.inputLiterals.empties.push({ line: src.line, text: '@' + src.name });
    const nums = (src.args || '').match(/-?\d+(?:\.\d+)?/g) || [];
    for (const x of nums) { const v = Number(x); res.inputLiterals.numbers.push({ value: v, line: src.line, inSource: true }); if (v === 0 || v < 0) res.inputLiterals.boundaries.push({ line: src.line, text: x + ' in @' + src.name }); }
    if (/MAX_VALUE|MIN_VALUE/.test(src.args || '')) res.inputLiterals.boundaries.push({ line: src.line, text: 'MAX/MIN value in @' + src.name });
    if (/"\s*"|''|\bnull\b/i.test(src.args || '')) res.inputLiterals.empties.push({ line: src.line, text: 'empty/blank value in @' + src.name });
    if (src.name === 'MethodSource' && src.args) {
      const fname = (annStrings({ args: src.args })[0] || m.name).split('#').pop();
      const factory = helperByName.get(fname);
      if (factory) {
        for (let k = factory.bodyStart + 1; k < factory.bodyEnd; k++) {
          const t = T[k];
          if (isIdent(t, 'null')) res.inputLiterals.nulls.push({ line: t.line, text: 'null in @MethodSource ' + fname });
          if (t.t === 'str' && /^"\s*"$/.test(t.v)) res.inputLiterals.empties.push({ line: t.line, text: 'empty string in @MethodSource ' + fname });
          if (t.t === 'num') { const neg = isOp(T[k - 1], '-'); const v = Number(t.v.replace(/[_lLfFdD]/g, '')) * (neg ? -1 : 1); res.inputLiterals.numbers.push({ value: v, line: t.line, inSource: true }); if (v <= 0) res.inputLiterals.boundaries.push({ line: t.line, text: (neg ? '-' : '') + t.v + ' in @MethodSource ' + fname }); }
          if (t.t === 'id' && /^(MAX_VALUE|MIN_VALUE)$/.test(t.v)) res.inputLiterals.boundaries.push({ line: t.line, text: t.v + ' in @MethodSource ' + fname });
        }
      }
    }
  }

  // ---- Scenario classification (code evidence first; the method name only supports it)
  const words = splitWords(m.name) + ' ' + res.displayName.toLowerCase();
  const errorStatus = res.expects.filter((e) => e.kind === 'status' && e.error);
  const successStatus = res.expects.filter((e) => e.kind === 'status' && e.success);
  const throwStubs = res.stubs.filter((s) => s.throws);
  const emptyStubs = res.stubs.filter((s) => /Optional\.empty\(\)|emptyList\(\)|List\.of\(\)|\(\s*null\s*\)|Collections\.empty/.test(s.answerText));
  const securityCalls = b.calls.filter((c) => (c.name === 'with' && b.calls.some((x) => x.parent === c && SECURITY_POSTPROCESSORS.has(x.name))) ||
    (c.name === 'header' && /Authorization|AUTHORIZATION|Bearer/i.test(argText(P, c, 0))) || c.name === 'setBearerAuth' || c.name === 'withBasicAuth' || c.name === 'auth' || c.name === 'headerAuth');
  // Validation outcomes: assertFalse(validator.isValid(x)) / assertThat(x.isAllowed()).isFalse(), or a
  // parameterized validity check whose rows include an expected false.
  const VALIDITY = /\b(?:is|has|can|check|validate|accepts?|supports?|matches|allows?)\w*\s*\(|Valid\w*\s*\(/;
  const rejections = res.assertions.filter((a) => VALIDITY.test(a.text) && (
    (a.fn === 'assertFalse') || (a.matchers || []).includes('isFalse') ||
    (res.sources.some((src) => /\bfalse\b/i.test(src.args || '')) && /assertEquals|assertThat|isEqualTo/.test(a.fn + ' ' + (a.matchers || []).join(' ')))));
  const securityStatus = res.expects.filter((e) => e.kind === 'status' && e.security);
  const accessDenied = res.exceptions.filter((e) => /AccessDenied|Authentication|Unauthori[sz]ed|Forbidden|Security/.test(e.type));
  const validations = res.assertions.length + res.verifies.length + res.expects.filter((e) => !e.viaAssertion).length + res.helperCalls.reduce((n, h) => n + (h.asserts + h.verifies + h.expects), 0) + (res.expectedViaAnnotation ? 1 : 0);
  res.validationCount = validations;
  res.checkCount = res.assertions.length + res.expects.filter((e) => !e.viaAssertion).length;

  const ev = {
    exception: [].concat(
      res.exceptions.map((e) => e.via + ' ' + e.type + ' (line ' + e.line + ')'),
      throwStubs.map((s) => 'collaborator stubbed to throw — exception-handling path (line ' + s.line + ')'),
      res.tries.filter((tr) => tr.swallows).map((tr) => 'catches ' + (tr.catches[0].types.join(' | ') || 'an exception') + ' without fail() (line ' + tr.line + ')'),
    ),
    negative: [].concat(
      errorStatus.map((e) => 'expects error status ' + e.status + ' (line ' + e.line + ')'),
      emptyStubs.map((s) => 'collaborator stubbed to return empty/null (line ' + s.line + ')'),
      rejections.map((a) => 'asserts the input is rejected: ' + truncate(a.text, 70) + ' (line ' + a.line + ')'),
    ),
    boundary: res.inputLiterals.boundaries.map((x) => x.text + ' (line ' + x.line + ')'),
    nullEmpty: [].concat(
      res.inputLiterals.nulls.map((x) => x.text + ' (line ' + x.line + ')'),
      res.inputLiterals.empties.map((x) => x.text + ' (line ' + x.line + ')'),
    ),
    security: [].concat(res.securityAnns, securityCalls.map((c) => truncate(callText(P, c), 60) + ' (line ' + c.line + ')'), securityStatus.map((e) => 'expects ' + e.status + ' (line ' + e.line + ')'), accessDenied.map((e) => 'expects ' + e.type)),
  };
  ev.negative = ev.exception.concat(ev.negative);
  // A positive (happy-path) scenario is about the inputs and set-up, not about
  // how well the outcome is checked — weak checks are reported separately.
  const exercises = res.requests.length > 0 || res.refs.some((r) => !r.viaMock) || res.unresolved.some((u) => !u.viaMock);
  // Parameter rows that mix accepted and rejected inputs cover both paths.
  const mixedRows = res.sources.some((src) => /\btrue\b/i.test(src.args || '') && /\bfalse\b/i.test(src.args || ''));
  const blockingNegative = ev.exception.length || errorStatus.length || emptyStubs.length || (rejections.length && !mixedRows);
  const positiveCode = successStatus.length > 0 || (!blockingNegative && (validations > 0 || exercises));
  ev.positive = positiveCode ? [successStatus.length ? 'expects success status ' + successStatus[0].status : validations ? 'checks the outcome without error-path set-up' : 'exercises the code without error-path set-up (no checks)'] : [];
  res.evidence = ev;
  const nameHints = {
    negative: NEGATIVE_WORDS.test(words), boundary: BOUNDARY_WORDS.test(words), nullEmpty: NULL_WORDS.test(words), security: SECURITY_WORDS.test(words),
    exception: /(throw|exception)/i.test(words), positive: /(success|valid|happy|should(?!.*(fail|throw|reject))|returns?|creates?|saves?)/i.test(words) && !NEGATIVE_WORDS.test(words),
  };
  // Name hints are shown only for scenarios that might otherwise be missed, and never against code evidence.
  nameHints.positive = false;
  if (ev.positive.length) nameHints.negative = false;
  for (const tag of ['positive', 'negative', 'exception', 'boundary', 'nullEmpty', 'security']) {
    res.scenario[tag] = ev[tag].length ? 'code' : nameHints[tag] ? 'name' : '';
  }
  res.securityUnauth = securityStatus.length > 0 || accessDenied.length > 0;
  res.securityAuth = res.securityAnns.length > 0 || securityCalls.length > 0;
  res.statusOnly = res.requests.length > 0 && res.expects.some((e) => e.kind === 'status') && !res.expects.some((e) => e.kind !== 'status') &&
    !res.assertions.some((a) => a.http !== 'status') && res.verifies.length === 0 && !res.helperCalls.some((h) => h.asserts || h.verifies || !h.known);
  res.hasBodyCheck = res.expects.some((e) => e.kind === 'body' || e.kind === 'header' || e.kind === 'custom') || res.assertions.some((a) => a.http === 'body');
  return res;
}
