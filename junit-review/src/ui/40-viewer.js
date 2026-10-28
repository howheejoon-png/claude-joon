/* ------------------------------------------------------------------------
 * Snippet viewer: line-numbered, lightly syntax-tinted, read-only view of
 * a pasted snippet, opened at the line an evidence reference points to.
 * Highlighting builds text nodes inside spans — the text is never parsed
 * as HTML.
 * --------------------------------------------------------------------- */

const JAVA_HL = /(\/\*[\s\S]*?(?:\*\/|$))|(\/\/[^\n]*)|("""[\s\S]*?(?:"""|$))|("(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(@[A-Za-z_$][\w$.]*)|\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|var|record|yield|sealed|permits|true|false|null)\b|\b(\d[\w.]*)\b|\b([A-Z][\w$]*)\b/g;
const JAVA_CLS = [null, 'hl-com', 'hl-com', 'hl-str', 'hl-str', 'hl-str', 'hl-ann', 'hl-kw', 'hl-num', 'hl-type'];
const XML_HL = /(<!--[\s\S]*?(?:-->|$))|(<!\[CDATA\[[\s\S]*?(?:\]\]>|$))|(<[!?\/]?[A-Za-z_:][\w:.-]*)|(\s[A-Za-z_:][\w:.-]*)(?==)|("[^"\n]*"|'[^'\n]*')|(\/?>|\?>)/g;
const XML_CLS = [null, 'hl-com', 'hl-str', 'hl-tag', 'hl-attr', 'hl-str', 'hl-tag'];
const MAX_TINTED_LINES = 20000;

function segmentsFor(text, kind) {
  let re = null;
  let classes = null;
  if (kind === 'test' || kind === 'source') { re = JAVA_HL; classes = JAVA_CLS; }
  else if ((kind === 'jacoco' || kind === 'results') && /^\s*</.test(text)) { re = XML_HL; classes = XML_CLS; }
  if (!re) return [{ cls: null, text }];
  const segs = [];
  let last = 0;
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    let g = 1;
    while (g < m.length && m[g] === undefined) g++;
    if (m.index > last) segs.push({ cls: null, text: text.slice(last, m.index) });
    segs.push({ cls: classes[g] || null, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ cls: null, text: text.slice(last) });
  return segs;
}

function renderCodeLines(text, kind, focusLine) {
  const lines = text.split('\n');
  const tinted = lines.length <= MAX_TINTED_LINES;
  const segs = tinted ? segmentsFor(text, kind) : [{ cls: null, text }];
  const frag = document.createDocumentFragment();
  let lineNo = 1;
  let code = h('span', { class: 'cl-code' });
  const flush = () => {
    let cls = 'cl';
    if (kind === 'scope') {
      const raw = lines[lineNo - 1] || '';
      if (/^(diff --git|index |--- |\+\+\+ )/.test(raw)) cls += ' df-meta';
      else if (raw.startsWith('@@')) cls += ' df-hunk';
      else if (raw.startsWith('+')) cls += ' df-add';
      else if (raw.startsWith('-')) cls += ' df-del';
    }
    if (lineNo === focusLine) cls += ' is-focus';
    frag.appendChild(h('div', { class: cls, id: 'vl-' + lineNo }, h('span', { class: 'cl-n', text: String(lineNo) }), code));
    lineNo++;
    code = h('span', { class: 'cl-code' });
  };
  for (const s of segs) {
    const parts = s.text.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) flush();
      if (p) code.appendChild(s.cls ? h('span', { class: s.cls, text: p }) : document.createTextNode(p));
    });
  }
  flush();
  return { frag, tinted, count: lines.length };
}

function openViewer(snippetId, line) {
  const sn = S.snippets.find((s) => s.id === snippetId);
  if (!sn) { toast('That snippet is no longer in the workspace.', { kind: 'warn' }); return; }
  const info = S.result ? S.result.snippets.find((s) => s.id === snippetId) : null;
  const kind = info ? info.type : sn.type;
  $('#viewer-title').textContent = 'Snippet #' + sn.seq + (info ? ' — ' + info.label : '');
  const sub = clear($('#viewer-sub'));
  append(sub, [
    chip(info && info.type ? JR.INPUT_TYPES[info.type] : 'Unrecognised', 'chip-outline'),
    info && info.summary ? h('span', { class: 'muted small', text: info.summary }) : null,
    line ? h('span', { class: 'small', text: 'Showing line ' + line }) : null,
    info && info.incomplete ? chip('Possibly incomplete', 'chip-warn', info.incompleteReasons.join(' ')) : null,
    h('span', { class: 'spacer' }),
    button('Edit', { class: 'btn btn-sm btn-ghost', onclick: () => { closeViewer(); beginEdit(sn.id, 'edit'); } }, 'edit'),
  ]);
  const body = clear($('#viewer-body'));
  const { frag, tinted, count } = renderCodeLines(sn.text, kind, line || 0);
  const pre = h('div', { class: 'code-view', role: 'region', 'aria-label': 'Snippet text' });
  pre.appendChild(frag);
  body.appendChild(pre);
  if (!tinted) body.prepend(h('p', { class: 'small muted', text: 'Large snippet (' + fmt(count) + ' lines): shown without colouring.' }));
  const dlg = $('#viewer');
  showDialog(dlg);
  requestAnimationFrame(() => {
    const target = line ? $('#vl-' + line, body) : null;
    if (target) target.scrollIntoView({ block: 'center' });
    else body.scrollTop = 0;
    body.focus({ preventScroll: true });
  });
}

function closeViewer() {
  const dlg = $('#viewer');
  if (dlg.open) hideDialog(dlg);
}
