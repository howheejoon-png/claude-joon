/* ------------------------------------------------------------------------
 * Shared helpers. Everything in the engine is a pure function of its input:
 * no DOM, no storage, no network, no clock except where a timestamp is
 * passed in. That keeps it testable outside a browser.
 * --------------------------------------------------------------------- */

const STATUS = {
  PASS: 'Verified Pass',
  FAIL: 'Verified Fail',
  REVIEW: 'Requires Review',
  INSUFFICIENT: 'Insufficient Evidence',
  NA: 'Not Applicable',
};

// Worst-first precedence used when several statuses roll up into one.
const STATUS_RANK = {
  [STATUS.FAIL]: 4,
  [STATUS.INSUFFICIENT]: 3,
  [STATUS.REVIEW]: 2,
  [STATUS.PASS]: 1,
  [STATUS.NA]: 0,
};

function worstStatus(list) {
  let worst = STATUS.NA;
  for (const s of list) if (s && STATUS_RANK[s] > STATUS_RANK[worst]) worst = s;
  return worst;
}

const INPUT_TYPES = {
  auto: 'Auto Detect',
  test: 'JUnit Test Code',
  source: 'Production Source Code',
  jacoco: 'JaCoCo Coverage Report',
  results: 'JUnit Execution Results',
  scope: 'Enhancement Change Scope',
  summary: 'Declared Coverage Summary',
};

const METRICS = ['INSTRUCTION', 'BRANCH', 'LINE', 'METHOD', 'CLASS'];
const METRIC_LABEL = {
  INSTRUCTION: 'Instruction',
  BRANCH: 'Branch',
  LINE: 'Line',
  METHOD: 'Method',
  CLASS: 'Class',
  COMPLEXITY: 'Complexity',
};

function normalizeNewlines(s) {
  return String(s == null ? '' : s).replace(/\r\n?/g, '\n');
}

// FNV-1a, 32-bit. Only used to recognise identical pastes — not security.
function hashText(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function contentKey(text) {
  return hashText(normalizeNewlines(text).replace(/[ \t]+$/gm, '').trim());
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function simpleNameOf(name) {
  if (!name) return '';
  const s = String(name).replace(/\//g, '.');
  const i = s.lastIndexOf('.');
  return i < 0 ? s : s.slice(i + 1);
}

function packageOf(fqcn) {
  const i = fqcn.lastIndexOf('.');
  return i < 0 ? '' : fqcn.slice(0, i);
}

function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : (many || one + 's'));
}

/* Coverage arithmetic.
 *
 * Percentages are computed from integer counts and FLOORED to two decimal
 * places, so 9999 of 10000 shows as 99.99% and nothing short of zero missed
 * can ever show as 100%. Threshold comparisons use exact integer maths.
 */
function pctText(covered, total) {
  if (!total) return 'N/A';
  if (covered >= total) return '100.00%';
  const basisPoints = Math.floor((covered * 10000) / total); // exact for realistic counts
  const capped = Math.min(basisPoints, 9999);
  return (capped / 100).toFixed(2) + '%';
}

function pctNumber(covered, total) {
  if (!total) return null;
  if (covered >= total) return 100;
  return Math.min(Math.floor((covered * 10000) / total), 9999) / 100;
}

// threshold is a percentage (0–100, up to 4 decimal places).
function meetsThreshold(covered, total, threshold) {
  if (!total) return null;
  const t = Number(threshold);
  if (t >= 100) return covered === total;
  const scaled = BigInt(Math.round(t * 10000));
  return BigInt(covered) * 1000000n >= scaled * BigInt(total);
}

function counterOf(counters, type) {
  const c = counters && counters[type];
  const missed = c ? c.missed : 0;
  const covered = c ? c.covered : 0;
  return { type, missed, covered, total: missed + covered, present: !!c };
}

function addCounters(into, from) {
  for (const k of Object.keys(from || {})) {
    if (!into[k]) into[k] = { missed: 0, covered: 0 };
    into[k].missed += from[k].missed;
    into[k].covered += from[k].covered;
  }
  return into;
}

function metricRow(counters, type, threshold) {
  const c = counterOf(counters, type);
  const na = c.total === 0;
  return {
    type,
    label: METRIC_LABEL[type] || type,
    missed: c.missed,
    covered: c.covered,
    total: c.total,
    na,
    pct: pctText(c.covered, c.total),
    pctValue: pctNumber(c.covered, c.total),
    strict: na ? null : c.missed === 0,
    meets: na ? null : meetsThreshold(c.covered, c.total, threshold),
  };
}

function fmtInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
