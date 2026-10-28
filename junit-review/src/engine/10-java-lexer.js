/* ------------------------------------------------------------------------
 * Java tokenizer.
 *
 * Produces a flat token list with line numbers and source offsets. Comments
 * are kept aside (they matter for "commented-out test" detection but must not
 * affect structure). String, char and text-block literals are single tokens,
 * so braces or "@Test" inside them can never be mistaken for code.
 * --------------------------------------------------------------------- */

const JAVA_KEYWORDS = new Set((
  'abstract assert boolean break byte case catch char class const continue default do double else enum ' +
  'extends final finally float for goto if implements import instanceof int interface long native new ' +
  'package private protected public return short static strictfp super switch synchronized this throw ' +
  'throws transient try void volatile while true false null var yield record sealed permits'
).split(' '));

const MODIFIERS = new Set([
  'public', 'protected', 'private', 'static', 'final', 'abstract', 'native', 'synchronized',
  'transient', 'volatile', 'strictfp', 'default', 'sealed',
]);

const RE_IDENT = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const RE_NUMBER = /(?:0[xX][0-9a-fA-F_]+[lL]?|0[bB][01_]+[lL]?|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?[fFdDlL]?)/y;
const OPERATORS = [
  '>>>=', '<<=', '>>=', '...', '->', '::', '==', '!=', '<=', '>=', '&&', '||', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<',
];

function tokenizeJava(input) {
  const src = normalizeNewlines(input);
  const tokens = [];
  const comments = [];
  const problems = [];
  let i = 0;
  let line = 1;
  const n = src.length;

  function push(t, v, start, startLine) {
    tokens.push({ t, v, pos: start, end: i, line: startLine });
  }

  while (i < n) {
    const ch = src[i];

    if (ch === '\n') { line++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === ' ' || ch === '﻿') { i++; continue; }

    const start = i;
    const startLine = line;

    // Comments
    if (ch === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i);
      i = e < 0 ? n : e;
      comments.push({ line: startLine, endLine: startLine, text: src.slice(start + 2, i), block: false });
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const stop = e < 0 ? n : e + 2;
      const body = src.slice(start + 2, e < 0 ? n : e);
      for (let k = start; k < stop; k++) if (src[k] === '\n') line++;
      i = stop;
      comments.push({ line: startLine, endLine: line, text: body, block: true, javadoc: body[0] === '*' });
      if (e < 0) problems.push({ line: startLine, kind: 'unterminated-comment', message: 'Block comment is not closed — the paste may be cut off.' });
      continue;
    }

    // Text block """ ... """
    if (ch === '"' && src[i + 1] === '"' && src[i + 2] === '"') {
      let k = i + 3;
      let closed = false;
      while (k < n) {
        if (src[k] === '\\') { if (src[k + 1] === '\n') line++; k += 2; continue; }
        if (src[k] === '\n') line++;
        if (src[k] === '"' && src[k + 1] === '"' && src[k + 2] === '"') { k += 3; closed = true; break; }
        k++;
      }
      i = k;
      push('str', src.slice(start, i), start, startLine);
      tokens[tokens.length - 1].textBlock = true;
      if (!closed) problems.push({ line: startLine, kind: 'unterminated-string', message: 'Text block is not closed — the paste may be cut off.' });
      continue;
    }

    // String / char literals
    if (ch === '"' || ch === "'") {
      let k = i + 1;
      let closed = false;
      while (k < n) {
        const c = src[k];
        if (c === '\\') { k += 2; continue; }
        if (c === '\n') break;
        if (c === ch) { k++; closed = true; break; }
        k++;
      }
      i = k;
      push(ch === '"' ? 'str' : 'chr', src.slice(start, i), start, startLine);
      if (!closed) problems.push({ line: startLine, kind: 'unterminated-string', message: 'String literal is not closed on its line.' });
      continue;
    }

    // Numbers
    if ((ch >= '0' && ch <= '9') || (ch === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      RE_NUMBER.lastIndex = i;
      const m = RE_NUMBER.exec(src);
      i += m ? m[0].length : 1;
      push('num', src.slice(start, i), start, startLine);
      continue;
    }

    // Identifiers / keywords
    RE_IDENT.lastIndex = i;
    const id = RE_IDENT.exec(src);
    if (id && id.index === i) {
      i += id[0].length;
      push('id', id[0], start, startLine);
      continue;
    }

    if (ch === '@') { i++; push('op', '@', start, startLine); continue; }

    let op = null;
    for (const o of OPERATORS) {
      if (src.startsWith(o, i)) { op = o; break; }
    }
    if (op) { i += op.length; push('op', op, start, startLine); continue; }

    i++;
    push('op', ch, start, startLine);
  }

  return { src, tokens, comments, problems, lineCount: line };
}

function isIdent(tok, v) {
  return tok && tok.t === 'id' && (v === undefined || tok.v === v);
}

function isOp(tok, v) {
  return tok && tok.t === 'op' && tok.v === v;
}
