/* ------------------------------------------------------------------------
 * Structural Java parser.
 *
 * Not a compiler: it recovers the declarations a reviewer cares about
 * (package, imports, types, fields, methods, annotations, line spans) from
 * the token stream, and tolerates partial or truncated pastes instead of
 * failing. Anything it had to guess about is reported in `issues`.
 * --------------------------------------------------------------------- */

const PRIMITIVES = new Set(['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'void', 'var']);

// Pair every bracket with its partner in one pass. Unmatched → -1.
function computeMatches(T) {
  const M = new Int32Array(T.length).fill(-1);
  const stack = [];
  let stray = 0;
  for (let k = 0; k < T.length; k++) {
    const t = T[k];
    if (t.t !== 'op') continue;
    const v = t.v;
    if (v === '(' || v === '[' || v === '{') { stack.push(k); continue; }
    if (v !== ')' && v !== ']' && v !== '}') continue;
    const want = v === ')' ? '(' : v === ']' ? '[' : '{';
    let found = -1;
    for (let s = stack.length - 1; s >= 0; s--) {
      if (T[stack[s]].v === want) { found = s; break; }
      if (want !== '{' && T[stack[s]].v === '{') break; // a ")" never closes past a "{"
    }
    if (found < 0) { stray++; continue; }
    const open = stack[found];
    stack.length = found;
    M[open] = k;
    M[k] = open;
  }
  return { M, unclosed: stack.length, stray };
}

function parseJava(input) {
  const lex = tokenizeJava(input);
  const T = lex.tokens;
  const { M, unclosed, stray } = computeMatches(T);
  const src = lex.src;
  const P = { src, T, M, lines: src.split('\n') };
  const issues = lex.problems.slice();
  if (unclosed) issues.push({ kind: 'unbalanced', line: T.length ? T[T.length - 1].line : 1, message: plural(unclosed, 'bracket') + ' opened but never closed — the paste appears to be cut off.' });
  if (stray) issues.push({ kind: 'unbalanced', line: 1, message: plural(stray, 'closing bracket') + ' with no matching opening bracket — the paste may start part-way through a block.' });

  const units = [];
  let unit = newUnit();
  let k = 0;

  function newUnit() {
    return { pkg: null, pkgLine: null, imports: [], types: [], fragment: null, firstLine: null };
  }
  function flush() {
    if (unit.types.length || unit.fragment || unit.pkg || unit.imports.length) units.push(unit);
    unit = newUnit();
  }

  while (k < T.length) {
    const t = T[k];
    if (unit.firstLine == null) unit.firstLine = t.line;

    if (isIdent(t, 'package') && isIdent(T[k + 1])) {
      if (unit.types.length || unit.fragment) flush();
      const q = readQualified(P, k + 1);
      unit.pkg = q.name;
      unit.pkgLine = t.line;
      unit.firstLine = unit.firstLine == null ? t.line : unit.firstLine;
      k = isOp(T[q.next], ';') ? q.next + 1 : q.next;
      continue;
    }
    if (isIdent(t, 'import') && (isIdent(T[k + 1]))) {
      if (unit.types.length || unit.fragment) flush();
      let s = k + 1;
      let isStatic = false;
      if (isIdent(T[s], 'static')) { isStatic = true; s++; }
      const q = readQualified(P, s, true);
      unit.imports.push({ name: q.name, isStatic, line: t.line });
      k = isOp(T[q.next], ';') ? q.next + 1 : q.next;
      continue;
    }
    if (isOp(t, ';')) { k++; continue; }
    if (t.t === 'op' && (t.v === '}' || t.v === ')' || t.v === ']') && M[k] < 0) { k++; continue; }

    const r = parseMember(P, k, null);
    if (r.kind === 'type') {
      unit.types.push(r.decl);
    } else if (r.kind === 'method' || r.kind === 'field' || r.kind === 'stmt' || r.kind === 'init') {
      if (!unit.fragment) unit.fragment = newFragment(t.line);
      const f = unit.fragment;
      if (r.kind === 'method') { r.decl.owner = f; f.methods.push(r.decl); }
      if (r.kind === 'field') for (const d of r.decls) { d.owner = f; f.fields.push(d); }
      if (r.kind === 'stmt') f.looseStatements++;
      f.endLine = T[Math.max(0, Math.min(r.next, T.length) - 1)].line;
    }
    k = r.next > k ? r.next : k + 1;
  }
  flush();

  for (const u of units) {
    for (const ty of u.types) assignNames(ty, u.pkg, null);
    if (u.fragment) assignNames(u.fragment, u.pkg, null);
  }

  return { src, tokens: T, M, comments: lex.comments, lines: P.lines, units, issues };
}

function newFragment(line) {
  return {
    kind: 'fragment', name: '', anns: [], mods: [], ext: [], impl: [], fields: [], methods: [], types: [],
    startLine: line, nameLine: line, endLine: line, complete: false, looseStatements: 0, enumConstants: [], recordComponents: [],
  };
}

function assignNames(ty, pkg, outer) {
  ty.pkg = pkg;
  ty.outer = outer;
  const chain = outer ? outer.chain.concat([ty.name]) : [ty.name];
  ty.chain = chain;
  ty.fqcn = (pkg ? pkg + '.' : '') + chain.join('.');
  ty.binaryName = (pkg ? pkg.replace(/\./g, '/') + '/' : '') + chain.join('$');
  ty.simpleName = ty.name;
  for (const m of ty.methods) m.owner = ty;
  for (const f of ty.fields) f.owner = ty;
  for (const n of ty.types) assignNames(n, pkg, ty);
}

function readQualified(P, k, allowStar) {
  const T = P.T;
  let name = '';
  while (k < T.length) {
    if (isIdent(T[k])) { name += T[k].v; k++; }
    else if (allowStar && isOp(T[k], '*')) { name += '*'; k++; }
    else break;
    if (isOp(T[k], '.')) { name += '.'; k++; } else break;
  }
  return { name, next: k };
}

function readAnnotation(P, k) {
  // T[k] is '@'
  const T = P.T;
  const q = readQualified(P, k + 1);
  const ann = { qname: q.name, name: simpleNameOf(q.name), line: T[k].line, args: '', argOpen: -1, argClose: -1 };
  let next = q.next;
  if (isOp(T[next], '(')) {
    const close = P.M[next];
    ann.argOpen = next;
    ann.argClose = close < 0 ? T.length - 1 : close;
    const from = T[next].end;
    const to = close < 0 ? P.src.length : T[close].pos;
    ann.args = P.src.slice(from, to);
    next = close < 0 ? T.length : close + 1;
  }
  return { ann, next };
}

function skipAngles(T, k) {
  // T[k] is '<'. Generic brackets are not paired by computeMatches.
  let depth = 0;
  for (; k < T.length; k++) {
    const t = T[k];
    if (t.t !== 'op') continue;
    if (t.v === '<') depth++;
    else if (t.v === '>') { depth--; if (depth === 0) return k + 1; }
    else if (t.v === '>>=' || t.v === '>=') { depth--; if (depth <= 0) return k + 1; }
    else if (t.v === ';' || t.v === '{' || t.v === '}' || t.v === '(' || t.v === ')') return k; // malformed
  }
  return k;
}

function readType(P, k) {
  const T = P.T;
  const start = k;
  while (isOp(T[k], '@') && isIdent(T[k + 1]) && T[k + 1].v !== 'interface') {
    k = readAnnotation(P, k).next;
  }
  if (!isIdent(T[k])) return null;
  if (JAVA_KEYWORDS.has(T[k].v) && !PRIMITIVES.has(T[k].v)) return null;
  const typeStart = k;
  let base = T[k].v;
  k++;
  for (;;) {
    if (isOp(T[k], '<')) k = skipAngles(T, k);
    if (isOp(T[k], '.') && isIdent(T[k + 1])) { base += '.' + T[k + 1].v; k += 2; continue; }
    break;
  }
  while (isOp(T[k], '[') && isOp(T[k + 1], ']')) k += 2;
  let varargs = false;
  if (isOp(T[k], '...')) { varargs = true; k++; }
  const text = P.src.slice(T[typeStart].pos, T[k - 1].end);
  return { base, text: text.replace(/\s+/g, ' '), varargs, next: k, start };
}

function sliceText(P, a, b) {
  // Source text from token a to token b inclusive.
  if (a < 0 || b < a) return '';
  const T = P.T;
  return P.src.slice(T[a].pos, T[Math.min(b, T.length - 1)].end);
}

function splitTopLevel(P, open, close, sep) {
  // Split tokens strictly between open and close at `sep`, respecting all brackets.
  const T = P.T;
  const parts = [];
  let cur = open + 1;
  let angle = 0;
  for (let k = open + 1; k < close; k++) {
    const t = T[k];
    if (t.t === 'op' && (t.v === '(' || t.v === '[' || t.v === '{')) { const m = P.M[k]; if (m > k) k = m; continue; }
    if (isOp(t, '<')) angle++;
    else if (isOp(t, '>')) angle = Math.max(0, angle - 1);
    else if (isOp(t, sep) && angle === 0) { parts.push([cur, k - 1]); cur = k + 1; }
  }
  if (cur <= close - 1) parts.push([cur, close - 1]);
  return parts;
}

function parseParams(P, open, close) {
  const T = P.T;
  const params = [];
  if (close < 0) return params;
  for (const [a, b] of splitTopLevel(P, open, close, ',')) {
    let k = a;
    const anns = [];
    let isFinal = false;
    while (k <= b) {
      if (isOp(T[k], '@') && isIdent(T[k + 1])) { const r = readAnnotation(P, k); anns.push(r.ann); k = r.next; continue; }
      if (isIdent(T[k], 'final')) { isFinal = true; k++; continue; }
      break;
    }
    const nameTok = T[b];
    const ty = readType(P, k);
    if (!ty || !isIdent(nameTok)) continue;
    params.push({ type: ty.text, base: ty.base, name: nameTok.v, anns, isFinal, varargs: ty.varargs });
  }
  return params;
}

// Skip one statement/expression at member level (used for fragments and recovery).
function skipStatement(P, k) {
  const T = P.T;
  while (k < T.length) {
    const t = T[k];
    if (t.t === 'op') {
      if (t.v === ';') return k + 1;
      if (t.v === '}' ) return P.M[k] < 0 ? k + 1 : k;
      if (t.v === '(' || t.v === '[') { const m = P.M[k]; k = m < 0 ? T.length : m + 1; continue; }
      if (t.v === '{') {
        const m = P.M[k];
        if (m < 0) return T.length;
        k = m + 1;
        const nx = T[k];
        if (!nx || !((nx.t === 'op' && (nx.v === ')' || nx.v === '.' || nx.v === ',' || nx.v === ';')) || isIdent(nx, 'else') || isIdent(nx, 'catch') || isIdent(nx, 'finally') || isIdent(nx, 'while'))) return k;
        continue;
      }
    }
    k++;
  }
  return k;
}

function parseMember(P, i, owner) {
  const T = P.T;
  let k = i;
  const anns = [];
  const mods = [];
  for (;;) {
    if (isOp(T[k], '@') && isIdent(T[k + 1]) && T[k + 1].v !== 'interface') {
      const r = readAnnotation(P, k);
      anns.push(r.ann);
      k = r.next;
      continue;
    }
    if (isIdent(T[k]) && MODIFIERS.has(T[k].v)) {
      // `default` inside an annotation body or switch is not a modifier; at member level it is.
      mods.push(T[k].v);
      k++;
      continue;
    }
    if (isIdent(T[k], 'non') && isOp(T[k + 1], '-') && isIdent(T[k + 2], 'sealed')) { mods.push('non-sealed'); k += 3; continue; }
    break;
  }
  const first = T[i];
  const startLine = first ? first.line : 1;
  if (k >= T.length) return { kind: 'none', next: k };
  const t = T[k];

  // Type declarations
  const isRecord = isIdent(t, 'record') && isIdent(T[k + 1]) && (isOp(T[k + 2], '(') || isOp(T[k + 2], '<'));
  if (isIdent(t, 'class') || isIdent(t, 'interface') || isIdent(t, 'enum') || isRecord || (isOp(t, '@') && isIdent(T[k + 1], 'interface'))) {
    return parseType(P, k, anns, mods, startLine, owner);
  }

  // Initializer block
  if (isOp(t, '{')) {
    const m = P.M[k];
    return { kind: 'init', next: m < 0 ? T.length : m + 1 };
  }

  // Generic method type parameters
  if (isOp(t, '<')) k = skipAngles(T, k);

  // Constructor: Name(
  if (isIdent(T[k]) && isOp(T[k + 1], '(') && !JAVA_KEYWORDS.has(T[k].v)) {
    const close = P.M[k + 1];
    const after = close < 0 ? null : T[close + 1];
    const looksDecl = after && (isOp(after, '{') || isIdent(after, 'throws'));
    if ((owner && owner.name === T[k].v) || (!owner && looksDecl && /^[A-Z]/.test(T[k].v))) {
      return finishMethod(P, k, k + 1, anns, mods, startLine, null, true);
    }
    if (!owner || !looksDecl) return { kind: 'stmt', next: skipStatement(P, k) };
  }

  // Compact record constructor: Name {
  if (owner && owner.kind === 'record' && isIdent(T[k], owner.name) && isOp(T[k + 1], '{')) {
    const m = P.M[k + 1];
    const decl = {
      name: owner.name, ctor: true, compact: true, returnType: null, params: [], anns, mods, throws: [],
      line: startLine, nameLine: T[k].line, endLine: m < 0 ? T[T.length - 1].line : T[m].line,
      bodyStart: k + 1, bodyEnd: m < 0 ? T.length - 1 : m, hasBody: true, complete: m >= 0,
    };
    return { kind: 'method', decl, next: m < 0 ? T.length : m + 1 };
  }

  const ty = readType(P, k);
  if (!ty) return { kind: 'stmt', next: skipStatement(P, k) };
  k = ty.next;
  const nameTok = T[k];
  if (!isIdent(nameTok) || JAVA_KEYWORDS.has(nameTok.v)) return { kind: 'stmt', next: skipStatement(P, i === k ? k + 1 : k) };

  if (isOp(T[k + 1], '(')) {
    const close = P.M[k + 1];
    let after = close < 0 ? T.length : close + 1;
    while (isOp(T[after], '[') && isOp(T[after + 1], ']')) after += 2;
    const a = T[after];
    if (!a || isOp(a, '{') || isOp(a, ';') || isIdent(a, 'throws') || isIdent(a, 'default')) {
      return finishMethod(P, k, k + 1, anns, mods, startLine, ty, false);
    }
    return { kind: 'stmt', next: skipStatement(P, k) };
  }

  // Field declarators: Type a = x, b;
  const decls = [];
  while (k < T.length && isIdent(T[k])) {
    const nm = T[k];
    k++;
    while (isOp(T[k], '[') && isOp(T[k + 1], ']')) k += 2;
    let initFrom = -1;
    let initTo = -1;
    if (isOp(T[k], '=')) {
      k++;
      initFrom = k;
      while (k < T.length) {
        const x = T[k];
        if (x.t === 'op' && (x.v === '(' || x.v === '[' || x.v === '{')) { const m = P.M[k]; k = m < 0 ? T.length : m + 1; continue; }
        if (isOp(x, ',') || isOp(x, ';') || (isOp(x, '}') && P.M[k] >= 0 && P.M[k] < initFrom)) break;
        k++;
      }
      initTo = k - 1;
    }
    decls.push({
      name: nm.v, type: ty.text, base: ty.base, anns, mods, line: startLine, nameLine: nm.line,
      init: initFrom >= 0 ? oneLine(sliceText(P, initFrom, initTo)) : '', initFrom, initTo,
    });
    if (isOp(T[k], ',')) { k++; continue; }
    break;
  }
  if (!decls.length) return { kind: 'stmt', next: skipStatement(P, k) };
  if (isOp(T[k], ';')) k++;
  return { kind: 'field', decls, next: k };
}

function finishMethod(P, nameIdx, open, anns, mods, startLine, ty, ctor) {
  const T = P.T;
  const close = P.M[open];
  const params = parseParams(P, open, close);
  let k = close < 0 ? T.length : close + 1;
  while (isOp(T[k], '[') && isOp(T[k + 1], ']')) k += 2;
  const throwsList = [];
  if (isIdent(T[k], 'throws')) {
    k++;
    while (k < T.length && !isOp(T[k], '{') && !isOp(T[k], ';')) {
      if (isIdent(T[k])) {
        const q = readQualified(P, k);
        throwsList.push(simpleNameOf(q.name));
        k = q.next;
        if (isOp(T[k], '<')) k = skipAngles(T, k);
      } else k++;
    }
  }
  const decl = {
    name: T[nameIdx].v, ctor, returnType: ty ? ty.text : null, returnBase: ty ? ty.base : null, params, anns, mods,
    throws: throwsList, line: startLine, nameLine: T[nameIdx].line, endLine: T[Math.min(k, T.length - 1)].line,
    bodyStart: -1, bodyEnd: -1, hasBody: false, complete: close >= 0,
  };
  if (isIdent(T[k], 'default')) {
    while (k < T.length && !isOp(T[k], ';')) { const x = T[k]; if (x.t === 'op' && (x.v === '(' || x.v === '{' || x.v === '[')) { const m = P.M[k]; k = m < 0 ? T.length : m + 1; continue; } k++; }
  }
  if (isOp(T[k], '{')) {
    const m = P.M[k];
    decl.hasBody = true;
    decl.bodyStart = k;
    decl.bodyEnd = m < 0 ? T.length - 1 : m;
    decl.complete = decl.complete && m >= 0;
    decl.endLine = T[decl.bodyEnd].line;
    return { kind: 'method', decl, next: m < 0 ? T.length : m + 1 };
  }
  if (isOp(T[k], ';')) k++;
  return { kind: 'method', decl, next: k };
}

function parseType(P, k, anns, mods, startLine, owner) {
  const T = P.T;
  let kind;
  if (isOp(T[k], '@')) { kind = 'annotation'; k += 2; } else { kind = T[k].v; k++; }
  const nameTok = T[k];
  const decl = {
    kind, name: isIdent(nameTok) ? nameTok.v : '(unnamed)', anns, mods, ext: [], impl: [], fields: [], methods: [],
    types: [], enumConstants: [], recordComponents: [], startLine, nameLine: nameTok ? nameTok.line : startLine,
    endLine: startLine, complete: false, bodyStart: -1, bodyEnd: -1,
  };
  if (isIdent(nameTok)) k++;
  if (isOp(T[k], '<')) k = skipAngles(T, k);
  if (kind === 'record' && isOp(T[k], '(')) {
    const close = P.M[k];
    decl.recordComponents = parseParams(P, k, close);
    k = close < 0 ? T.length : close + 1;
  }
  let mode = null;
  while (k < T.length && !isOp(T[k], '{')) {
    const t = T[k];
    if (isIdent(t, 'extends')) { mode = 'ext'; k++; continue; }
    if (isIdent(t, 'implements')) { mode = 'impl'; k++; continue; }
    if (isIdent(t, 'permits')) { mode = 'permits'; k++; continue; }
    if (isOp(t, ';') || isOp(t, '}')) break;
    if (isIdent(t)) {
      const q = readQualified(P, k);
      if (mode === 'ext') decl.ext.push(simpleNameOf(q.name));
      if (mode === 'impl') decl.impl.push(simpleNameOf(q.name));
      k = q.next;
      if (isOp(T[k], '<')) k = skipAngles(T, k);
      continue;
    }
    k++;
  }
  if (!isOp(T[k], '{')) {
    decl.endLine = T[Math.min(k, T.length - 1)] ? T[Math.min(k, T.length - 1)].line : startLine;
    return { kind: 'type', decl, next: k };
  }
  const open = k;
  const close = P.M[open];
  const end = close < 0 ? T.length : close;
  decl.bodyStart = open;
  decl.bodyEnd = close < 0 ? T.length - 1 : close;
  decl.complete = close >= 0;
  decl.endLine = T[decl.bodyEnd].line;
  k = open + 1;

  if (kind === 'enum') {
    while (k < end) {
      if (isOp(T[k], '@') && isIdent(T[k + 1])) { k = readAnnotation(P, k).next; continue; }
      if (isIdent(T[k]) && (isOp(T[k + 1], '(') || isOp(T[k + 1], '{') || isOp(T[k + 1], ',') || isOp(T[k + 1], ';') || k + 1 === end)) {
        decl.enumConstants.push({ name: T[k].v, line: T[k].line });
        k++;
        if (isOp(T[k], '(')) { const m = P.M[k]; k = m < 0 ? end : m + 1; }
        if (isOp(T[k], '{')) { const m = P.M[k]; k = m < 0 ? end : m + 1; }
        if (isOp(T[k], ',')) { k++; continue; }
      }
      if (isOp(T[k], ';')) k++;
      break;
    }
  }

  while (k < end) {
    if (isOp(T[k], ';')) { k++; continue; }
    const r = parseMember(P, k, decl);
    if (r.kind === 'type') decl.types.push(r.decl);
    else if (r.kind === 'method') decl.methods.push(r.decl);
    else if (r.kind === 'field') for (const d of r.decls) decl.fields.push(d);
    k = r.next > k ? r.next : k + 1;
  }
  return { kind: 'type', decl, next: close < 0 ? T.length : close + 1 };
}

function annNamed(list, ...names) {
  for (const a of list || []) if (names.includes(a.name)) return a;
  return null;
}

// Pull string literal values out of an annotation argument text, e.g.
// @GetMapping(value = {"/a", "/b"}) → ["/a", "/b"]. Restricted to a named
// attribute when one is given.
function annStrings(ann, attr) {
  if (!ann || !ann.args) return [];
  let text = ann.args;
  if (attr) {
    const re = new RegExp('(?:^|[,(\\s])' + attr + '\\s*=\\s*');
    const m = re.exec(text);
    if (!m) {
      // A bare positional value counts as `value`.
      if (attr === 'value' || attr === 'path') {
        if (/^\s*[\w.]+\s*=/.test(text)) return [];
      } else return [];
    } else {
      text = text.slice(m.index + m[0].length);
      if (text[0] === '{') text = text.slice(0, text.indexOf('}') + 1);
      else text = text.split(/,\s*\w+\s*=/)[0];
    }
  }
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function annClassRefs(ann) {
  if (!ann || !ann.args) return [];
  const out = [];
  const re = /([\w.$]+)\s*\.\s*class\b/g;
  let m;
  while ((m = re.exec(ann.args))) out.push(simpleNameOf(m[1]));
  return out;
}
