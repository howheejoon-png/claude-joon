import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeSettlement, type NetBalance } from '../engine/settlement';
import { bruteForceMinTransfers } from './settlementOracle';

function settle(nets: Record<string, number>) {
  const balances: NetBalance[] = Object.entries(nets).map(([playerId, netCents]) => ({ playerId, netCents }));
  const res = computeSettlement(balances);
  if (!res.ok) throw new Error(res.error);
  return res.plan;
}

function applyPlan(nets: Record<string, number>, plan: ReturnType<typeof settle>) {
  const remaining = { ...nets };
  for (const t of plan.transfers) {
    remaining[t.fromPlayerId]! += t.amountCents;
    remaining[t.toPlayerId]! -= t.amountCents;
  }
  return remaining;
}

describe('final settlement', () => {
  it('settles the spec example in three transfers and clears every balance', () => {
    const nets = { a: 5000, b: 2000, c: -3000, d: -4000 };
    const plan = settle(nets);
    expect(plan.transfers).toHaveLength(3);
    expect(plan.isMinimal).toBe(true);
    expect(applyPlan(nets, plan)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    plan.transfers.forEach((t) => {
      expect(t.amountCents).toBeGreaterThan(0);
      expect(Number.isSafeInteger(t.amountCents)).toBe(true);
    });
    expect(plan.totalTransferredCents).toBe(7000);
  });

  it('splits independent zero-sum pairs into two transfers', () => {
    const nets = { a: 1500, b: -1500, c: 730, d: -730 };
    const plan = settle(nets);
    expect(plan.transfers).toHaveLength(2);
    expect(plan.transfers).toEqual(
      expect.arrayContaining([
        { fromPlayerId: 'b', toPlayerId: 'a', amountCents: 1500 },
        { fromPlayerId: 'd', toPlayerId: 'c', amountCents: 730 },
      ]),
    );
  });

  it('finds zero-sum sub-groups so the plan uses the fewest transfers', () => {
    // {a, d} and {b, c} each net to zero, so two transfers suffice.
    const nets = { a: 500, b: 400, c: -400, d: -500 };
    const plan = settle(nets);
    expect(plan.transfers).toHaveLength(2);
    expect(applyPlan(nets, plan)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it('returns no transfers when everyone is at zero', () => {
    const plan = settle({ a: 0, b: 0, c: 0, d: 0 });
    expect(plan.transfers).toEqual([]);
    expect(plan.isMinimal).toBe(true);
  });

  it('ignores zero-balance players', () => {
    const plan = settle({ a: 990, b: 0, c: -990, d: 0 });
    expect(plan.transfers).toEqual([{ fromPlayerId: 'c', toPlayerId: 'a', amountCents: 990 }]);
  });

  it('handles 1-cent amounts exactly', () => {
    const nets = { a: 1, b: 1, c: -1, d: -1 };
    const plan = settle(nets);
    expect(plan.transfers).toHaveLength(2);
    expect(applyPlan(nets, plan)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    const nets2 = { a: 3, b: -1, c: -1, d: -1 };
    expect(settle(nets2).transfers).toHaveLength(3);
  });

  it('never produces circular transfers: payers only pay and receivers only receive', () => {
    const plan = settle({ a: 1860, b: -930, c: 450, d: -1380 });
    const payers = new Set(plan.transfers.map((t) => t.fromPlayerId));
    const receivers = new Set(plan.transfers.map((t) => t.toPlayerId));
    for (const p of payers) expect(receivers.has(p)).toBe(false);
  });

  it('refuses balances that do not sum to zero', () => {
    const res = computeSettlement([
      { playerId: 'a', netCents: 100 },
      { playerId: 'b', netCents: -99 },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/do not sum to zero/);
  });

  it('refuses non-integer balances', () => {
    const res = computeSettlement([
      { playerId: 'a', netCents: 0.5 },
      { playerId: 'b', netCents: -0.5 },
    ]);
    expect(res.ok).toBe(false);
  });

  it('refuses duplicate players', () => {
    const res = computeSettlement([
      { playerId: 'a', netCents: 100 },
      { playerId: 'a', netCents: -100 },
    ]);
    expect(res.ok).toBe(false);
  });

  it('is deterministic', () => {
    const nets = { a: 1234, b: -567, c: 89, d: -756 };
    expect(settle(nets)).toEqual(settle(nets));
  });

  it('randomized: every plan clears all balances with the proven minimum number of transfers', () => {
    const balancesArb = fc
      .array(fc.integer({ min: -50_000, max: 50_000 }), { minLength: 3, maxLength: 3 })
      .map((xs) => [...xs, 0 - xs.reduce((a, b) => a + b, 0)]);
    // Also bias towards small values so zero-sum subsets are common.
    const smallArb = fc
      .array(fc.integer({ min: -5, max: 5 }), { minLength: 3, maxLength: 5 })
      .map((xs) => [...xs, 0 - xs.reduce((a, b) => a + b, 0)]);
    fc.assert(
      fc.property(fc.oneof(balancesArb, smallArb), (values) => {
        const nets = Object.fromEntries(values.map((v, i) => [`p${i}`, v]));
        const plan = settle(nets);
        const after = applyPlan(nets, plan);
        Object.values(after).forEach((v) => expect(v).toBe(0));
        expect(plan.transfers.length).toBe(bruteForceMinTransfers(values));
        plan.transfers.forEach((t) => expect(t.amountCents).toBeGreaterThan(0));
        const payers = new Set(plan.transfers.map((t) => t.fromPlayerId));
        plan.transfers.forEach((t) => expect(payers.has(t.toPlayerId)).toBe(false));
      }),
      { numRuns: 500 },
    );
  });
});
