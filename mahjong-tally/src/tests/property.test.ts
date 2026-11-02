/**
 * Randomized (property-based) tests: for ANY valid sequence of supported
 * operations under ANY valid house rules, the books must balance.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkGameHealth } from '../engine/audit';
import {
  activeRounds,
  applyRescore,
  deleteRound,
  deletedRounds,
  editRound,
  gameBalances,
  gameLedger,
  recordRound,
  resetGame,
  restoreRound,
  undoLastRound,
  updateGameConfig,
  updatePlayers,
} from '../engine/game';
import { netByPlayer, validateLedger } from '../engine/ledger';
import { computeSettlement } from '../engine/settlement';
import { validateConfig } from '../engine/validation';
import type {
  AppliedBonus,
  BonusKind,
  GameSession,
  ManualAdjustment,
  Result,
  RoundInput,
  ScoringConfiguration,
  Seat,
} from '../models/types';
import { SEATS } from '../models/types';
import { makeCtx, newGame } from './helpers';
import { bruteForceMinTransfers } from './settlementOracle';

const BONUS_KINDS: BonusKind[] = [
  'extra_tai',
  'winner_bonus_per_payer',
  'payout_multiplier',
  'collect_from_each',
  'penalty_pay_each',
];

const configArb: fc.Arbitrary<ScoringConfiguration> = fc
  .record({
    minTai: fc.integer({ min: 0, max: 2 }),
    span: fc.integer({ min: 0, max: 6 }),
    rows: fc.array(
      fc.record({
        d: fc.integer({ min: 0, max: 5000 }),
        o: fc.integer({ min: 0, max: 3000 }),
        s: fc.integer({ min: 0, max: 5000 }),
      }),
      { minLength: 7, maxLength: 7 },
    ),
    discardLiability: fc.constantFrom('discarder_only' as const, 'shared' as const),
    selfDrawPayers: fc.constantFrom('all_opponents' as const, 'all_opponents_or_liable' as const),
    capMode: fc.constantFrom('none' as const, 'per_payment' as const, 'per_round' as const),
    capAmount: fc.integer({ min: 1, max: 6000 }),
    roundingMode: fc.constantFrom('exact' as const, 'nearest' as const, 'up' as const, 'down' as const),
    increment: fc.constantFrom(1, 5, 10, 50),
    dealerEnabled: fc.boolean(),
    dealerTai: fc.integer({ min: 0, max: 3 }),
    dealerWinCents: fc.integer({ min: 0, max: 500 }),
    dealerPaysCents: fc.integer({ min: 0, max: 500 }),
    bonuses: fc.array(
      fc.record({
        kind: fc.constantFrom(...BONUS_KINDS),
        value: fc.integer({ min: 1, max: 400 }),
        multiplier: fc.constantFrom(100, 110, 125, 150, 200, 300),
        enabled: fc.boolean(),
      }),
      { maxLength: 5 },
    ),
  })
  .map((c) => {
    const maxTai = c.minTai + c.span;
    const cfg: ScoringConfiguration = {
      schemaVersion: 1,
      name: 'Random rules',
      stakeLabel: 'random',
      baseUnitCents: 10,
      minTai: c.minTai,
      maxTai,
      payoutTable: c.rows.slice(0, c.span + 1).map((r, i) => ({
        tai: c.minTai + i,
        discarderPays: r.d,
        othersPay: r.o,
        selfDrawEachPays: r.s,
      })),
      discardLiability: c.discardLiability,
      selfDrawPayers: c.selfDrawPayers,
      payoutCap: { mode: c.capMode, amountCents: c.capAmount },
      rounding: { mode: c.roundingMode, incrementCents: c.roundingMode === 'exact' ? 1 : c.increment },
      dealer: {
        enabled: c.dealerEnabled,
        extraTaiWhenDealerWins: c.dealerTai,
        extraCentsPerPayerWhenDealerWins: c.dealerWinCents,
        extraCentsWhenDealerPays: c.dealerPaysCents,
      },
      bonusRules: c.bonuses.map((b, i) => ({
        id: `rule${i}`,
        name: `Rule ${i}`,
        kind: b.kind,
        value: b.kind === 'payout_multiplier' ? b.multiplier : b.kind === 'extra_tai' ? 1 + (b.value % 3) : b.value,
        enabled: b.enabled,
      })),
    };
    return cfg;
  });

type Op =
  | { kind: 'record'; picks: number[] }
  | { kind: 'edit'; target: number; picks: number[]; current: boolean }
  | { kind: 'delete'; target: number }
  | { kind: 'restore'; target: number }
  | { kind: 'undo' }
  | { kind: 'reset' }
  | { kind: 'rescore'; config: ScoringConfiguration }
  | { kind: 'rules'; config: ScoringConfiguration }
  | { kind: 'reseat'; rotation: number };

const picksArb = fc.array(fc.nat({ max: 1_000_000 }), { minLength: 24, maxLength: 24 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 8, arbitrary: picksArb.map((picks) => ({ kind: 'record' as const, picks })) },
  {
    weight: 2,
    arbitrary: fc
      .record({ target: fc.nat(), picks: picksArb, current: fc.boolean() })
      .map((x) => ({ kind: 'edit' as const, ...x })),
  },
  { weight: 2, arbitrary: fc.nat().map((target) => ({ kind: 'delete' as const, target })) },
  { weight: 1, arbitrary: fc.nat().map((target) => ({ kind: 'restore' as const, target })) },
  { weight: 1, arbitrary: fc.constant({ kind: 'undo' as const }) },
  { weight: 1, arbitrary: configArb.map((config) => ({ kind: 'rescore' as const, config })) },
  { weight: 1, arbitrary: configArb.map((config) => ({ kind: 'rules' as const, config })) },
  { weight: 1, arbitrary: fc.integer({ min: 1, max: 3 }).map((rotation) => ({ kind: 'reseat' as const, rotation })) },
  { weight: 1, arbitrary: fc.constant({ kind: 'reset' as const }) },
);

/** Build a (mostly valid) round input from random picks against the CURRENT rules. */
function buildInput(game: GameSession, picks: number[]): RoundInput {
  let i = 0;
  const next = () => picks[i++ % picks.length]!;
  const cfg = game.config;
  const ids = game.players.map((p) => p.id);
  const pick = <T,>(xs: readonly T[]) => xs[next() % xs.length]!;
  const isDraw = next() % 6 === 0;
  const dealerId = next() % 3 === 0 ? undefined : pick(ids);
  const bonuses: AppliedBonus[] = [];
  for (const rule of cfg.bonusRules) {
    if (!rule.enabled || next() % 3 !== 0) continue;
    if (isDraw && ['extra_tai', 'winner_bonus_per_payer', 'payout_multiplier'].includes(rule.kind)) continue;
    const playerScoped = rule.kind === 'collect_from_each' || rule.kind === 'penalty_pay_each';
    bonuses.push({ ruleId: rule.id, count: 1 + (next() % 3), ...(playerScoped ? { playerId: pick(ids) } : {}) });
  }
  const manualAdjustments: ManualAdjustment[] = [];
  if (next() % 5 === 0) {
    const payerId = pick(ids);
    const receiverId = pick(ids.filter((x) => x !== payerId));
    manualAdjustments.push({ id: `m${next()}`, payerId, receiverId, amountCents: 1 + (next() % 2000), note: 'random' });
  }
  if (isDraw) return { outcome: { type: 'draw' }, ...(dealerId ? { dealerId } : {}), bonuses, manualAdjustments };
  const winnerId = pick(ids);
  const others = ids.filter((x) => x !== winnerId);
  const tai = cfg.minTai + (next() % (cfg.maxTai - cfg.minTai + 1));
  const method = next() % 2 === 0 ? ('self_draw' as const) : ('discard' as const);
  const outcome =
    method === 'discard'
      ? { type: 'win' as const, winnerId, method, discarderId: pick(others), tai }
      : {
          type: 'win' as const,
          winnerId,
          method,
          tai,
          ...(cfg.selfDrawPayers === 'all_opponents_or_liable' && next() % 3 === 0 ? { liablePlayerId: pick(others) } : {}),
        };
  return { outcome, ...(dealerId ? { dealerId } : {}), bonuses, manualAdjustments };
}

/** Codes that indicate the books would have been corrupted — these must NEVER appear. */
const FORBIDDEN = /^(INTERNAL|TX_|POSTING_|ROUND_UNBALANCED|LEDGER_UNBALANCED|AMOUNT_OVERFLOW)/;

function apply(game: GameSession, op: Op, ctx: ReturnType<typeof makeCtx>): Result<GameSession> {
  const active = activeRounds(game);
  const deleted = deletedRounds(game);
  switch (op.kind) {
    case 'record': {
      const r = recordRound(game, buildInput(game, op.picks), ctx());
      return r.ok ? { ok: true, value: r.value.game } : r;
    }
    case 'edit': {
      const target = active[op.target % Math.max(1, active.length)];
      if (!target) return { ok: true, value: game };
      const r = editRound(game, target.id, buildInput(game, op.picks), ctx(), { rules: op.current ? 'current' : 'snapshot' });
      return r.ok ? { ok: true, value: r.value.game } : r;
    }
    case 'delete': {
      const target = active[op.target % Math.max(1, active.length)];
      return target ? deleteRound(game, target.id, ctx()) : { ok: true, value: game };
    }
    case 'restore': {
      const target = deleted[op.target % Math.max(1, deleted.length)];
      return target ? restoreRound(game, target.id, ctx()) : { ok: true, value: game };
    }
    case 'undo': {
      if (!active.length) return { ok: true, value: game };
      const r = undoLastRound(game, ctx());
      return r.ok ? { ok: true, value: r.value.game } : r;
    }
    case 'reset':
      return resetGame(game, ctx());
    case 'rescore':
      return applyRescore(game, op.config, ctx());
    case 'rules':
      return updateGameConfig(game, op.config, ctx());
    case 'reseat': {
      const players = game.players.map((p) => ({
        ...p,
        seat: SEATS[(SEATS.indexOf(p.seat) + op.rotation) % 4] as Seat,
      }));
      return updatePlayers(game, players, ctx());
    }
  }
}

function assertBooksBalance(game: GameSession) {
  const balances = gameBalances(game);
  expect(balances.reduce((a, b) => a + b.netCents, 0)).toBe(0);
  balances.forEach((b) => expect(Number.isSafeInteger(b.netCents)).toBe(true));
  const v = validateLedger(gameLedger(game), {
    playerIds: game.players.map((p) => p.id),
    roundIds: activeRounds(game).map((r) => r.id),
  });
  expect(v.issues).toEqual([]);
  expect(v.ok).toBe(true);
  const health = checkGameHealth(game);
  expect(health.issues).toEqual([]);
  expect(health.ok).toBe(true);
}

describe('randomized invariants', () => {
  it('generated configurations are valid', () => {
    fc.assert(
      fc.property(configArb, (cfg) => {
        expect(validateConfig(cfg).filter((i) => i.severity === 'error')).toEqual([]);
      }),
    );
  });

  it('sum(allPlayerBalances) === 0 after every supported operation, and settlement clears everything', () => {
    let succeeded = 0;
    let attempted = 0;
    fc.assert(
      fc.property(configArb, fc.array(opArb, { minLength: 5, maxLength: 40, size: 'max' }), (cfg, ops) => {
        const ctx = makeCtx('p');
        let game = newGame(cfg, ctx);
        for (const op of ops) {
          attempted += 1;
          const before = JSON.stringify(game);
          const res = apply(game, op, ctx);
          if (res.ok) {
            succeeded += 1;
            game = res.value;
          } else {
            // Rejected operations are legitimate validation failures, never corruption,
            // and they leave the game untouched.
            for (const e of res.errors) expect(e.code).not.toMatch(FORBIDDEN);
            expect(JSON.stringify(game)).toBe(before);
          }
          assertBooksBalance(game);
        }

        // Final settlement exactly clears every balance with the proven minimum number of transfers.
        const balances = gameBalances(game);
        const res = computeSettlement(balances.map((b) => ({ playerId: b.playerId, netCents: b.netCents })));
        expect(res.ok).toBe(true);
        if (!res.ok) return;
        const remaining = new Map(balances.map((b) => [b.playerId, b.netCents]));
        for (const t of res.plan.transfers) {
          expect(t.amountCents).toBeGreaterThan(0);
          expect(Number.isSafeInteger(t.amountCents)).toBe(true);
          expect(t.fromPlayerId).not.toBe(t.toPlayerId);
          remaining.set(t.fromPlayerId, remaining.get(t.fromPlayerId)! + t.amountCents);
          remaining.set(t.toPlayerId, remaining.get(t.toPlayerId)! - t.amountCents);
        }
        for (const v of remaining.values()) expect(v).toBe(0);
        expect(res.plan.transfers.length).toBe(bruteForceMinTransfers(balances.map((b) => b.netCents)));
      }),
      { numRuns: 150 },
    );
    // Sanity: the generator is not so hostile that nothing ever succeeds.
    expect(succeeded / attempted).toBeGreaterThan(0.5);
  });

  it('each scored round nets to exactly zero for random inputs', () => {
    fc.assert(
      fc.property(configArb, picksArb, (cfg, picks) => {
        const ctx = makeCtx('s');
        const game = newGame(cfg, ctx);
        const r = recordRound(game, buildInput(game, picks), ctx());
        if (!r.ok) {
          for (const e of r.errors) expect(e.code).not.toMatch(FORBIDDEN);
          return;
        }
        const roundNet = netByPlayer(r.value.round.transactions, game.players.map((p) => p.id));
        expect(Object.values(roundNet).reduce((a, b) => a + b, 0)).toBe(0);
        const net = gameBalances(r.value.game).reduce((a, b) => a + b.netCents, 0);
        expect(net).toBe(0);
        r.value.round.transactions.forEach((t) => {
          expect(Number.isSafeInteger(t.amountCents)).toBe(true);
          expect(t.amountCents).toBeGreaterThan(0);
          expect(t.payerId).not.toBe(t.receiverId);
        });
      }),
      { numRuns: 500 },
    );
  });
});
