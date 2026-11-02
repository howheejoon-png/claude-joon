/**
 * Game health checks used by the "All Balances Tallied" indicator.
 *
 * 1. validateLedger over the whole game ledger (structure, integer cents,
 *    double-entry, every round and the game net to zero).
 * 2. A re-computation audit: every active round is re-scored from its saved
 *    inputs and its own rules snapshot, and the result must match the stored
 *    transactions exactly. Any mismatch means stored data was corrupted.
 *
 * Problems are reported, never auto-corrected.
 */
import type { GameSession, LedgerTransaction, ValidationIssue } from '../models/types';
import { activeRounds, gameBalances, gameLedger, roundNumbers } from './game';
import { validateLedger } from './ledger';
import { scoreRound, toTransactions } from './scoring';

export interface GameHealth {
  ok: boolean;
  issues: ValidationIssue[];
  /** Sum of all derived player balances; must be exactly 0. */
  balanceSumCents: number;
}

function sameTransaction(a: LedgerTransaction, b: LedgerTransaction): boolean {
  return (
    a.id === b.id &&
    a.roundId === b.roundId &&
    a.payerId === b.payerId &&
    a.receiverId === b.receiverId &&
    a.amountCents === b.amountCents
  );
}

export function auditRounds(game: GameSession): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const numbers = roundNumbers(game);
  for (const round of activeRounds(game)) {
    const label = `Round ${numbers.get(round.id) ?? '?'}`;
    // Every transaction stored under a round must say it belongs to that round.
    for (const tx of round.transactions) {
      if (tx?.roundId !== round.id) {
        issues.push({
          code: 'TX_ROUND_MISMATCH',
          severity: 'error',
          roundId: round.id,
          ...(typeof tx?.id === 'string' ? { transactionId: tx.id } : {}),
          message: `${label} contains a transaction that belongs to a different round.`,
        });
      }
    }
    const scored = scoreRound(round.input, { players: round.playersSnapshot, config: round.configSnapshot });
    if (!scored.ok) {
      issues.push({
        code: 'AUDIT_UNSCORABLE',
        severity: 'error',
        roundId: round.id,
        message: `${label} can no longer be scored from its saved inputs: ${scored.errors[0]?.message ?? 'unknown error'}`,
      });
      continue;
    }
    const expected = toTransactions(round.id, scored.value.transfers);
    const matches =
      expected.length === round.transactions.length &&
      expected.every((tx, i) => sameTransaction(tx, round.transactions[i]!));
    if (!matches) {
      issues.push({
        code: 'AUDIT_MISMATCH',
        severity: 'error',
        roundId: round.id,
        message: `${label}'s saved transactions do not match its recorded hand. The data may have been altered.`,
      });
    }
  }
  return issues;
}

export function checkGameHealth(game: GameSession): GameHealth {
  const active = activeRounds(game);
  const ledger = validateLedger(gameLedger(game), {
    playerIds: game.players.map((p) => p.id),
    roundIds: active.map((r) => r.id),
  });
  const audit = auditRounds(game);
  const balances = gameBalances(game);
  const balanceSumCents = balances.reduce((a, b) => a + b.netCents, 0);
  const issues = [...ledger.issues, ...audit];
  if (balanceSumCents !== 0 && ledger.totalCents === 0) {
    issues.push({
      code: 'BALANCE_SUM',
      severity: 'error',
      message: `Player balances add up to ${balanceSumCents}¢ instead of zero.`,
    });
  }
  return {
    ok: issues.every((i) => i.severity !== 'error') && balanceSumCents === 0 && ledger.ok,
    issues,
    balanceSumCents,
  };
}
