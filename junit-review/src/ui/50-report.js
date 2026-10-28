/* ------------------------------------------------------------------------
 * Report step: formatted text and Excel-ready tab-separated tables, copied
 * to the clipboard only on request. No file downloads.
 * --------------------------------------------------------------------- */

let reportCache = { version: -1, text: '', tsv: '' };

function ensureReport() {
  if (!S.result) return reportCache;
  if (reportCache.version === S.analysisVersion) return reportCache;
  reportCache = { version: S.analysisVersion, text: JR.buildTextReport(S.result), tsv: JR.buildTsvReport(S.result) };
  return reportCache;
}

function renderReport() {
  const r = ensureReport();
  $('#report-text').value = r.text;
  $('#report-tsv').value = r.tsv;
}

async function copyText(text, what) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) { ok = false; }
  if (!ok) {
    // Fallback for browsers or policies without the async clipboard API.
    const ta = h('textarea', { class: 'clip-buffer', 'aria-hidden': 'true', readonly: true });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
  }
  if (ok) toast(what + ' copied to the clipboard (' + fmt(text.length) + ' characters).', { kind: 'ok' });
  else toast('The browser blocked clipboard access. Click in the box, press Ctrl+A then Ctrl+C to copy manually.', { kind: 'warn', ms: 8000 });
  return ok;
}

function initReport() {
  $('#btn-copy-text').addEventListener('click', () => { const r = ensureReport(); copyText(r.text, 'Formatted report'); });
  $('#btn-copy-tsv').addEventListener('click', () => { const r = ensureReport(); copyText(r.tsv, 'Excel tables'); });
  $('#btn-copy-one').addEventListener('click', () => {
    if (!S.result) return;
    const which = $('#tsv-which').value;
    copyText(JR.buildTsvReport(S.result, which), $('#tsv-which').selectedOptions[0].textContent + ' table');
  });
  $('#btn-print').addEventListener('click', () => {
    const r = ensureReport();
    const root = clear($('#print-root'));
    root.appendChild(h('pre', { class: 'print-pre', text: r.text }));
    window.print();
  });
  for (const id of ['#report-text', '#report-tsv']) $(id).addEventListener('focus', (e) => e.target.select());
}
