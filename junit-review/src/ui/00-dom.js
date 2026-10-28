/* ------------------------------------------------------------------------
 * DOM helpers. All pasted text reaches the page through textContent or
 * setAttribute on attributes chosen here in code — never through HTML
 * parsing — so pasted <script> or onerror= text is inert.
 * --------------------------------------------------------------------- */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === '') continue;
    el.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
  }
  return el;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

function svg(name, cls) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', 'icon' + (cls ? ' ' + cls : ''));
  const paths = ICONS[name] || ICONS.dot;
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
  }
  return s;
}

const ICONS = {
  pass: ['M5 12.5l4.2 4.2L19 7'],
  fail: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  review: ['M12 5v8.5', 'M12 17.6v.4'],
  insufficient: ['M9.2 9.2a2.9 2.9 0 1 1 4.1 2.7c-.9.4-1.3 1-1.3 1.9v.7', 'M12 17.6v.4'],
  na: ['M7 12h10'],
  dot: ['M12 12h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  eye: ['M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z', 'M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4z', 'M13.5 6.5l4 4'],
  swap: ['M7 7h11l-3-3', 'M17 17H6l3 3'],
  trash: ['M5 7h14', 'M10 7V5h4v2', 'M7 7l1 13h8l1-13'],
  copy: ['M9 9h10v11H9z', 'M5 15V4h10'],
  print: ['M7 9V4h10v5', 'M7 17H5V10h14v7h-2', 'M7 14h10v6H7z'],
  shield: ['M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z', 'M9 12l2 2 4-4'],
  doc: ['M7 3h7l5 5v13H7z', 'M14 3v5h5'],
  test: ['M9 3h6', 'M10 3v6L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3'],
  code: ['M8 8l-4 4 4 4', 'M16 8l4 4-4 4', 'M13.5 5l-3 14'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  diff: ['M12 4v6', 'M9 7h6', 'M9 17h6', 'M5 21h14'],
  run: ['M7 5l12 7-12 7V5z'],
  sum: ['M17 5H7l6 7-6 7h10'],
  backup: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 20h14'],
  restore: ['M12 21V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  reset: ['M4 12a8 8 0 1 0 2.3-5.7', 'M4 4v4h4'],
  chevron: ['M9 6l6 6-6 6'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  info: ['M12 11v6', 'M12 7.4v.4'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  filter: ['M4 5h16l-6 8v5l-4 2v-7z'],
};

const STATUS_CLASS = {
  'Verified Pass': 'pass',
  'Verified Fail': 'fail',
  'Requires Review': 'review',
  'Insufficient Evidence': 'insufficient',
  'Not Applicable': 'na',
};

function statusBadge(status, opts) {
  const cls = STATUS_CLASS[status] || 'na';
  return h('span', { class: 'badge badge-' + cls + (opts && opts.large ? ' badge-lg' : ''), title: opts && opts.title }, svg(cls), h('span', { text: status + (opts && opts.suffix ? opts.suffix : '') }));
}

function note(kids, strong) {
  return h('div', { class: 'note' + (strong ? ' note-strong' : '') }, svg('info'), h('p', {}, kids));
}

function chip(text, cls, title) {
  return h('span', { class: 'chip' + (cls ? ' ' + cls : ''), title }, text);
}

function sevChip(sev) {
  return chip(sev, 'sev sev-' + String(sev).toLowerCase());
}

function certChip(c) {
  return chip(c, 'cert cert-' + String(c).toLowerCase(), c === 'Definite' ? 'Directly observed in the evidence' : 'Heuristic — needs a reviewer to confirm');
}

function button(label, attrs, icon) {
  const a = Object.assign({ type: 'button', class: 'btn' }, attrs || {});
  return h('button', a, icon ? svg(icon) : null, h('span', { text: label }));
}

function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many || one + 's');
}

function fmt(n) {
  return JR.fmtInt(n);
}

function toast(message, opts) {
  const host = $('#toasts');
  const t = h('div', { class: 'toast' + (opts && opts.kind ? ' toast-' + opts.kind : ''), role: 'status' }, h('span', { text: message }));
  if (opts && opts.action) {
    t.appendChild(button(opts.action.label, { class: 'btn btn-ghost btn-sm', onclick: () => { opts.action.run(); t.remove(); } }));
  }
  host.appendChild(t);
  while (host.children.length > 2) host.removeChild(host.firstChild);
  requestAnimationFrame(() => t.classList.add('in'));
  const ms = (opts && opts.ms) || 4200;
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
}

function showDialog(dlg) {
  if (dlg.open) return;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
}

function hideDialog(dlg) {
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
}

function debounce(fn, ms) {
  let t = null;
  return function () {
    const args = arguments;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), ms);
  };
}
