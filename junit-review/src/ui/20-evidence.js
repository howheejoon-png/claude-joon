/* ------------------------------------------------------------------------
 * Evidence step: the paste editor, live detection, add / edit / replace,
 * duplicate handling, the collected-evidence list and manual figures.
 * --------------------------------------------------------------------- */

const TYPE_ICON = { test: 'test', source: 'code', jacoco: 'chart', results: 'run', scope: 'diff', summary: 'sum' };
const TYPE_SHORT = { test: 'Test code', source: 'Source', jacoco: 'JaCoCo', results: 'Results', scope: 'Scope', summary: 'Declared', auto: 'Auto' };

function initEditor() {
  const sel = $('#input-type');
  for (const k of Object.keys(JR.INPUT_TYPES)) sel.appendChild(h('option', { value: k, text: JR.INPUT_TYPES[k] }));
  const code = $('#code');
  const gutter = $('#gutter');
  let escPressed = false;

  const refresh = () => {
    const text = code.value;
    const n = text ? text.split('\n').length : 1;
    if (gutter.dataset.n !== String(n)) {
      gutter.dataset.n = String(n);
      let s = '';
      for (let i = 1; i <= n; i++) s += i + '\n';
      gutter.textContent = s;
    }
    $('#editor-size').textContent = text ? plural(n, 'line') + ' · ' + fmt(text.length) + ' characters' : '';
    gutter.scrollTop = code.scrollTop;
    liveDetect();
    $('#dup-warning').hidden = true;
  };
  code.addEventListener('input', refresh);
  code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { escPressed = true; return; }
    if (e.key === 'Tab' && !escPressed && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const s = code.selectionStart;
      const en = code.selectionEnd;
      code.setRangeText('\t', s, en, 'end');
      refresh();
      return;
    }
    escPressed = false;
  });
  sel.addEventListener('change', () => { syncProvenanceField(); liveDetect(); });
  $('#btn-add').addEventListener('click', () => commitEditor(false));
  $('#btn-cancel-edit').addEventListener('click', () => endEdit());
  $('#btn-clear-editor').addEventListener('click', () => { code.value = ''; refresh(); code.focus(); });
  $('#btn-manual-add').addEventListener('click', addManualFigure);
  editorRefresh = refresh;
  refresh();
}

let editorRefresh = () => {};

function syncProvenanceField() {
  const type = $('#input-type').value;
  const det = JR.detectType($('#code').value);
  $('#provenance-field').hidden = !(type === 'summary' || (type === 'auto' && det.type === 'summary'));
}

const liveDetect = debounce(() => {
  const text = $('#code').value;
  const host = clear($('#detected'));
  syncProvenanceField();
  if (!text.trim()) { host.appendChild(h('span', { class: 'muted', text: 'Waiting for pasted text…' })); return; }
  const det = JR.detectType(text);
  const chosen = $('#input-type').value;
  const kids = [];
  if (!det.type) kids.push(h('span', { class: 'det det-unknown' }, svg('info'), ' Not recognised — choose the input type'));
  else {
    kids.push(h('span', { class: 'det' }, svg(TYPE_ICON[det.type] || 'doc'), ' Detected: ', h('strong', { text: det.label })));
    if (det.type === 'test' || det.type === 'source') {
      try {
        const p = JR.parseJava(JR.unwrapExcelCell(text));
        const names = [];
        let tests = 0;
        const walk = (t) => { for (const m of t.methods) if (m.anns.some((a) => /^(Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)$/.test(a.name))) tests++; t.types.forEach(walk); };
        for (const u of p.units) for (const t of u.types) { names.push((u.pkg ? u.pkg + '.' : '') + t.name); walk(t); }
        for (const u of p.units) if (u.fragment) u.fragment.methods.forEach((m) => { if (m.anns.some((a) => /Test$/.test(a.name))) tests++; });
        if (names.length) kids.push(h('span', { class: 'det-names', text: names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '') }));
        if (tests) kids.push(chip(plural(tests, 'test method'), 'chip-soft'));
        if (p.issues.length || p.units.some((u) => u.fragment && u.fragment.methods.length)) kids.push(chip('possibly incomplete', 'chip-warn', p.issues.map((i) => i.message).join(' ')));
      } catch (e) { /* detection is advisory only */ }
    }
    if (chosen !== 'auto' && det.type !== chosen && !((chosen === 'test' || chosen === 'source') && (det.type === 'test' || det.type === 'source'))) {
      kids.push(chip('differs from selected type', 'chip-warn'));
    }
  }
  append(host, kids);
}, 160);

function commitEditor(force) {
  const code = $('#code');
  const text = code.value.replace(/\r\n?/g, '\n');
  if (!text.trim()) { toast('Paste some evidence first.', { kind: 'warn' }); code.focus(); return; }
  const type = $('#input-type').value;
  const provenance = $('#input-provenance').value;
  const key = JR.contentKey(text);
  const dup = S.snippets.find((s) => JR.contentKey(s.text) === key && (!S.editing || s.id !== S.editing.id));
  if (dup && !force) {
    const w = clear($('#dup-warning'));
    w.hidden = false;
    append(w, [
      h('p', {}, h('strong', { text: 'Identical to snippet #' + dup.seq + '. ' }), 'Duplicate pastes are counted only once.'),
      h('div', { class: 'row' },
        button('Add anyway', { class: 'btn btn-sm', onclick: () => { w.hidden = true; commitEditor(true); } }),
        button('View snippet #' + dup.seq, { class: 'btn btn-sm btn-ghost', onclick: () => openViewer(dup.id) }),
        button('Cancel', { class: 'btn btn-sm btn-ghost', onclick: () => { w.hidden = true; } })),
    ]);
    return;
  }
  if (S.editing) {
    const sn = updateSnippet(S.editing.id, { text, type, provenance });
    toast('Snippet #' + sn.seq + ' ' + (S.editing.mode === 'replace' ? 'replaced' : 'updated') + '.');
    endEdit();
  } else {
    const sn = newSnippet(text, type, provenance);
    toast('Added as snippet #' + sn.seq + '. Paste the next item when ready.');
    code.value = '';
    $('#input-type').value = 'auto';
    editorRefresh();
  }
  code.focus();
}

function beginEdit(id, mode) {
  const sn = S.snippets.find((s) => s.id === id);
  if (!sn) return;
  S.editing = { id, mode };
  const code = $('#code');
  code.value = mode === 'replace' ? '' : sn.text;
  $('#input-type').value = sn.type;
  $('#input-provenance').value = sn.provenance || 'Vendor-declared';
  $('#editor-title').textContent = (mode === 'replace' ? 'Replace snippet #' : 'Edit snippet #') + sn.seq;
  $('#editor-lede').textContent = mode === 'replace' ? 'Paste the new version, then save. The snippet keeps its number.' : 'Change the text or input type, then save.';
  $('#btn-add').lastChild.textContent = mode === 'replace' ? 'Save replacement' : 'Save changes';
  $('#btn-cancel-edit').hidden = false;
  $('#editor-card').classList.add('is-editing');
  switchTab('evidence');
  editorRefresh();
  code.focus();
  code.setSelectionRange(0, 0);
  code.scrollTop = 0;
  renderSnippetList();
}

function endEdit() {
  S.editing = null;
  $('#code').value = '';
  $('#input-type').value = 'auto';
  $('#editor-title').textContent = 'Paste evidence';
  $('#editor-lede').textContent = 'Paste one item at a time — a test class, a production class, a JaCoCo report, test results or a change list.';
  $('#btn-add').lastChild.textContent = 'Add to review';
  $('#btn-cancel-edit').hidden = true;
  $('#editor-card').classList.remove('is-editing');
  editorRefresh();
  renderSnippetList();
}

function addManualFigure() {
  const err = $('#m-error');
  err.textContent = '';
  const scope = ($('#m-scope').value || 'Overall').replace(/[\r\n\t]+/g, ' ').trim() || 'Overall';
  const metric = $('#m-metric').value;
  const cov = $('#m-covered').value.trim();
  const tot = $('#m-total').value.trim();
  const pct = $('#m-percent').value.trim();
  let value = '';
  if (cov !== '' && tot !== '') {
    const c = Number(cov), t = Number(tot);
    if (!Number.isInteger(c) || !Number.isInteger(t) || c < 0 || t <= 0 || c > t) { err.textContent = 'Covered and total must be whole numbers with covered ≤ total.'; return; }
    value = c + ' of ' + t;
  } else if (pct !== '') {
    const p = Number(pct);
    if (!Number.isFinite(p) || p < 0 || p > 100) { err.textContent = 'Percent must be between 0 and 100.'; return; }
    value = p + '%';
  } else { err.textContent = 'Enter covered and total, or a percentage.'; return; }
  const text = (scope === 'Overall' ? '' : scope + ' ') + metric + ' coverage: ' + value;
  newSnippet(text, 'summary', $('#m-provenance').value);
  for (const id of ['#m-covered', '#m-total', '#m-percent']) $(id).value = '';
  toast('Declared figure added (' + $('#m-provenance').value + ', not verified).');
}

/* ---------- Collected evidence list ---------- */

function renderCounters() {
  const host = clear($('#counters'));
  const A = S.result;
  const inv = A ? A.inventory : null;
  const by = (t) => (A ? A.snippets.filter((s) => s.type === t && !s.duplicateOf).length : 0);
  const items = [
    ['Test classes', inv ? inv.testClasses : 0, 'test'],
    ['Test methods', inv ? inv.testMethods : 0, 'test'],
    ['Production classes', inv ? inv.prodClasses : 0, 'code'],
    ['JaCoCo reports', by('jacoco'), 'chart'],
    ['Result sets', by('results'), 'run'],
    ['Scope lists', by('scope'), 'diff'],
    ['Declared figures', by('summary'), 'sum'],
  ];
  for (const [label, n, icon] of items) host.appendChild(h('div', { class: 'counter' + (n ? '' : ' zero') }, svg(icon), h('span', { class: 'counter-n', text: String(n) }), h('span', { class: 'counter-l', text: label })));
}

function renderSnippetList() {
  const host = clear($('#snippet-list'));
  if (!S.snippets.length) {
    host.appendChild(h('div', { class: 'empty' },
      h('p', { class: 'empty-title', text: 'No evidence yet' }),
      h('p', { text: 'Paste a test class on the left and choose “Add to review”. Repeat for every test class, production class, JaCoCo report, result file and change list in this enhancement.' })));
    return;
  }
  const infoById = new Map((S.result ? S.result.snippets : []).map((s) => [s.id, s]));
  for (const sn of S.snippets.slice().sort((a, b) => b.seq - a.seq)) {
    const info = infoById.get(sn.id);
    const eff = info ? info.type : null;
    const warn = [];
    if (info && info.incomplete) warn.push(chip('Possibly incomplete', 'chip-warn', info.incompleteReasons.join(' ')));
    if (info && info.duplicateOf) warn.push(chip('Duplicate of #' + info.duplicateOf, 'chip-muted'));
    if (info && info.typeWarning) warn.push(chip('Type check', 'chip-warn', info.typeWarning));
    if (info && info.unrecognised) warn.push(chip('Not recognised', 'chip-bad', info.unrecognised));
    const dupCls = S.result ? S.result.duplicateClasses.filter((d) => d.dropped.includes(sn.seq)) : [];
    if (dupCls.length) warn.push(chip(dupCls[0].identical ? 'Class pasted again' : 'Superseded by #' + dupCls[0].kept, 'chip-muted', dupCls.map((d) => d.fqcn).join(', ')));

    const typeSel = h('select', { class: 'mini-select', 'aria-label': 'Input type for snippet #' + sn.seq });
    for (const k of Object.keys(JR.INPUT_TYPES)) typeSel.appendChild(h('option', { value: k, text: k === 'auto' ? 'Auto (' + (eff ? TYPE_SHORT[eff] : '?') + ')' : JR.INPUT_TYPES[k] }));
    typeSel.value = sn.type;
    typeSel.addEventListener('change', () => updateSnippet(sn.id, { type: typeSel.value }));
    let prov = null;
    if (eff === 'summary') {
      prov = h('select', { class: 'mini-select', 'aria-label': 'Source of figures for snippet #' + sn.seq }, h('option', { value: 'Vendor-declared', text: 'Vendor-declared' }), h('option', { value: 'User-entered', text: 'User-entered' }));
      prov.value = sn.provenance || 'Vendor-declared';
      prov.addEventListener('change', () => updateSnippet(sn.id, { provenance: prov.value }));
    }
    const classes = info && info.classes.length ? info.classes : [];
    const card = h('article', { class: 'snippet' + (S.editing && S.editing.id === sn.id ? ' is-editing' : '') + (info && info.duplicateOf ? ' is-dup' : ''), 'aria-label': 'Snippet ' + sn.seq },
      h('div', { class: 'snippet-head' },
        h('span', { class: 'snippet-n', text: '#' + sn.seq }),
        h('span', { class: 'type-tag type-' + (eff || 'unknown') }, svg(TYPE_ICON[eff] || 'doc'), h('span', { text: eff ? TYPE_SHORT[eff] : 'Unknown' })),
        h('span', { class: 'snippet-label', title: info ? info.label : '', text: info ? info.label : 'Analysing…' })),
      h('div', { class: 'snippet-meta' },
        h('span', { text: (info && info.summary ? info.summary + ' · ' : '') + plural(sn.text.split('\n').length, 'line') }),
        classes.length > 1 ? h('span', { class: 'muted', text: classes.map((c) => c.name.split('.').pop()).join(', ') }) : null),
      warn.length ? h('div', { class: 'snippet-warn' }, warn) : null,
      h('div', { class: 'snippet-actions' },
        typeSel, prov,
        h('span', { class: 'spacer' }),
        button('View', { class: 'btn btn-ghost btn-sm', onclick: () => openViewer(sn.id), 'aria-label': 'View snippet #' + sn.seq }, 'eye'),
        button('Edit', { class: 'btn btn-ghost btn-sm', onclick: () => beginEdit(sn.id, 'edit'), 'aria-label': 'Edit snippet #' + sn.seq }, 'edit'),
        button('Replace', { class: 'btn btn-ghost btn-sm', onclick: () => beginEdit(sn.id, 'replace'), 'aria-label': 'Replace snippet #' + sn.seq }, 'swap'),
        button('Remove', { class: 'btn btn-ghost btn-sm btn-danger', onclick: () => {
          const removed = removeSnippet(sn.id);
          if (removed) toast('Snippet #' + removed.seq + ' removed.', { action: { label: 'Undo', run: () => restoreSnippet(removed) }, ms: 7000 });
        }, 'aria-label': 'Remove snippet #' + sn.seq }, 'trash')));
    host.appendChild(card);
  }
}
