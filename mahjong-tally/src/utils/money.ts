import type { Cents, RoundingMode } from '../models/types';

/** True when `value` is a safe integer (valid cents). */
export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertCents(value: unknown, label = 'amount'): asserts value is Cents {
  if (!isCents(value)) {
    throw new Error(`${label} must be an integer number of cents, got ${String(value)}`);
  }
}

/** Sum integer cents, throwing if any operand is not an integer. */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  assertCents(total, 'sum');
  return total;
}

/**
 * Format integer cents as currency text WITHOUT floating-point arithmetic.
 * The dollars/cents split uses integer division and string padding only.
 */
export function formatCents(
  cents: Cents,
  opts: { signed?: boolean; symbol?: string } = {},
): string {
  assertCents(cents);
  const { signed = false, symbol = '$' } = opts;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.trunc(abs / 100);
  const rem = abs - dollars * 100;
  const dollarText = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `${symbol}${dollarText}.${rem.toString().padStart(2, '0')}`;
  if (negative) return `-${body}`;
  if (signed && cents > 0) return `+${body}`;
  return body;
}

/**
 * Parse user-entered money text into integer cents using string arithmetic
 * only. Accepts "4", "4.5", "4.50", "$4.50", ".3", "1,234.56".
 * Returns null for invalid input or more than two decimal places.
 */
export function parseMoney(text: string): Cents | null {
  const cleaned = text.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const match = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, wholeRaw = '', fracRaw = ''] = match;
  if (wholeRaw === '' && fracRaw === '') return null;
  const whole = wholeRaw === '' ? 0 : Number.parseInt(wholeRaw, 10);
  const frac = Number.parseInt(fracRaw.padEnd(2, '0') || '0', 10);
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return null;
  return sign ? -cents : cents;
}

/** Cents to an editable decimal string ("4.50"). */
export function centsToInput(cents: Cents): string {
  return formatCents(cents, { symbol: '' }).replace(/,/g, '');
}

/** Exact floor division for integers (handles negatives). */
function floorDiv(num: number, den: number): { q: number; r: number } {
  let q = Math.trunc(num / den);
  let r = num - q * den;
  // Correct any float drift in the truncated quotient using exact integer remainders.
  while (r < 0) {
    q -= 1;
    r += den;
  }
  while (r >= den) {
    q += 1;
    r -= den;
  }
  return { q, r };
}

export interface RationalRounding {
  /** Rounded amount in cents, or null if `exact` mode and not a whole cent. */
  cents: Cents | null;
  /** True if the input was not already on the requested increment. */
  adjusted: boolean;
}

/**
 * Round the exact rational amount `numerator / denominator` cents using the
 * given rule. All arithmetic is integer-only. `exact` mode returns null when
 * the amount is not a whole number of cents.
 */
export function roundRational(
  numerator: number,
  denominator: number,
  mode: RoundingMode,
  incrementCents: number,
): RationalRounding {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('roundRational requires integer numerator and positive integer denominator');
  }
  if (mode === 'exact') {
    const { q, r } = floorDiv(numerator, denominator);
    return r === 0 ? { cents: q, adjusted: false } : { cents: null, adjusted: false };
  }
  if (!Number.isSafeInteger(incrementCents) || incrementCents <= 0) {
    throw new Error('Rounding increment must be a positive integer number of cents');
  }
  // Work in units of `incrementCents`: value = numerator / (denominator * inc).
  const den = denominator * incrementCents;
  const { q, r } = floorDiv(numerator, den);
  if (r === 0) return { cents: q * incrementCents, adjusted: false };
  let units: number;
  if (mode === 'down') units = q;
  else if (mode === 'up') units = q + 1;
  else units = 2 * r >= den ? q + 1 : q; // nearest, half-up
  return { cents: units * incrementCents, adjusted: true };
}

/**
 * Split `total` cents across weights proportionally using the largest
 * remainder method. The result always sums exactly to `total`. Ties are
 * broken by input order (deterministic).
 */
export function allocateProportionally(total: Cents, weights: readonly number[]): Cents[] {
  assertCents(total, 'total');
  if (total < 0) throw new Error('allocateProportionally requires a non-negative total');
  weights.forEach((w) => assertCents(w, 'weight'));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const base: number[] = [];
  const remainders: { index: number; r: number }[] = [];
  let allocated = 0;
  if (!Number.isSafeInteger(weightSum)) throw new Error('allocateProportionally: weights are too large');
  weights.forEach((w, index) => {
    const product = total * w;
    // Beyond 2^53 the product is inexact and the split could stop summing to `total`.
    if (!Number.isSafeInteger(product)) throw new Error('allocateProportionally: amounts are too large to split exactly');
    const { q, r } = floorDiv(product, weightSum);
    base.push(q);
    allocated += q;
    remainders.push({ index, r });
  });
  let leftover = total - allocated;
  remainders.sort((a, b) => b.r - a.r || a.index - b.index);
  for (const { index } of remainders) {
    if (leftover <= 0) break;
    base[index] = (base[index] ?? 0) + 1;
    leftover -= 1;
  }
  return base;
}
