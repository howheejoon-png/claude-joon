/* ------------------------------------------------------------------------
 * Session controls. The workspace is never stored by the page; a backup is
 * plain text the user copies and keeps wherever their rules allow, and can
 * paste back later.
 * --------------------------------------------------------------------- */

const BACKUP_FORMAT = 'junit-review-workspace';
const MAX_BACKUP_CHARS = 60 * 1024 * 1024;

function openModal(title, bodyNodes, actions) {
  const dlg = $('#modal');
  $('#modal-title').textContent = title;
  append(clear($('#modal-body')), bodyNodes);
  const host = clear($('#modal-actions'));
  for (const a of actions) {
    host.appendChild(button(a.label, { class: 'btn ' + (a.cls || ''), onclick: () => { const keep = a.run && a.run() === false; if (!keep) dlg.close(); } }));
  }
  if (!dlg.open) dlg.showModal();
  const first = $('textarea, input, .btn-primary', dlg);
  if (first) first.focus();
}

function backupText() {
  return JSON.stringify({
    format: BACKUP_FORMAT, version: 1, createdBy: 'JUnit Review ' + JR.version, review: S.review,
    snippets: S.snippets.map((s) => ({ seq: s.seq, type: s.type, provenance: s.provenance, text: s.text })),
  });
}

function initSession() {
  $('#btn-backup').addEventListener('click', () => {
    const text = backupText();
    const ta = h('textarea', { class: 'modal-text', readonly: true, rows: 6, spellcheck: 'false', 'aria-label': 'Workspace backup text' });
    ta.value = text;
    ta.addEventListener('focus', () => ta.select());
    openModal('Copy workspace backup', [
      h('p', {}, 'This text contains everything in the workspace, ', h('strong', { text: 'including all pasted source code' }), '. Keep it only where that code is permitted. Paste it back with “Restore” to continue later.'),
      ta,
    ], [
      { label: 'Copy to clipboard', cls: 'btn-primary', run: () => { copyText(text, 'Workspace backup'); } },
      { label: 'Close', cls: 'btn-ghost' },
    ]);
  });

  $('#btn-restore').addEventListener('click', () => {
    const ta = h('textarea', { class: 'modal-text', rows: 8, spellcheck: 'false', placeholder: 'Paste backup text here…', 'aria-label': 'Backup text to restore', 'data-gramm': 'false' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    openModal('Restore a workspace', [
      h('p', { text: 'Paste the text produced by “Copy backup”. It replaces the current workspace.' }), ta, err,
    ], [
      { label: 'Restore', cls: 'btn-primary', run: () => {
        const res = parseBackup(ta.value);
        if (res.error) { err.textContent = res.error; return false; }
        S.review = Object.assign(JR.defaultReview(), res.review);
        S.snippets = [];
        S.nextSeq = 1;
        S.editing = null;
        for (const s of res.snippets) {
          const now = tick();
          S.snippets.push({ id: 's' + s.seq + '-' + (now % 100000), seq: s.seq, type: s.type, provenance: s.provenance, text: s.text, addedAt: now, updatedAt: now });
          S.nextSeq = Math.max(S.nextSeq, s.seq + 1);
        }
        syncFormFromState();
        changed('restore');
        toast('Workspace restored: ' + plural(S.snippets.length, 'snippet') + '.', { kind: 'ok' });
        return true;
      } },
      { label: 'Cancel', cls: 'btn-ghost' },
    ]);
  });

  $('#btn-clear').addEventListener('click', () => {
    openModal('Clear the session?', [h('p', { text: 'All enhancement details and pasted evidence will be discarded from this tab. This cannot be undone unless you copied a backup.' })], [
      { label: 'Clear everything', cls: 'btn-danger-solid', run: () => { resetWorkspace(); syncFormFromState(); endEdit(); switchTab('enhancement'); toast('Session cleared.'); } },
      { label: 'Cancel', cls: 'btn-ghost' },
    ]);
  });

  window.addEventListener('beforeunload', (e) => {
    if (!S.snippets.length && !S.review.crRef && !S.review.appName) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

function parseBackup(text) {
  const t = String(text || '').trim();
  if (!t) return { error: 'Paste the backup text first.' };
  if (t.length > MAX_BACKUP_CHARS) return { error: 'The backup is too large.' };
  let data;
  try { data = JSON.parse(t); } catch (e) { return { error: 'This is not valid backup text (it could not be read as JSON).' }; }
  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.snippets)) return { error: 'This text is not a JUnit Review workspace backup.' };
  const review = {};
  const r = data.review || {};
  for (const k of ['crRef', 'appName', 'moduleName', 'scopeDesc']) review[k] = typeof r[k] === 'string' ? r[k].slice(0, 4000) : '';
  review.threshold = Number.isFinite(Number(r.threshold)) ? Number(r.threshold) : 100;
  review.gatedMetrics = Array.isArray(r.gatedMetrics) ? r.gatedMetrics.filter((m) => JR.METRICS.includes(m)) : JR.METRICS.slice();
  const snippets = [];
  const seen = new Set();
  for (const s of data.snippets) {
    if (!s || typeof s.text !== 'string') continue;
    let seq = Number.isInteger(s.seq) && s.seq > 0 ? s.seq : 0;
    if (!seq || seen.has(seq)) seq = Math.max(0, ...Array.from(seen)) + 1;
    seen.add(seq);
    snippets.push({ seq, type: JR.INPUT_TYPES[s.type] ? s.type : 'auto', provenance: s.provenance === 'User-entered' ? 'User-entered' : 'Vendor-declared', text: s.text.replace(/\r\n?/g, '\n') });
  }
  snippets.sort((a, b) => a.seq - b.seq);
  return { review, snippets };
}
