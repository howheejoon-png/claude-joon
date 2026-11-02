import { describe, expect, it } from 'vitest';
import { exampleConfiguration, generatePayoutTable, resizePayoutTable } from '../config/defaults';
import { hasErrors, validateConfig, validatePlayers, validateRoundInput } from '../engine/validation';
import type { ScoringConfiguration } from '../models/types';
import { PLAYERS, config, discard, selfDraw } from './helpers';

function errorAt(cfg: ScoringConfiguration, path: string, code?: string) {
  const issues = validateConfig(cfg).filter((i) => i.severity === 'error');
  const hit = issues.find((i) => i.path === path && (!code || i.code === code));
  if (!hit) throw new Error(`Expected error at ${path}${code ? ` (${code})` : ''}, got ${JSON.stringify(issues)}`);
  expect(hit.message.length).toBeGreaterThan(10);
  return hit;
}

describe('validateConfig', () => {
  it('the example configuration is valid and uses the $0.30/$0.60 doubling table', () => {
    const cfg = exampleConfiguration();
    expect(hasErrors(validateConfig(cfg))).toBe(false);
    expect(cfg.stakeLabel).toBe('$0.30 / $0.60');
    expect(cfg.payoutTable.map((r) => [r.tai, r.discarderPays, r.othersPay, r.selfDrawEachPays])).toEqual([
      [1, 60, 30, 60],
      [2, 120, 60, 120],
      [3, 240, 120, 240],
      [4, 480, 240, 480],
      [5, 960, 480, 960],
    ]);
    // Example adjustment rules never affect payouts until enabled.
    expect(cfg.bonusRules.every((r) => !r.enabled && r.isExample)).toBe(true);
  });

  it('rejects fractional cents in the payout table', () => {
    const cfg = config();
    cfg.payoutTable[1]!.discarderPays = 4.5;
    expect(errorAt(cfg, 'payoutTable.1.discarderPays', 'NOT_WHOLE_CENTS').message).toMatch(/whole number of cents/);
  });

  it('rejects negative and absurd amounts', () => {
    const cfg = config();
    cfg.payoutTable[0]!.othersPay = -30;
    cfg.payoutTable[2]!.selfDrawEachPays = 100_000_01;
    errorAt(cfg, 'payoutTable.0.othersPay', 'NEGATIVE_AMOUNT');
    errorAt(cfg, 'payoutTable.2.selfDrawEachPays', 'AMOUNT_TOO_LARGE');
  });

  it('rejects a min tai above max tai, and out-of-range tai', () => {
    errorAt(config({ minTai: 4, maxTai: 2 }), 'maxTai', 'TAI_RANGE');
    errorAt(config({ maxTai: 21 }), 'maxTai', 'MAX_TAI');
    errorAt(config({ minTai: -1 }), 'minTai', 'MIN_TAI');
    errorAt(config({ minTai: 1.5 }), 'minTai', 'MIN_TAI');
  });

  it('requires a row for every tai value and no duplicates', () => {
    const missing = config({ payoutTable: config().payoutTable.filter((r) => r.tai !== 3) });
    expect(validateConfig(missing).find((i) => i.code === 'ROW_MISSING')?.message).toMatch(/3 tai/);
    const dup = config({ payoutTable: [...config().payoutTable, { ...config().payoutTable[0]! }] });
    expect(validateConfig(dup).some((i) => i.code === 'ROW_DUPLICATE')).toBe(true);
    const extra = config({ maxTai: 4 });
    expect(validateConfig(extra).some((i) => i.code === 'ROW_OUT_OF_RANGE')).toBe(true);
  });

  it('warns (not errors) when a table row would pay nothing or decreases', () => {
    const cfg = config();
    cfg.payoutTable[0] = { tai: 1, discarderPays: 0, othersPay: 0, selfDrawEachPays: 0 };
    const issues = validateConfig(cfg);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['SELF_DRAW_ZERO', 'DISCARD_ZERO']));
    const dec = config();
    dec.payoutTable[4]!.selfDrawEachPays = 10;
    expect(validateConfig(dec).some((i) => i.code === 'TABLE_DECREASING' && i.severity === 'warning')).toBe(true);
  });

  it('requires a positive cap when a cap is enabled', () => {
    errorAt(config({ payoutCap: { mode: 'per_payment', amountCents: 0 } }), 'payoutCap.amountCents', 'ZERO_AMOUNT');
    errorAt(config({ payoutCap: { mode: 'per_round', amountCents: 12.5 } }), 'payoutCap.amountCents');
    expect(hasErrors(validateConfig(config({ payoutCap: { mode: 'none', amountCents: 0 } })))).toBe(false);
  });

  it('validates rounding and liability modes', () => {
    errorAt(config({ rounding: { mode: 'nearest', incrementCents: 0 } }), 'rounding.incrementCents');
    errorAt(config({ rounding: { mode: 'nearest', incrementCents: 2.5 } }), 'rounding.incrementCents');
    errorAt(config({ rounding: { mode: 'sideways' as never, incrementCents: 1 } }), 'rounding.mode');
    errorAt(config({ discardLiability: 'everyone' as never }), 'discardLiability');
    errorAt(config({ selfDrawPayers: 'nobody' as never }), 'selfDrawPayers');
  });

  it('validates dealer rules', () => {
    const cfg = config({
      dealer: { enabled: true, extraTaiWhenDealerWins: -1, extraCentsPerPayerWhenDealerWins: 0.5, extraCentsWhenDealerPays: 0 },
    });
    errorAt(cfg, 'dealer.extraTaiWhenDealerWins');
    errorAt(cfg, 'dealer.extraCentsPerPayerWhenDealerWins');
    const noEffect = config({
      dealer: { enabled: true, extraTaiWhenDealerWins: 0, extraCentsPerPayerWhenDealerWins: 0, extraCentsWhenDealerPays: 0 },
    });
    expect(validateConfig(noEffect).find((i) => i.code === 'DEALER_NO_EFFECT')?.severity).toBe('warning');
  });

  it('validates adjustment rules', () => {
    const cfg = config({
      bonusRules: [
        { id: 'a', name: '', kind: 'extra_tai', value: 1, enabled: true },
        { id: 'a', name: 'Dup', kind: 'extra_tai', value: 1, enabled: false },
        { id: 'c', name: 'Zero', kind: 'collect_from_each', value: 0, enabled: true },
        { id: 'd', name: 'Frac', kind: 'collect_from_each', value: 2.5, enabled: false },
        { id: 'e', name: 'Kind', kind: 'mystery' as never, value: 1, enabled: true },
        { id: 'f', name: 'Huge', kind: 'payout_multiplier', value: 100_000, enabled: true },
      ],
    });
    errorAt(cfg, 'bonusRules.0.name', 'BONUS_NAME');
    errorAt(cfg, 'bonusRules.1.id', 'BONUS_ID');
    errorAt(cfg, 'bonusRules.2.value', 'BONUS_VALUE');
    errorAt(cfg, 'bonusRules.3.value', 'BONUS_VALUE');
    errorAt(cfg, 'bonusRules.4.kind', 'BONUS_KIND');
    errorAt(cfg, 'bonusRules.5.value', 'BONUS_VALUE');
  });

  it('a disabled zero-value rule is fine (it cannot affect payouts)', () => {
    const cfg = config({ bonusRules: [{ id: 'x', name: 'Later', kind: 'collect_from_each', value: 0, enabled: false }] });
    expect(hasErrors(validateConfig(cfg))).toBe(false);
  });

  it('warns that a fractional multiplier with exact rounding can be rejected', () => {
    const cfg = config({ bonusRules: [{ id: 'm', name: 'Half', kind: 'payout_multiplier', value: 150, enabled: true }] });
    const w = validateConfig(cfg).find((i) => i.code === 'MULTIPLIER_FRACTIONAL');
    expect(w?.severity).toBe('warning');
  });

  it('rejects an unsupported schema version', () => {
    errorAt({ ...config(), schemaVersion: 2 as never }, 'schemaVersion');
  });
});

describe('payout table helpers', () => {
  it('generates linear tables', () => {
    const rows = generatePayoutTable({
      baseUnitCents: 50,
      minTai: 1,
      maxTai: 3,
      progression: 'linear',
      discarderUnits: 2,
      othersUnits: 1,
      selfDrawUnits: 1,
    });
    expect(rows).toEqual([
      { tai: 1, discarderPays: 100, othersPay: 50, selfDrawEachPays: 50 },
      { tai: 2, discarderPays: 200, othersPay: 100, selfDrawEachPays: 100 },
      { tai: 3, discarderPays: 300, othersPay: 150, selfDrawEachPays: 150 },
    ]);
  });

  it('resizes the table keeping existing values', () => {
    const rows = resizePayoutTable(config().payoutTable, 0, 6);
    expect(rows.map((r) => r.tai)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(rows[0]).toEqual({ tai: 0, discarderPays: 0, othersPay: 0, selfDrawEachPays: 0 });
    expect(rows[1]).toEqual(config().payoutTable[0]);
    expect(rows[6]).toEqual({ tai: 6, discarderPays: 1920, othersPay: 960, selfDrawEachPays: 1920 });
    expect(resizePayoutTable(config().payoutTable, 2, 3).map((r) => r.tai)).toEqual([2, 3]);
  });
});

describe('validatePlayers', () => {
  it('accepts four uniquely named, uniquely seated players', () => {
    expect(validatePlayers(PLAYERS)).toEqual([]);
  });

  it('rejects blank, duplicate (case-insensitive) names and duplicate seats', () => {
    const bad = [
      { ...PLAYERS[0]!, name: '  ' },
      { ...PLAYERS[1]!, name: 'Ann' },
      { ...PLAYERS[2]!, name: 'ann', seat: 'south' as const },
      PLAYERS[3]!,
    ];
    const codes = validatePlayers(bad).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['PLAYER_NAME', 'PLAYER_NAME_DUP', 'PLAYER_SEAT_DUP']));
  });

  it('requires exactly four players', () => {
    expect(validatePlayers(PLAYERS.slice(0, 2))[0]!.code).toBe('PLAYER_COUNT');
  });
});

describe('validateRoundInput', () => {
  const cfg = config();
  const codes = (input: Parameters<typeof validateRoundInput>[0]) =>
    validateRoundInput(input, PLAYERS, cfg).map((i) => i.code);

  it('accepts complete inputs', () => {
    expect(codes(selfDraw('a', 1))).toEqual([]);
    expect(codes(discard('a', 'b', 5))).toEqual([]);
  });

  it('flags missing winner, unknown dealer, and a liable player on a discard', () => {
    expect(codes(selfDraw('zz', 1))).toContain('WINNER_REQUIRED');
    expect(codes(selfDraw('a', 1, { dealerId: 'zz' }))).toContain('DEALER_UNKNOWN');
    const d = discard('a', 'b', 1);
    if (d.outcome.type === 'win') d.outcome.liablePlayerId = 'c';
    expect(codes(d)).toContain('LIABLE_ON_DISCARD');
  });

  it('flags an invalid method and outcome', () => {
    expect(
      codes({ outcome: { type: 'win', winnerId: 'a', method: 'magic' as never, tai: 1 }, bonuses: [], manualAdjustments: [] }),
    ).toContain('METHOD_REQUIRED');
    expect(codes({ outcome: { type: 'other' } as never, bonuses: [], manualAdjustments: [] })).toContain('OUTCOME_REQUIRED');
  });
});
