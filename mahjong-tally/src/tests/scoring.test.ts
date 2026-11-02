import { describe, expect, it } from 'vitest';
import { generatePayoutTable } from '../config/defaults';
import { netByPlayer } from '../engine/ledger';
import { scoreRound, toTransactions, type TransferDraft } from '../engine/scoring';
import type { BonusRule, RoundInput, ScoringConfiguration } from '../models/types';
import { PLAYERS, config, discard, draw, paymentsTo, selfDraw } from './helpers';

const ids = PLAYERS.map((p) => p.id);

function score(input: RoundInput, cfg: ScoringConfiguration = config()) {
  return scoreRound(input, { players: PLAYERS, config: cfg });
}

function ok(input: RoundInput, cfg: ScoringConfiguration = config()) {
  const r = score(input, cfg);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

function net(transfers: TransferDraft[]) {
  return netByPlayer(toTransactions('r', transfers), ids);
}

function sumNet(transfers: TransferDraft[]) {
  return Object.values(net(transfers)).reduce((a, b) => a + b, 0);
}

function withRules(rules: BonusRule[], patch: Partial<ScoringConfiguration> = {}) {
  return config({ bonusRules: rules, ...patch });
}

describe('self-draw (自摸)', () => {
  it('standard self-draw: each opponent pays the self-draw amount', () => {
    const r = ok(selfDraw('a', 3));
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 240, c: 240, d: 240 });
    expect(net(r.transfers)).toEqual({ a: 720, b: -240, c: -240, d: -240 });
    expect(sumNet(r.transfers)).toBe(0);
    expect(r.effectiveTai).toBe(3);
    r.transfers.forEach((t) => expect(t.kind).toBe('hand'));
  });

  it('a non-East winner is paid by the other three in seat order', () => {
    const r = ok(selfDraw('c', 1));
    expect(r.transfers.map((t) => t.payerId)).toEqual(['a', 'b', 'd']);
    expect(net(r.transfers)).toEqual({ a: -60, b: -60, c: 180, d: -60 });
  });

  it('liable player (包) pays every share when the rule allows it', () => {
    const cfg = config({ selfDrawPayers: 'all_opponents_or_liable' });
    const r = ok(selfDraw('a', 2, { liablePlayerId: 'c' }), cfg);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]).toMatchObject({ payerId: 'c', receiverId: 'a', amountCents: 360 });
    expect(r.transfers[0]!.components!.map((c) => c.amountCents)).toEqual([120, 120, 120]);
    expect(net(r.transfers)).toEqual({ a: 360, b: 0, c: -360, d: 0 });
  });

  it('rejects a liable player when house rules do not allow it', () => {
    const r = score(selfDraw('a', 2, { liablePlayerId: 'c' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.code).toBe('LIABLE_NOT_ALLOWED');
  });

  it('rejects the winner as the liable player', () => {
    const cfg = config({ selfDrawPayers: 'all_opponents_or_liable' });
    const r = score(selfDraw('a', 2, { liablePlayerId: 'a' }), cfg);
    expect(r.ok).toBe(false);
  });
});

describe('discard win (放炮)', () => {
  it('shared liability: discarder pays double, others pay single', () => {
    const r = ok(discard('a', 'b', 1));
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 60, c: 30, d: 30 });
    expect(net(r.transfers)).toEqual({ a: 120, b: -60, c: -30, d: -30 });
  });

  it('discarder-only liability: only the discarder pays', () => {
    const cfg = config({ discardLiability: 'discarder_only' });
    const r = ok(discard('a', 'b', 1), cfg);
    expect(r.transfers).toHaveLength(1);
    expect(r.transfers[0]).toMatchObject({ payerId: 'b', receiverId: 'a', amountCents: 60 });
    expect(net(r.transfers)).toEqual({ a: 60, b: -60, c: 0, d: 0 });
  });

  it('discarder-only with a full-shooter table (discarder pays everyone’s share)', () => {
    const cfg = config({
      discardLiability: 'discarder_only',
      payoutTable: generatePayoutTable({
        baseUnitCents: 30,
        minTai: 1,
        maxTai: 5,
        progression: 'doubling',
        discarderUnits: 4,
        othersUnits: 0,
        selfDrawUnits: 2,
      }),
    });
    const r = ok(discard('d', 'a', 3), cfg);
    expect(r.transfers).toEqual([expect.objectContaining({ payerId: 'a', receiverId: 'd', amountCents: 480 })]);
  });

  it('requires a discarder, and the discarder cannot be the winner', () => {
    const missing = score({ outcome: { type: 'win', winnerId: 'a', method: 'discard', tai: 1 }, bonuses: [], manualAdjustments: [] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.map((e) => e.code)).toContain('DISCARDER_REQUIRED');
    const self = score(discard('a', 'a', 1));
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.errors.map((e) => e.code)).toContain('DISCARDER_IS_WINNER');
  });
});

describe('tai values', () => {
  it('uses the table row for each tai value', () => {
    const expected = [60, 120, 240, 480, 960];
    for (let tai = 1; tai <= 5; tai += 1) {
      const r = ok(selfDraw('b', tai));
      expect(paymentsTo(r.transfers, 'b')).toEqual({ a: expected[tai - 1], c: expected[tai - 1], d: expected[tai - 1] });
      const d = ok(discard('b', 'c', tai));
      expect(paymentsTo(d.transfers, 'b')).toEqual({
        a: expected[tai - 1]! / 2,
        c: expected[tai - 1],
        d: expected[tai - 1]! / 2,
      });
    }
  });

  it('supports 0 tai when the house allows it', () => {
    const cfg = config({
      minTai: 0,
      maxTai: 3,
      payoutTable: generatePayoutTable({
        baseUnitCents: 20,
        minTai: 0,
        maxTai: 3,
        progression: 'doubling',
        discarderUnits: 2,
        othersUnits: 1,
        selfDrawUnits: 2,
      }),
    });
    const r = ok(selfDraw('a', 0), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 40, c: 40, d: 40 });
  });

  it('rejects tai outside the configured range', () => {
    expect(score(selfDraw('a', 6)).ok).toBe(false);
    expect(score(selfDraw('a', 0)).ok).toBe(false);
    expect(score(selfDraw('a', 1.5)).ok).toBe(false);
  });
});

describe('maximum tai', () => {
  it('pays the maximum-tai row for a limit hand', () => {
    const r = ok(selfDraw('a', 5));
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 960, c: 960, d: 960 });
  });

  it('caps extra tai from bonuses at the maximum tai', () => {
    const cfg = withRules([{ id: 'x', name: 'Special', kind: 'extra_tai', value: 2, enabled: true }]);
    const r = ok(selfDraw('a', 4, { bonuses: [{ ruleId: 'x', count: 1 }] }), cfg);
    expect(r.effectiveTai).toBe(5);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 960, c: 960, d: 960 });
    expect(r.notes.join(' ')).toMatch(/capped at the maximum of 5 tai/);
  });

  it('extra tai below the cap moves up the table', () => {
    const cfg = withRules([{ id: 'x', name: 'Flowers', kind: 'extra_tai', value: 1, enabled: true }]);
    const r = ok(discard('a', 'b', 1, { bonuses: [{ ruleId: 'x', count: 2 }] }), cfg);
    expect(r.effectiveTai).toBe(3);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 240, c: 120, d: 120 });
  });
});

describe('dealer bonus', () => {
  const dealerCfg = (d: Partial<ScoringConfiguration['dealer']>) =>
    config({
      dealer: {
        enabled: true,
        extraTaiWhenDealerWins: 0,
        extraCentsPerPayerWhenDealerWins: 0,
        extraCentsWhenDealerPays: 0,
        ...d,
      },
    });

  it('adds extra tai when the dealer wins', () => {
    const cfg = dealerCfg({ extraTaiWhenDealerWins: 1 });
    const r = ok(selfDraw('a', 2, { dealerId: 'a' }), cfg);
    expect(r.effectiveTai).toBe(3);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 240, c: 240, d: 240 });
  });

  it('does not add extra tai when a non-dealer wins', () => {
    const cfg = dealerCfg({ extraTaiWhenDealerWins: 1 });
    const r = ok(selfDraw('a', 2, { dealerId: 'b' }), cfg);
    expect(r.effectiveTai).toBe(2);
  });

  it('adds a per-payer bonus when the dealer wins', () => {
    const cfg = dealerCfg({ extraCentsPerPayerWhenDealerWins: 50 });
    const r = ok(discard('a', 'b', 1, { dealerId: 'a' }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 110, c: 80, d: 80 });
  });

  it('charges the dealer a surcharge when the dealer pays', () => {
    const cfg = dealerCfg({ extraCentsWhenDealerPays: 40 });
    const r = ok(selfDraw('a', 1, { dealerId: 'c' }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 60, c: 100, d: 60 });
    // Not charged when the dealer is not a paying player under discarder_only.
    const cfg2 = { ...cfg, discardLiability: 'discarder_only' as const };
    const r2 = ok(discard('a', 'b', 1, { dealerId: 'c' }), cfg2);
    expect(paymentsTo(r2.transfers, 'a')).toEqual({ b: 60 });
  });

  it('has no effect when the dealer rule is disabled', () => {
    const cfg = config({
      dealer: { enabled: false, extraTaiWhenDealerWins: 2, extraCentsPerPayerWhenDealerWins: 50, extraCentsWhenDealerPays: 50 },
    });
    const r = ok(selfDraw('a', 1, { dealerId: 'a' }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 60, c: 60, d: 60 });
  });
});

describe('custom payouts', () => {
  it('uses arbitrary custom table values exactly', () => {
    const cfg = config({
      minTai: 1,
      maxTai: 3,
      payoutTable: [
        { tai: 1, discarderPays: 75, othersPay: 35, selfDrawEachPays: 55 },
        { tai: 2, discarderPays: 155, othersPay: 65, selfDrawEachPays: 105 },
        { tai: 3, discarderPays: 333, othersPay: 111, selfDrawEachPays: 222 },
      ],
    });
    expect(paymentsTo(ok(discard('b', 'd', 3), cfg).transfers, 'b')).toEqual({ a: 111, c: 111, d: 333 });
    expect(paymentsTo(ok(selfDraw('b', 2), cfg).transfers, 'b')).toEqual({ a: 105, c: 105, d: 105 });
  });

  it('per-payer winner bonus is added to each paying player', () => {
    const cfg = withRules([{ id: 'w', name: 'Bonus', kind: 'winner_bonus_per_payer', value: 10, enabled: true }]);
    const r = ok(selfDraw('a', 1, { bonuses: [{ ruleId: 'w', count: 3 }] }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 90, c: 90, d: 90 });
  });

  it('a zero row produces no transfers rather than zero-amount transfers', () => {
    const cfg = config({
      discardLiability: 'shared',
      payoutTable: config().payoutTable.map((r) => (r.tai === 1 ? { ...r, othersPay: 0 } : r)),
    });
    const r = ok(discard('a', 'b', 1), cfg);
    expect(r.transfers).toHaveLength(1);
    expect(r.notes.join(' ')).toMatch(/owes nothing/);
  });
});

describe('rounding rules', () => {
  const mult = (value: number, rounding: ScoringConfiguration['rounding']) =>
    withRules([{ id: 'm', name: 'Half again', kind: 'payout_multiplier', value, enabled: true }], { rounding });

  it('exact mode rejects fractional cents with an actionable error', () => {
    // 1 tai shared: others pay 30 → ×1.5 = 45 (fine), discarder 60 → 90 (fine). Use 3-tai self-draw: 240 ×1.5 = 360 fine.
    // Use a table value that makes a half cent: 25 × 1.5 = 37.5.
    const cfg = {
      ...mult(150, { mode: 'exact', incrementCents: 1 }),
      payoutTable: config().payoutTable.map((r) => (r.tai === 1 ? { ...r, selfDrawEachPays: 25 } : r)),
    };
    const r = score(selfDraw('a', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }), cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('FRACTIONAL_CENTS');
      expect(r.errors[0]!.message).toMatch(/rounding rule/);
    }
  });

  it('exact mode accepts multipliers that produce whole cents', () => {
    const cfg = mult(150, { mode: 'exact', incrementCents: 1 });
    const r = ok(discard('a', 'b', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 90, c: 45, d: 45 });
  });

  it('nearest rounds each payment to the increment', () => {
    const cfg = mult(150, { mode: 'nearest', incrementCents: 10 });
    const r = ok(discard('a', 'b', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }), cfg);
    // 60×1.5=90; 30×1.5=45 → 50
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 90, c: 50, d: 50 });
    expect(sumNet(r.transfers)).toBe(0);
    // components add up to the final amount
    for (const t of r.transfers) {
      expect(t.components!.reduce((a, c) => a + c.amountCents, 0)).toBe(t.amountCents);
    }
  });

  it('down and up round in the right direction', () => {
    const down = ok(
      discard('a', 'b', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }),
      mult(150, { mode: 'down', incrementCents: 10 }),
    );
    expect(paymentsTo(down.transfers, 'a')).toEqual({ b: 90, c: 40, d: 40 });
    const up = ok(
      discard('a', 'b', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }),
      mult(110, { mode: 'up', incrementCents: 5 }),
    );
    // 60×1.1=66 → 70; 30×1.1=33 → 35
    expect(paymentsTo(up.transfers, 'a')).toEqual({ b: 70, c: 35, d: 35 });
  });

  it('half-cent amounts round half-up in nearest mode', () => {
    const cfg = {
      ...mult(150, { mode: 'nearest', incrementCents: 1 }),
      payoutTable: config().payoutTable.map((r) => (r.tai === 1 ? { ...r, selfDrawEachPays: 25 } : r)),
    };
    const r = ok(selfDraw('a', 1, { bonuses: [{ ruleId: 'm', count: 1 }] }), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 38, c: 38, d: 38 });
  });

  it('rounding applies to amounts that are already whole cents only when off-increment', () => {
    const cfg = config({ rounding: { mode: 'nearest', incrementCents: 50 } });
    const r = ok(discard('a', 'b', 1), cfg);
    // 60 → 50, 30 → 50 (half-up: 30 is 0.6 of the way)
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 50, c: 50, d: 50 });
  });
});

describe('payout caps', () => {
  it('per-payment cap limits each payment', () => {
    const cfg = config({ payoutCap: { mode: 'per_payment', amountCents: 500 } });
    const r = ok(discard('a', 'b', 5), cfg);
    expect(paymentsTo(r.transfers, 'a')).toEqual({ b: 500, c: 480, d: 480 });
    expect(r.notes.join(' ')).toMatch(/capped/);
  });

  it('per-round cap shares the cap proportionally and sums exactly to it', () => {
    const cfg = config({ payoutCap: { mode: 'per_round', amountCents: 1000 } });
    const r = ok(discard('a', 'b', 5), cfg); // 960 + 480 + 480 = 1920
    const pays = paymentsTo(r.transfers, 'a');
    expect(pays).toEqual({ b: 500, c: 250, d: 250 });
    expect(Object.values(pays).reduce((x, y) => x + y, 0)).toBe(1000);
    const odd = ok(selfDraw('a', 5), config({ payoutCap: { mode: 'per_round', amountCents: 1001 } }));
    const p2 = paymentsTo(odd.transfers, 'a');
    expect(Object.values(p2).reduce((x, y) => x + y, 0)).toBe(1001);
    expect(p2).toEqual({ b: 334, c: 334, d: 333 });
  });

  it('a cap above the total has no effect', () => {
    const cfg = config({ payoutCap: { mode: 'per_round', amountCents: 100_000 } });
    expect(paymentsTo(ok(selfDraw('a', 5), cfg).transfers, 'a')).toEqual({ b: 960, c: 960, d: 960 });
  });
});

describe('instant adjustments and manual transfers', () => {
  const rules: BonusRule[] = [
    { id: 'animal', name: 'Animal', kind: 'collect_from_each', value: 30, enabled: true },
    { id: 'false', name: 'False win', kind: 'penalty_pay_each', value: 100, enabled: true },
  ];

  it('collect_from_each collects from every other player', () => {
    const r = ok(selfDraw('a', 1, { bonuses: [{ ruleId: 'animal', count: 2, playerId: 'c' }] }), withRules(rules));
    const n = net(r.transfers);
    expect(n).toEqual({ a: 180 - 60, b: -60 - 60, c: -60 + 180, d: -60 - 60 });
    expect(sumNet(r.transfers)).toBe(0);
  });

  it('penalty_pay_each pays every other player', () => {
    const r = ok(draw([{ ruleId: 'false', count: 1, playerId: 'b' }]), withRules(rules));
    expect(net(r.transfers)).toEqual({ a: 100, b: -300, c: 100, d: 100 });
    r.transfers.forEach((t) => expect(t.kind).toBe('penalty'));
  });

  it('manual adjustments move an exact amount', () => {
    const r = ok(
      draw([], [{ id: 'm1', payerId: 'd', receiverId: 'a', amountCents: 450, note: 'Late fee' }]),
    );
    expect(r.transfers).toEqual([
      expect.objectContaining({ payerId: 'd', receiverId: 'a', amountCents: 450, kind: 'manual', description: 'Late fee' }),
    ]);
  });

  it('rejects disabled, unknown, duplicate and win-only rules on draws', () => {
    const cfg = withRules([
      ...rules,
      { id: 'off', name: 'Off', kind: 'collect_from_each', value: 30, enabled: false },
      { id: 'tai', name: 'Tai', kind: 'extra_tai', value: 1, enabled: true },
    ]);
    const codes = (input: RoundInput) => {
      const r = score(input, cfg);
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(codes(draw([{ ruleId: 'off', count: 1, playerId: 'a' }]))).toContain('BONUS_DISABLED');
    expect(codes(draw([{ ruleId: 'nope', count: 1, playerId: 'a' }]))).toContain('BONUS_UNKNOWN');
    expect(codes(draw([{ ruleId: 'tai', count: 1 }]))).toContain('BONUS_WIN_ONLY');
    expect(
      codes(
        draw([
          { ruleId: 'animal', count: 1, playerId: 'a' },
          { ruleId: 'animal', count: 1, playerId: 'a' },
        ]),
      ),
    ).toContain('BONUS_DUPLICATE');
    expect(codes(draw([{ ruleId: 'animal', count: 1 }]))).toContain('BONUS_PLAYER');
    expect(codes(draw([{ ruleId: 'animal', count: 0, playerId: 'a' }]))).toContain('BONUS_COUNT');
    expect(codes(draw([], [{ id: 'm', payerId: 'a', receiverId: 'a', amountCents: 10, note: '' }]))).toContain('MANUAL_SELF');
    expect(codes(draw([], [{ id: 'm', payerId: 'a', receiverId: 'b', amountCents: 4.5, note: '' }]))).toContain('MANUAL_AMOUNT');
    expect(codes(draw([], [{ id: 'm', payerId: 'a', receiverId: 'b', amountCents: 0, note: '' }]))).toContain('MANUAL_AMOUNT');
  });
});

describe('drawn rounds', () => {
  it('a plain draw produces no transfers', () => {
    const r = ok(draw());
    expect(r.transfers).toEqual([]);
    expect(r.effectiveTai).toBeUndefined();
    expect(r.notes[0]).toMatch(/Drawn round/);
  });
});

describe('invalid configuration', () => {
  it('refuses to score with invalid house rules', () => {
    const cfg = config({ maxTai: 3 }); // table still has rows 4 and 5 → out of range
    const r = score(selfDraw('a', 1), cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.code).toBe('CONFIG_INVALID');
  });

  it('transaction ids are deterministic per round', () => {
    const r = ok(selfDraw('a', 1));
    expect(toTransactions('round-1', r.transfers).map((t) => t.id)).toEqual(['round-1:0', 'round-1:1', 'round-1:2']);
  });
});
