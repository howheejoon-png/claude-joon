/* ------------------------------------------------------------------------
 * Wiring: tabs, the enhancement form, header facts, re-rendering.
 * --------------------------------------------------------------------- */

const TABS = ['enhancement', 'evidence', 'review', 'report'];

function switchTab(name) {
  if (!TABS.includes(name)) return;
  S.tab = name;
  for (const t of TABS) {
    const tab = $('#tab-' + t);
    const panel = $('#panel-' + t);
    const on = t === name;
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  if (name === 'review') renderDashboardIfStale();
  if (name === 'report') renderReport();
  window.scrollTo({ top: 0 });
}

function renderDashboardIfStale() {
  if (S.renderedVersion === S.analysisVersion && S.result) return;
  const y = window.scrollY;
  renderDashboard();
  S.renderedVersion = S.analysisVersion;
  window.scrollTo({ top: y });
}

function initTabs() {
  for (const t of TABS) $('#tab-' + t).addEventListener('click', () => switchTab(t));
  $('.steps').addEventListener('keydown', (e) => {
    const i = TABS.indexOf(S.tab);
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = TABS.length - 1;
    if (j < 0) return;
    e.preventDefault();
    switchTab(TABS[j]);
    $('#tab-' + TABS[j]).focus();
  });
  $('#btn-to-evidence').addEventListener('click', () => { switchTab('evidence'); $('#code').focus(); });
  $('#btn-to-review').addEventListener('click', () => switchTab('review'));
}

function initForm() {
  const metricsHost = $('#f-metrics');
  for (const m of JR.METRICS) {
    const id = 'f-m-' + m.toLowerCase();
    const cb = h('input', { type: 'checkbox', id, value: m });
    cb.checked = S.review.gatedMetrics.includes(m);
    cb.addEventListener('change', () => {
      const list = JR.METRICS.filter((x) => $('#f-m-' + x.toLowerCase()).checked);
      if (!list.length) { cb.checked = true; toast('At least one metric must be assessed.', { kind: 'warn' }); return; }
      setReview({ gatedMetrics: list });
    });
    metricsHost.appendChild(h('label', { class: 'check', for: id }, cb, h('span', { text: JR.METRIC_LABEL[m] })));
  }
  const bind = (sel, key, transform) => {
    const el = $(sel);
    el.addEventListener('input', debounce(() => setReview({ [key]: transform ? transform(el.value) : el.value }), 200));
  };
  bind('#f-cr', 'crRef');
  bind('#f-app', 'appName');
  bind('#f-module', 'moduleName');
  bind('#f-scope', 'scopeDesc');
  const th = $('#f-threshold');
  th.addEventListener('change', () => {
    let v = Number(th.value);
    if (!Number.isFinite(v) || th.value === '') v = 100;
    v = Math.min(100, Math.max(0, v));
    th.value = String(v);
    setReview({ threshold: v });
  });
  $('#review-form').addEventListener('submit', (e) => e.preventDefault());
}

function syncFormFromState() {
  $('#f-cr').value = S.review.crRef || '';
  $('#f-app').value = S.review.appName || '';
  $('#f-module').value = S.review.moduleName || '';
  $('#f-scope').value = S.review.scopeDesc || '';
  $('#f-threshold').value = String(S.review.threshold);
  for (const m of JR.METRICS) $('#f-m-' + m.toLowerCase()).checked = (S.review.gatedMetrics || []).includes(m);
}

function updateHeader() {
  const A = S.result;
  $('#fact-cr').textContent = S.review.crRef ? S.review.crRef + (S.review.appName ? ' · ' + S.review.appName : '') : 'No CR reference';
  const inv = A ? A.inventory : { testClasses: 0, testMethods: 0 };
  $('#fact-tests').textContent = plural(inv.testClasses, 'test class', 'test classes') + ' · ' + plural(inv.testMethods, 'test method');
  const st = clear($('#fact-status'));
  if (A && S.snippets.length) st.appendChild(statusBadge(A.conclusion.status));
  $('#step-count-evidence').textContent = S.snippets.length ? String(S.snippets.length) : '';
  const rs = clear($('#step-status-review'));
  if (A && S.snippets.length) rs.appendChild(h('span', { class: 'dot dot-' + STATUS_CLASS[A.conclusion.status], title: A.conclusion.status }));
}

function onStateEvent(kind) {
  if (kind === 'analysed') {
    setBusy(false);
    if (S.analysisError) toast('Analysis error: ' + S.analysisError.message, { kind: 'warn', ms: 9000 });
    renderCounters();
    renderSnippetList();
    updateHeader();
    if (S.tab === 'review') renderDashboardIfStale();
    if (S.tab === 'report') renderReport();
  } else {
    renderSnippetList();
    updateHeader();
  }
}

function init() {
  onChange(onStateEvent);
  initTabs();
  initForm();
  initEditor();
  initReport();
  initSession();
  $('#viewer-close').addEventListener('click', closeViewer);
  $('#viewer').addEventListener('click', (e) => { if (e.target === $('#viewer')) closeViewer(); });
  syncFormFromState();
  renderSnippetList();
  renderCounters();
  updateHeader();
  changed('init');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
