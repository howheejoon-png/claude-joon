/* ------------------------------------------------------------------------
 * Method-body scanner shared by test and production analysis.
 *
 * Finds calls (with receiver, enclosing call and chain relationships),
 * constructor calls, method references, local declarations and try/catch
 * blocks. Everything is index-based on the token stream.
 * --------------------------------------------------------------------- */

function scanBody(P, from, to) {
  // from/to: token indices of the body's "{" and "}" (exclusive range inside).
  const T = P.T;
  const M = P.M;
  const lo = from + 1;
  const hi = to;
  const calls = [];
  const byIdx = new Map();
  const news = [];
  const refs = [];
  const decls = [];
  const tries = [];

  for (let k = lo; k < hi; k++) {
    const t = T[k];
    if (t.t !== 'id') {
      if (isOp(t, '::') && isIdent(T[k + 1])) {
        const left = T[k - 1];
        refs.push({ target: left && left.t === 'id' ? left.v : '', name: T[k + 1].v, line: t.line, idx: k });
      }
      continue;
    }
    if (t.v === 'new') {
      let j = k + 1;
      while (isOp(T[j], '@')) j = readAnnotation(P, j).next;
      if (isIdent(T[j])) {
        const q = readQualified(P, j);
        let after = q.next;
        if (isOp(T[after], '<')) after = skipAngles(T, after);
        if (isOp(T[after], '(')) {
          news.push({ type: simpleNameOf(q.name), idx: k, open: after, close: M[after], line: t.line, anonBody: isOp(T[M[after] + 1], '{') });
        }
      }
      continue;
    }
    if (t.v === 'try') {
      const tr = readTry(P, k, hi);
      if (tr) tries.push(tr);
      continue;
    }
    if (isOp(T[k + 1], '(') && !JAVA_KEYWORDS.has(t.v)) {
      const call = { name: t.v, idx: k, open: k + 1, close: M[k + 1] < 0 ? hi : M[k + 1], line: t.line, recv: receiverOf(P, k), parent: null, chainNext: [] };
      // `new Foo(…)` is also recorded here so that `new Foo(…).bar()` chains resolve to Foo.
      let q = k - 1;
      while (isOp(T[q], '.') && isIdent(T[q - 1])) q -= 2;
      if (isIdent(T[q], 'new')) { call.isCtor = true; call.recv = { kind: 'none' }; }
      calls.push(call);
      byIdx.set(k, call);
      continue;
    }
    // Local declarations:  [final] Type name (= | ; | : | ,)
    const prev = T[k - 1];
    if (!JAVA_KEYWORDS.has(t.v) || PRIMITIVES.has(t.v)) {
      const boundary = !prev || isOp(prev, '{') || isOp(prev, ';') || isOp(prev, '}') || isOp(prev, '(') || isIdent(prev, 'final') || (isOp(prev, ')') && false);
      if (boundary && /^[A-Za-z_$]/.test(t.v)) {
        const ty = readType(P, k);
        if (ty && ty.next < hi && isIdent(T[ty.next]) && !JAVA_KEYWORDS.has(T[ty.next].v)) {
          const after = T[ty.next + 1];
          if (after && (isOp(after, '=') || isOp(after, ';') || isOp(after, ':') || isOp(after, ',') || isOp(after, ')'))) {
            const d = { name: T[ty.next].v, type: ty.base, typeText: ty.text, line: t.line, idx: ty.next, initIdx: isOp(after, '=') ? ty.next + 2 : -1 };
            decls.push(d);
            k = ty.next;
          }
        }
      }
    }
  }

  // Parent (innermost enclosing call) for every call / new.
  const stack = [];
  for (const c of calls) {
    while (stack.length && stack[stack.length - 1].close < c.idx) stack.pop();
    c.parent = stack.length ? stack[stack.length - 1] : null;
    stack.push(c);
  }
  for (const nw of news) {
    let p = null;
    for (const c of calls) if (c.open < nw.idx && c.close > nw.idx && (!p || c.open > p.open)) p = c;
    nw.parent = p;
  }
  // Chain relationships: x.a().b() → b.recv.call = a
  for (const c of calls) {
    if (c.recv.kind === 'call') {
      const r = byIdx.get(c.recv.callIdx);
      if (r) { c.recv.call = r; r.chainNext.push(c); }
    }
  }
  for (const c of calls) {
    let root = c;
    let guard = 0;
    while (root.recv.kind === 'call' && root.recv.call && guard++ < 50) root = root.recv.call;
    c.chainRoot = root;
  }
  return { calls, byIdx, news, refs, decls, tries, lo, hi };
}

function receiverOf(P, k) {
  const T = P.T;
  if (!isOp(T[k - 1], '.')) return { kind: 'none' };
  const prev = T[k - 2];
  if (!prev) return { kind: 'expr' };
  if (isIdent(prev)) {
    const parts = [prev.v];
    let s = k - 2;
    while (isOp(T[s - 1], '.') && isIdent(T[s - 2])) { parts.unshift(T[s - 2].v); s -= 2; }
    if (isOp(T[s - 1], '.') && isOp(T[s - 2], ')')) {
      // a.b().c.d( — field access on a call result; treat as chained call
      const open = P.M[s - 2];
      if (open > 0 && isIdent(T[open - 1])) return { kind: 'call', callIdx: open - 1, via: parts.join('.') };
      return { kind: 'expr' };
    }
    if (parts[0] === 'this' && parts.length >= 2) return { kind: 'name', root: parts[1], name: parts[parts.length - 1], qualified: parts.slice(1).join('.'), thisRef: true, rootIdx: s };
    if (parts.length === 1 && prev.v === 'this') return { kind: 'this', rootIdx: s };
    if (parts.length === 1 && prev.v === 'super') return { kind: 'super', rootIdx: s };
    return { kind: 'name', root: parts[0], name: parts[parts.length - 1], qualified: parts.join('.'), rootIdx: s };
  }
  if (isOp(prev, ')')) {
    const open = P.M[k - 2];
    if (open > 0 && isIdent(T[open - 1]) && !JAVA_KEYWORDS.has(T[open - 1].v)) return { kind: 'call', callIdx: open - 1 };
    return { kind: 'expr' };
  }
  if (prev.t === 'str') return { kind: 'literal' };
  return { kind: 'expr' };
}

function readTry(P, k, hi) {
  const T = P.T;
  let j = k + 1;
  if (isOp(T[j], '(')) { const m = P.M[j]; if (m < 0) return null; j = m + 1; }
  if (!isOp(T[j], '{')) return null;
  const tryOpen = j;
  const tryClose = P.M[j];
  if (tryClose < 0) return null;
  const tr = { idx: k, line: T[k].line, tryOpen, tryClose, catches: [], finallyRange: null };
  j = tryClose + 1;
  while (isIdent(T[j], 'catch') && isOp(T[j + 1], '(')) {
    const pOpen = j + 1;
    const pClose = P.M[pOpen];
    if (pClose < 0) break;
    const types = [];
    for (let q = pOpen + 1; q < pClose; q++) if (isIdent(T[q]) && /^[A-Z]/.test(T[q].v) && !isOp(T[q - 1], '.')) types.push(T[q].v);
    const bOpen = pClose + 1;
    if (!isOp(T[bOpen], '{')) break;
    const bClose = P.M[bOpen];
    if (bClose < 0) break;
    // last identifier in the catch parens is the variable name, not a type
    const varTok = T[pClose - 1];
    tr.catches.push({ types: types.filter((x) => !varTok || x !== varTok.v), open: bOpen, close: bClose, line: T[j].line });
    j = bClose + 1;
  }
  if (isIdent(T[j], 'finally') && isOp(T[j + 1], '{')) {
    const fClose = P.M[j + 1];
    if (fClose > 0) tr.finallyRange = [j + 1, fClose];
  }
  return tr;
}

function callArgs(P, call) {
  if (call.close < 0 || call.close <= call.open) return [];
  return splitTopLevel(P, call.open, call.close, ',');
}

function argText(P, call, n) {
  const parts = callArgs(P, call);
  if (!parts[n]) return '';
  return oneLine(sliceText(P, parts[n][0], parts[n][1]));
}

function callText(P, call) {
  return oneLine(sliceText(P, call.idx, call.close));
}

function within(idx, a, b) {
  return idx > a && idx < b;
}

// First string literal inside a call's first argument, joined across "+" (non-literals → {*}).
function pathFromArg(P, call, n) {
  const parts = callArgs(P, call);
  const part = parts[n || 0];
  if (!part) return null;
  const T = P.T;
  let path = '';
  let sawLiteral = false;
  for (let k = part[0]; k <= part[1]; k++) {
    const t = T[k];
    if (t.t === 'str') { path += unquote(t.v); sawLiteral = true; continue; }
    if (isOp(t, '+')) continue;
    if (t.t === 'op' && (t.v === '(' || t.v === '[')) { const m = P.M[k]; if (m > k) { path += '{*}'; k = m; continue; } }
    if (t.t === 'id' || t.t === 'num') {
      // swallow a.b.c / method chains as one placeholder
      if (!path.endsWith('{*}')) path += '{*}';
      continue;
    }
  }
  return sawLiteral ? path : null;
}

function unquote(s) {
  if (s.startsWith('"""')) return s.slice(3, -3);
  return s.slice(1, -1).replace(/\\(.)/g, '$1');
}

function normalisePath(p) {
  if (p == null) return null;
  let s = String(p).trim();
  s = s.replace(/^https?:\/\/[^/]*/i, '').replace(/^\{\*\}(?=\/)/, '');
  s = s.split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/$/, '');
  return s;
}

function pathsMatch(endpoint, request) {
  const a = normalisePath(endpoint).split('/');
  const b = normalisePath(request).split('/');
  if (a.length !== b.length) {
    // "/orders/{*}" from "/orders/" + id may have merged a trailing segment
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (/^\{.*\}$/.test(x) || /^\{.*\}$/.test(y) || y.indexOf('{*}') >= 0 || x === '**' || x === '*') continue;
    return false;
  }
  return true;
}
