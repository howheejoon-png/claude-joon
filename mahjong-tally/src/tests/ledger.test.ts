import { describe, expect, it } from 'vitest';
import { computeBalances, netByPlayer, toPostings, validateLedger, validatePostings } from '../engine/ledger';
import type { LedgerPosting, LedgerTransaction } from '../models/types';
import { PLAYERS } from './helpers';

const ids = PLAYERS.map((p) => p.id);

function tx(id: string, payerId: string, receiverId: string, amountCents: number, roundId = 'r1'): LedgerTransaction {
  return { id, roundId, payerId, receiverId, amountCents, kind: 'hand', description: 'test' };
}

/** The spec's worked example: A wins $12.00 on a self-draw. */
const selfDrawLedger = [tx('t1', 'b', 'a', 400), tx('t2', 'c', 'a', 400), tx('t3', 'd', 'a', 400)];

describe('double-entry postings', () => {
  it('each transaction creates a matching debit and credit', () => {
    const [debit, credit] = toPostings(tx('t1', 'b', 'a', 400));
    expect(debit).toMatchObject({ playerId: 'b', deltaCents: -400 });
    expect(credit).toMatchObject({ playerId: 'a', deltaCents: 400 });
  });

  it('the spec example nets to exactly zero', () => {
    expect(netByPlayer(selfDrawLedger, ids)).toEqual({ a: 1200, b: -400, c: -400, d: -400 });
    const v = validateLedger(selfDrawLedger, { playerIds: ids, roundIds: ['r1'] });
    expect(v.ok).toBe(true);
    expect(v.totalCents).toBe(0);
    expect(v.issues).toEqual([]);
  });

  it('an empty ledger is valid', () => {
    expect(validateLedger([]).ok).toBe(true);
  });
});

describe('validateLedger detects invalid records', () => {
  const cases: [string, LedgerTransaction[], string][] = [
    ['self payment', [tx('t1', 'a', 'a', 100)], 'TX_SELF_PAYMENT'],
    ['fractional cents', [tx('t1', 'b', 'a', 4.5)], 'TX_AMOUNT_NOT_INTEGER'],
    ['float dollars', [tx('t1', 'b', 'a', 0.1 + 0.2)], 'TX_AMOUNT_NOT_INTEGER'],
    ['zero amount', [tx('t1', 'b', 'a', 0)], 'TX_AMOUNT_NOT_POSITIVE'],
    ['negative amount', [tx('t1', 'b', 'a', -100)], 'TX_AMOUNT_NOT_POSITIVE'],
    ['NaN amount', [tx('t1', 'b', 'a', Number.NaN)], 'TX_AMOUNT_NOT_INTEGER'],
    ['missing payer', [tx('t1', '', 'a', 100)], 'TX_PAYER_MISSING'],
    ['missing receiver', [tx('t1', 'b', '', 100)], 'TX_RECEIVER_MISSING'],
    ['unknown payer', [tx('t1', 'zed', 'a', 100)], 'TX_PAYER_UNKNOWN'],
    ['unknown receiver', [tx('t1', 'b', 'zed', 100)], 'TX_RECEIVER_UNKNOWN'],
    ['duplicate id', [tx('t1', 'b', 'a', 100), tx('t1', 'c', 'a', 100)], 'TX_ID_DUPLICATE'],
    ['missing id', [tx('', 'b', 'a', 100)], 'TX_ID_MISSING'],
    ['unknown round', [tx('t1', 'b', 'a', 100, 'ghost')], 'TX_ROUND_UNKNOWN'],
    ['missing round', [tx('t1', 'b', 'a', 100, '')], 'TX_ROUND_MISSING'],
  ];

  for (const [name, ledger, code] of cases) {
    it(`flags ${name}`, () => {
      const v = validateLedger(ledger, { playerIds: ids, roundIds: ['r1'] });
      expect(v.ok).toBe(false);
      expect(v.issues.map((i) => i.code)).toContain(code);
      expect(v.invalidTransactionIds.length).toBeGreaterThan(0);
    });
  }

  it('identifies exactly which record is bad among good ones', () => {
    const ledger = [...selfDrawLedger, tx('bad', 'c', 'c', 50)];
    const v = validateLedger(ledger, { playerIds: ids, roundIds: ['r1'] });
    expect(v.ok).toBe(false);
    expect(v.invalidTransactionIds).toEqual(['bad']);
    expect(v.issues.find((i) => i.code === 'TX_SELF_PAYMENT')?.transactionId).toBe('bad');
  });

  it('handles malformed (non-object) records without throwing', () => {
    const v = validateLedger([null as unknown as LedgerTransaction]);
    expect(v.ok).toBe(false);
    expect(v.issues[0]!.code).toBe('TX_MALFORMED');
  });

  it('never modifies the ledger it validates', () => {
    const ledger = [tx('t1', 'b', 'a', 4.5)];
    const copy = JSON.parse(JSON.stringify(ledger));
    validateLedger(ledger);
    expect(ledger).toEqual(copy);
  });
});

describe('validatePostings', () => {
  it('detects an unmatched posting and unbalanced rounds', () => {
    const postings: LedgerPosting[] = [
      ...toPostings(tx('t1', 'b', 'a', 400)),
      { transactionId: 't2', roundId: 'r2', playerId: 'c', deltaCents: -400 }, // debit with no credit
    ];
    const v = validatePostings(postings);
    expect(v.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['POSTING_UNMATCHED', 'ROUND_UNBALANCED', 'LEDGER_UNBALANCED']),
    );
    expect(v.unbalancedRoundIds).toEqual(['r2']);
    expect(v.totalCents).toBe(-400);
  });

  it('detects mismatched debit/credit amounts', () => {
    const v = validatePostings([
      { transactionId: 't1', roundId: 'r1', playerId: 'b', deltaCents: -400 },
      { transactionId: 't1', roundId: 'r1', playerId: 'a', deltaCents: 399 },
    ]);
    expect(v.issues.map((i) => i.code)).toContain('POSTING_UNMATCHED');
    expect(v.unbalancedRoundIds).toEqual(['r1']);
  });

  it('detects non-integer postings', () => {
    const v = validatePostings([
      { transactionId: 't1', roundId: 'r1', playerId: 'b', deltaCents: -0.5 },
      { transactionId: 't1', roundId: 'r1', playerId: 'a', deltaCents: 0.5 },
    ]);
    expect(v.issues.map((i) => i.code)).toContain('POSTING_NOT_INTEGER');
  });

  it('accepts balanced postings', () => {
    const v = validatePostings(selfDrawLedger.flatMap(toPostings));
    expect(v.issues).toEqual([]);
    expect(v.totalCents).toBe(0);
  });
});

describe('computeBalances', () => {
  it('derives balances, wins and losses from the ledger and ignores deleted rounds', () => {
    const base = {
      seq: 1,
      createdAt: '',
      updatedAt: '',
      configSnapshot: {} as never,
      playersSnapshot: PLAYERS,
      notes: [],
      revisions: [],
    };
    const rounds = [
      {
        ...base,
        id: 'r1',
        input: { outcome: { type: 'win' as const, winnerId: 'a', method: 'self_draw' as const, tai: 1 }, bonuses: [], manualAdjustments: [] },
        transactions: selfDrawLedger,
      },
      {
        ...base,
        id: 'r2',
        seq: 2,
        input: { outcome: { type: 'win' as const, winnerId: 'b', method: 'discard' as const, discarderId: 'a', tai: 1 }, bonuses: [], manualAdjustments: [] },
        transactions: [tx('r2:0', 'a', 'b', 60, 'r2')],
      },
      {
        ...base,
        id: 'r3',
        seq: 3,
        deletedAt: 'x',
        input: { outcome: { type: 'win' as const, winnerId: 'c', method: 'discard' as const, discarderId: 'd', tai: 1 }, bonuses: [], manualAdjustments: [] },
        transactions: [tx('r3:0', 'd', 'c', 9999, 'r3')],
      },
    ];
    const balances = computeBalances(PLAYERS, rounds);
    expect(balances).toEqual([
      { playerId: 'a', netCents: 1140, receivedCents: 1200, paidCents: 60, wins: 1, losses: 1 },
      { playerId: 'b', netCents: -340, receivedCents: 60, paidCents: 400, wins: 1, losses: 1 },
      { playerId: 'c', netCents: -400, receivedCents: 0, paidCents: 400, wins: 0, losses: 1 },
      { playerId: 'd', netCents: -400, receivedCents: 0, paidCents: 400, wins: 0, losses: 1 },
    ]);
    expect(balances.reduce((a, b) => a + b.netCents, 0)).toBe(0);
  });

  it('zero-balance players stay at exactly zero', () => {
    const balances = computeBalances(PLAYERS, []);
    balances.forEach((b) => expect(b).toMatchObject({ netCents: 0, wins: 0, losses: 0 }));
  });
});
