/* ------------------------------------------------------------------------
 * Minimal, safe XML reader for JaCoCo and JUnit reports.
 *
 * Only the five predefined entities and numeric character references are
 * decoded. DOCTYPE declarations — including any internal subset — are skipped
 * and never expanded, so entity-expansion attacks have nothing to work with
 * and nothing is ever fetched. Truncated documents are reported, not fatal.
 * --------------------------------------------------------------------- */

const XML_ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeXmlEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch (e) { return whole; }
    }
    return Object.prototype.hasOwnProperty.call(XML_ENTITIES, body) ? XML_ENTITIES[body] : whole;
  });
}

function parseXml(input) {
  const src = normalizeNewlines(input);
  const root = { name: '#document', attrs: Object.create(null), children: [], text: '', line: 0 };
  const stack = [root];
  const errors = [];
  let truncated = false;
  let i = 0;
  let line = 1;
  const n = src.length;
  let elementCount = 0;

  function countLines(a, b) {
    for (let k = a; k < b; k++) if (src.charCodeAt(k) === 10) line++;
  }
  function addText(t) {
    const top = stack[stack.length - 1];
    if (top.text.length < 200000) top.text += t;
  }

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { addText(decodeXmlEntities(src.slice(i))); countLines(i, n); break; }
    if (lt > i) { addText(decodeXmlEntities(src.slice(i, lt))); countLines(i, lt); }
    i = lt;

    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      if (e < 0) { truncated = true; break; }
      countLines(i, e + 3); i = e + 3; continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i + 9);
      if (e < 0) { truncated = true; addText(src.slice(i + 9)); break; }
      addText(src.slice(i + 9, e));
      countLines(i, e + 3); i = e + 3; continue;
    }
    if (src.startsWith('<?', i)) {
      const e = src.indexOf('?>', i + 2);
      if (e < 0) { truncated = true; break; }
      countLines(i, e + 2); i = e + 2; continue;
    }
    if (src.startsWith('<!', i)) {
      // DOCTYPE (possibly with an internal [ ... ] subset). Skipped, never expanded.
      let k = i + 2;
      let depth = 0;
      while (k < n) {
        const c = src[k];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
        k++;
      }
      if (k >= n) { truncated = true; break; }
      countLines(i, k + 1); i = k + 1; continue;
    }
    if (src.startsWith('</', i)) {
      const e = src.indexOf('>', i + 2);
      if (e < 0) { truncated = true; break; }
      const name = src.slice(i + 2, e).trim();
      const tagLine = line;
      countLines(i, e + 1); i = e + 1;
      let found = -1;
      for (let s = stack.length - 1; s > 0; s--) if (stack[s].name === name) { found = s; break; }
      if (found < 0) { errors.push({ line: tagLine, message: 'Closing tag </' + name + '> has no matching opening tag.' }); continue; }
      if (found !== stack.length - 1) errors.push({ line: tagLine, message: 'Element <' + stack[stack.length - 1].name + '> was not closed before </' + name + '>.' });
      stack.length = found;
      continue;
    }

    // Start tag
    const tagLine = line;
    let k = i + 1;
    const nameMatch = /^[A-Za-z_:][\w:.-]*/.exec(src.slice(k, k + 200));
    if (!nameMatch) { addText('<'); i++; continue; }
    const el = { name: nameMatch[0], attrs: Object.create(null), children: [], text: '', line: tagLine };
    k += nameMatch[0].length;
    let selfClose = false;
    let closed = false;
    while (k < n) {
      const c = src[k];
      if (c === '>') { k++; closed = true; break; }
      if (c === '/' && src[k + 1] === '>') { k += 2; selfClose = true; closed = true; break; }
      if (/\s/.test(c)) { k++; continue; }
      const am = /^([A-Za-z_:][\w:.-]*)\s*=\s*/.exec(src.slice(k, k + 300));
      if (!am) { k++; continue; }
      k += am[0].length;
      const q = src[k];
      if (q === '"' || q === "'") {
        const e = src.indexOf(q, k + 1);
        if (e < 0) { k = n; break; }
        el.attrs[am[1]] = decodeXmlEntities(src.slice(k + 1, e));
        k = e + 1;
      } else {
        const vm = /^[^\s>]+/.exec(src.slice(k));
        el.attrs[am[1]] = vm ? decodeXmlEntities(vm[0]) : '';
        k += vm ? vm[0].length : 0;
      }
    }
    countLines(i, Math.min(k, n));
    i = k;
    if (!closed) { truncated = true; break; }
    stack[stack.length - 1].children.push(el);
    elementCount++;
    if (!selfClose) stack.push(el);
  }

  if (stack.length > 1) truncated = true;
  const docEl = root.children[0] || null;
  return { root: docEl, document: root, errors, truncated, elementCount, unclosed: stack.slice(1).map((e) => e.name) };
}

function xmlKids(el, name) {
  return el ? el.children.filter((c) => c.name === name) : [];
}

function xmlDescendants(el, name, out) {
  out = out || [];
  if (!el) return out;
  for (const c of el.children) {
    if (c.name === name) out.push(c);
    xmlDescendants(c, name, out);
  }
  return out;
}

function intAttr(el, name) {
  const v = el.attrs[name];
  if (v == null || v === '') return 0;
  const n = parseInt(String(v).replace(/[,\s]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
