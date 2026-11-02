import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  allocateProportionally,
  centsToInput,
  formatCents,
  isCents,
  parseMoney,
  roundRational,
  sumCents,
} from '../utils/money';

describe('integer-cent money helpers', () => {
  it('formats cents without floating-point drift', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(30)).toBe('$0.30');
    expect(formatCents(60)).toBe('$0.60');
    expect(formatCents(450)).toBe('$4.50');
    expect(formatCents(1)).toBe('$0.01');
    expect(formatCents(-930)).toBe('-$9.30');
    expect(formatCents(1860, { signed: true })).toBe('+$18.60');
    expect(formatCents(0, { signed: true })).toBe('$0.00');
    expect(formatCents(123456789)).toBe('$1,234,567.89');
  });

  it('rejects non-integer cents when formatting', () => {
    expect(() => formatCents(0.1 + 0.2)).toThrow();
    expect(() => formatCents(Number.NaN)).toThrow();
  });

  it('parses user-entered money with string arithmetic only', () => {
    expect(parseMoney('0.30')).toBe(30);
    expect(parseMoney('.3')).toBe(30);
    expect(parseMoney('4.5')).toBe(450);
    expect(parseMoney('$4.50')).toBe(450);
    expect(parseMoney('4')).toBe(400);
    expect(parseMoney('1,234.56')).toBe(123456);
    expect(parseMoney('0.1')).toBe(10);
    expect(parseMoney('0.29')).toBe(29); // 0.29 * 100 in floats is 28.999999999999996
    expect(parseMoney('1.005')).toBeNull(); // more than 2 decimals
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('.')).toBeNull();
    expect(parseMoney('-2.10')).toBe(-210);
  });

  it('0.1 + 0.2 style sums stay exact when kept in cents', () => {
    expect(sumCents([10, 20])).toBe(30);
    expect(formatCents(sumCents([10, 20]))).toBe('$0.30');
    expect(() => sumCents([0.1, 0.2])).toThrow();
  });

  it('round-trips format/parse for any cents value', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10_000_000, max: 10_000_000 }), (c) => {
        expect(parseMoney(formatCents(c))).toBe(c);
        expect(parseMoney(centsToInput(c))).toBe(c);
      }),
    );
  });

  it('isCents accepts only safe integers', () => {
    expect(isCents(30)).toBe(true);
    expect(isCents(0)).toBe(true);
    expect(isCents(4.5)).toBe(false);
    expect(isCents('30')).toBe(false);
    expect(isCents(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('roundRational', () => {
  it('exact mode returns null for fractional cents', () => {
    expect(roundRational(45, 2, 'exact', 1).cents).toBeNull(); // 22.5¢
    expect(roundRational(60, 2, 'exact', 1).cents).toBe(30);
  });

  it('nearest rounds half-up to the increment', () => {
    expect(roundRational(45, 2, 'nearest', 1)).toEqual({ cents: 23, adjusted: true }); // 22.5 → 23
    expect(roundRational(45, 1, 'nearest', 10)).toEqual({ cents: 50, adjusted: true }); // 45 → 50
    expect(roundRational(44, 1, 'nearest', 10)).toEqual({ cents: 40, adjusted: true });
    expect(roundRational(40, 1, 'nearest', 10)).toEqual({ cents: 40, adjusted: false });
    expect(roundRational(125, 1, 'nearest', 50)).toEqual({ cents: 150, adjusted: true });
  });

  it('up and down round toward the right direction', () => {
    expect(roundRational(41, 1, 'up', 10).cents).toBe(50);
    expect(roundRational(49, 1, 'down', 10).cents).toBe(40);
    expect(roundRational(45, 2, 'up', 1).cents).toBe(23);
    expect(roundRational(45, 2, 'down', 1).cents).toBe(22);
  });

  it('handles negative numerators exactly', () => {
    expect(roundRational(-45, 2, 'down', 1).cents).toBe(-23);
    expect(roundRational(-45, 2, 'up', 1).cents).toBe(-22);
  });

  it('rejects invalid arguments', () => {
    expect(() => roundRational(1.5, 1, 'nearest', 1)).toThrow();
    expect(() => roundRational(1, 0, 'nearest', 1)).toThrow();
    expect(() => roundRational(1, 1, 'nearest', 0)).toThrow();
  });

  it('always lands on a multiple of the increment, within one increment of the true value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.constantFrom('nearest', 'up', 'down') as fc.Arbitrary<'nearest' | 'up' | 'down'>,
        fc.constantFrom(1, 5, 10, 50, 100),
        (num, den, mode, inc) => {
          const { cents } = roundRational(num, den, mode, inc);
          expect(cents! % inc).toBe(0);
          // |cents - num/den| < inc  <=>  |cents*den - num| < inc*den
          expect(Math.abs(cents! * den - num)).toBeLessThan(inc * den);
          if (mode === 'up') expect(cents! * den).toBeGreaterThanOrEqual(num);
          if (mode === 'down') expect(cents! * den).toBeLessThanOrEqual(num);
        },
      ),
    );
  });
});

describe('allocateProportionally', () => {
  it('splits exactly and deterministically', () => {
    expect(allocateProportionally(1000, [400, 400, 400])).toEqual([334, 333, 333]);
    expect(allocateProportionally(1000, [960, 480, 480])).toEqual([500, 250, 250]);
    expect(allocateProportionally(0, [1, 2, 3])).toEqual([0, 0, 0]);
    expect(allocateProportionally(5, [0, 0])).toEqual([0, 0]);
  });

  it('always sums to the total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(fc.integer({ min: 0, max: 100_000 }), { minLength: 1, maxLength: 3 }).filter((w) => w.some((x) => x > 0)),
        (total, weights) => {
          const parts = allocateProportionally(total, weights);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((p) => expect(Number.isSafeInteger(p)).toBe(true));
        },
      ),
    );
  });
});

describe('overflow guards', () => {
  it('allocateProportionally refuses to split amounts it cannot split exactly', () => {
    expect(() => allocateProportionally(2 ** 40, [2 ** 20, 1])).toThrow(/too large/);
  });
});
