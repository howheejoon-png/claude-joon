import { describe, expect, it } from 'vitest';
import { auditRounds, checkGameHealth } from '../engine/audit';
import { recordRound } from '../engine/game';
import type { GameSession } from '../models/types';
import { config, discard, makeCtx, newGame, selfDraw, unwrap } from './helpers';

function healthyGame(): GameSession {
  const ctx = makeCtx();
  let g = newGame(config(), ctx);
  g = unwrap(recordRound(g, selfDraw('a', 3), ctx())).game;
  g = unwrap(recordRound(g, discard('b', 'c', 2), ctx())).game;
  return g;
}

/** Deep-clone and tamper with stored data, as if storage had been corrupted or hand-edited. */
function tamper(mutate: (g: GameSession) => void): GameSession {
  const g = JSON.parse(JSON.stringify(healthyGame())) as GameSession;
  mutate(g);
  return g;
}

function codes(g: GameSession) {
  return checkGameHealth(g).issues.map((i) => i.code);
}

describe('ledger corruption detection', () => {
  it('a healthy game passes every check', () => {
    const h = checkGameHealth(healthyGame());
    expect(h).toEqual({ ok: true, issues: [], balanceSumCents: 0 });
  });

  it('detects a tampered amount (balances no longer match the recorded hand)', () => {
    const g = tamper((g) => {
      g.rounds[0]!.transactions[0]!.amountCents = 999;
    });
    const h = checkGameHealth(g);
    expect(h.ok).toBe(false);
    expect(codes(g)).toContain('AUDIT_MISMATCH');
    expect(h.issues.find((i) => i.code === 'AUDIT_MISMATCH')?.roundId).toBe(g.rounds[0]!.id);
  });

  it('detects a fractional (float) amount', () => {
    const g = tamper((g) => {
      g.rounds[0]!.transactions[0]!.amountCents = 240.5;
    });
    expect(checkGameHealth(g).ok).toBe(false);
    expect(codes(g)).toEqual(expect.arrayContaining(['TX_AMOUNT_NOT_INTEGER', 'AUDIT_MISMATCH']));
  });

  it('detects a self-payment', () => {
    const g = tamper((g) => {
      const t = g.rounds[0]!.transactions[0]!;
      t.payerId = t.receiverId;
    });
    expect(codes(g)).toContain('TX_SELF_PAYMENT');
  });

  it('detects an unknown player', () => {
    const g = tamper((g) => {
      g.rounds[1]!.transactions[0]!.payerId = 'ghost';
    });
    expect(codes(g)).toContain('TX_PAYER_UNKNOWN');
  });

  it('detects duplicate transaction ids', () => {
    const g = tamper((g) => {
      g.rounds[0]!.transactions[1]!.id = g.rounds[0]!.transactions[0]!.id;
    });
    expect(codes(g)).toContain('TX_ID_DUPLICATE');
  });

  it('detects a transaction moved to another (or deleted) round', () => {
    const moved = tamper((g) => {
      const t = g.rounds[0]!.transactions.pop()!;
      g.rounds[1]!.transactions.push(t);
    });
    expect(codes(moved)).toEqual(expect.arrayContaining(['TX_ROUND_MISMATCH', 'AUDIT_MISMATCH']));

    const orphan = tamper((g) => {
      g.rounds[0]!.transactions[0]!.roundId = 'deleted-round';
    });
    expect(codes(orphan)).toContain('TX_ROUND_UNKNOWN');
  });

  it('detects a missing transaction (a payer silently dropped)', () => {
    const g = tamper((g) => {
      g.rounds[0]!.transactions.pop();
    });
    expect(codes(g)).toContain('AUDIT_MISMATCH');
  });

  it('detects an extra injected "correction" transaction', () => {
    const g = tamper((g) => {
      g.rounds[1]!.transactions.push({
        id: `${g.rounds[1]!.id}:99`,
        roundId: g.rounds[1]!.id,
        payerId: 'd',
        receiverId: 'a',
        amountCents: 100,
        kind: 'manual',
        description: 'Sneaky',
      });
    });
    expect(codes(g)).toContain('AUDIT_MISMATCH');
  });

  it('detects rounds that can no longer be scored from their inputs', () => {
    const g = tamper((g) => {
      g.rounds[0]!.input.outcome = { type: 'win', winnerId: 'ghost', method: 'self_draw', tai: 1 };
    });
    expect(auditRounds(g).map((i) => i.code)).toContain('AUDIT_UNSCORABLE');
  });

  it('does not flag deleted rounds, and never repairs anything', () => {
    const g = tamper((g) => {
      g.rounds[0]!.deletedAt = '2026-01-01T00:00:00.000Z';
      g.rounds[0]!.transactions[0]!.amountCents = 1; // corrupted, but excluded from the ledger
    });
    const snapshot = JSON.stringify(g);
    expect(checkGameHealth(g).ok).toBe(true);
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});
