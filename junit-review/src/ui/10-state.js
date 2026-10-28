/* ------------------------------------------------------------------------
 * Workspace state — held in memory only. Nothing is written to
 * localStorage, sessionStorage, IndexedDB or cookies; closing the tab
 * discards everything.
 * --------------------------------------------------------------------- */

const S = {
  review: JR.defaultReview(),
  snippets: [],
  nextSeq: 1,
  clock: 0,
  result: null,
  analysisVersion: 0,
  renderedVersion: -1,
  editing: null,      // { id, mode: 'edit' | 'replace' } while the editor holds an existing snippet
  tab: 'enhancement',
};

const listeners = [];
function onChange(fn) { listeners.push(fn); }

function tick() {
  S.clock += 1;
  return Date.now() * 1000 + S.clock; // strictly increasing, used to pick the latest version of a class
}

function newSnippet(text, type, provenance) {
  const now = tick();
  const sn = { id: 's' + S.nextSeq + '-' + (now % 100000), seq: S.nextSeq++, type: type || 'auto', provenance: provenance || 'Vendor-declared', text, addedAt: now, updatedAt: now };
  S.snippets.push(sn);
  changed('add');
  return sn;
}

function updateSnippet(id, patch) {
  const sn = S.snippets.find((x) => x.id === id);
  if (!sn) return null;
  Object.assign(sn, patch);
  if ('text' in patch) sn.updatedAt = tick();
  changed('update');
  return sn;
}

function removeSnippet(id) {
  const i = S.snippets.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [sn] = S.snippets.splice(i, 1);
  if (S.editing && S.editing.id === id) S.editing = null;
  changed('remove');
  return sn;
}

function restoreSnippet(sn) {
  S.snippets.push(sn);
  S.snippets.sort((a, b) => a.seq - b.seq);
  changed('restore');
}

function setReview(patch) {
  Object.assign(S.review, patch);
  changed('review');
}

function resetWorkspace() {
  S.review = JR.defaultReview();
  S.snippets = [];
  S.nextSeq = 1;
  S.editing = null;
  changed('reset');
}

const runAnalysis = debounce(() => {
  const t0 = performance.now();
  try {
    S.result = JR.analyze({ review: S.review, snippets: S.snippets }, { now: new Date().toLocaleString() });
    S.analysisError = null;
  } catch (e) {
    S.analysisError = e;
    console.error(e);
  }
  S.analysisVersion++;
  S.analysisMs = Math.round(performance.now() - t0);
  for (const fn of listeners) fn('analysed');
}, 220);

function changed(kind) {
  for (const fn of listeners) fn(kind);
  setBusy(true);
  runAnalysis();
}

function setBusy(on) {
  const el = $('#analysis-status');
  if (!el) return;
  el.textContent = on ? 'Analysing…' : '';
}
