import type {
  Balance,
  Cents,
  LedgerPosting,
  LedgerTransaction,
  Player,
  PlayerId,
  Round,
  RoundId,
  ValidationIssue,
} from '../models/types';
import { isCents } from '../utils/money';

/**
 * Double-entry postings for a transaction: a debit on the payer and a
 * matching credit on the receiver.
 */
export function toPostings(tx: LedgerTransaction): [LedgerPosting, LedgerPosting] {
  return [
    { transactionId: tx.id, roundId: tx.roundId, playerId: tx.payerId, deltaCents: -tx.amountCents },
    { transactionId: tx.id, roundId: tx.roundId, playerId: tx.receiverId, deltaCents: tx.amountCents },
  ];
}

export interface LedgerValidation {
  /** True when no error-level issues were found and every total is exactly zero. */
  ok: boolean;
  issues: ValidationIssue[];
  /** Transactions that individually failed a check. */
  invalidTransactionIds: string[];
  /** Rounds whose postings do not net to zero. */
  unbalancedRoundIds: RoundId[];
  /** Net of every posting. Must be exactly 0 for a valid ledger. */
  totalCents: number;
  transactionCount: number;
}

export interface LedgerValidationOptions {
  /** If provided, every payer/receiver must be one of these players. */
  playerIds?: readonly PlayerId[];
  /** If provided, every transaction must belong to one of these rounds. */
  roundIds?: readonly RoundId[];
}

function issue(
  code: string,
  message: string,
  extra: { transactionId?: string; roundId?: string } = {},
): ValidationIssue {
  return { code, message, severity: 'error', ...extra };
}

/**
 * Shared accounting validation. Checks every transaction and the
 * double-entry postings derived from it, and reports exactly which records
 * are at fault. It NEVER modifies or "fixes" the ledger.
 */
export function validateLedger(
  transactions: readonly LedgerTransaction[],
  options: LedgerValidationOptions = {},
): LedgerValidation {
  const issues: ValidationIssue[] = [];
  const invalid = new Set<string>();
  const playerSet = options.playerIds ? new Set(options.playerIds) : null;
  const roundSet = options.roundIds ? new Set(options.roundIds) : null;
  const seenIds = new Set<string>();
  const postings: LedgerPosting[] = [];

  transactions.forEach((tx, index) => {
    const ref = typeof tx?.id === 'string' && tx.id !== '' ? tx.id : `#${index}`;
    const extra = { transactionId: ref, ...(typeof tx?.roundId === 'string' ? { roundId: tx.roundId } : {}) };
    const fail = (code: string, message: string) => {
      issues.push(issue(code, message, extra));
      invalid.add(ref);
    };

    if (!tx || typeof tx !== 'object') {
      fail('TX_MALFORMED', `Transaction ${ref} is not a valid record.`);
      return;
    }
    if (typeof tx.id !== 'string' || tx.id === '') fail('TX_ID_MISSING', `Transaction ${ref} has no id.`);
    else if (seenIds.has(tx.id)) fail('TX_ID_DUPLICATE', `Transaction id ${tx.id} appears more than once.`);
    seenIds.add(tx.id);

    if (typeof tx.roundId !== 'string' || tx.roundId === '') fail('TX_ROUND_MISSING', `Transaction ${ref} is not linked to a round.`);
    else if (roundSet && !roundSet.has(tx.roundId)) fail('TX_ROUND_UNKNOWN', `Transaction ${ref} refers to unknown round ${tx.roundId}.`);

    const payerOk = typeof tx.payerId === 'string' && tx.payerId !== '';
    const receiverOk = typeof tx.receiverId === 'string' && tx.receiverId !== '';
    if (!payerOk) fail('TX_PAYER_MISSING', `Transaction ${ref} has no payer.`);
    if (!receiverOk) fail('TX_RECEIVER_MISSING', `Transaction ${ref} has no receiver.`);
    if (payerOk && playerSet && !playerSet.has(tx.payerId)) fail('TX_PAYER_UNKNOWN', `Transaction ${ref} has an unknown payer.`);
    if (receiverOk && playerSet && !playerSet.has(tx.receiverId))
      fail('TX_RECEIVER_UNKNOWN', `Transaction ${ref} has an unknown receiver.`);
    if (payerOk && receiverOk && tx.payerId === tx.receiverId)
      fail('TX_SELF_PAYMENT', `Transaction ${ref}: a player cannot pay themselves.`);

    if (!isCents(tx.amountCents)) {
      fail('TX_AMOUNT_NOT_INTEGER', `Transaction ${ref} amount ${String(tx.amountCents)} is not a whole number of cents.`);
    } else if (tx.amountCents <= 0) {
      fail('TX_AMOUNT_NOT_POSITIVE', `Transaction ${ref} amount must be positive.`);
    }

    if (typeof tx.amountCents === 'number' && Number.isFinite(tx.amountCents)) {
      postings.push(...toPostings(tx));
    }
  });

  const postingCheck = validatePostings(postings);
  issues.push(...postingCheck.issues);

  const ok = issues.every((i) => i.severity !== 'error') && postingCheck.totalCents === 0;
  return {
    ok,
    issues,
    invalidTransactionIds: [...invalid],
    unbalancedRoundIds: postingCheck.unbalancedRoundIds,
    totalCents: postingCheck.totalCents,
    transactionCount: transactions.length,
  };
}

/**
 * Validate raw double-entry postings: each transaction must have exactly one
 * debit and one matching credit, and every round and the whole ledger must
 * net to exactly zero.
 */
export function validatePostings(postings: readonly LedgerPosting[]): {
  issues: ValidationIssue[];
  unbalancedRoundIds: RoundId[];
  totalCents: number;
} {
  const issues: ValidationIssue[] = [];
  const byTx = new Map<string, LedgerPosting[]>();
  const byRound = new Map<string, number>();
  let total = 0;
  for (const p of postings) {
    if (!isCents(p.deltaCents)) {
      issues.push(
        issue('POSTING_NOT_INTEGER', `Posting for ${p.transactionId} is not a whole number of cents.`, {
          transactionId: p.transactionId,
          roundId: p.roundId,
        }),
      );
    }
    const list = byTx.get(p.transactionId) ?? [];
    list.push(p);
    byTx.set(p.transactionId, list);
    byRound.set(p.roundId, (byRound.get(p.roundId) ?? 0) + p.deltaCents);
    total += p.deltaCents;
  }
  for (const [txId, list] of byTx) {
    const debits = list.filter((p) => p.deltaCents < 0);
    const credits = list.filter((p) => p.deltaCents > 0);
    const net = list.reduce((a, p) => a + p.deltaCents, 0);
    if (debits.length !== credits.length || net !== 0) {
      issues.push(
        issue('POSTING_UNMATCHED', `Transaction ${txId} does not have matching debit and credit entries.`, {
          transactionId: txId,
          roundId: list[0]?.roundId ?? '',
        }),
      );
    }
  }
  const unbalancedRoundIds: string[] = [];
  for (const [roundId, net] of byRound) {
    if (net !== 0) {
      unbalancedRoundIds.push(roundId);
      issues.push(issue('ROUND_UNBALANCED', `Round ${roundId} does not net to zero (off by ${net}¢).`, { roundId }));
    }
  }
  if (total !== 0) {
    issues.push(issue('LEDGER_UNBALANCED', `The ledger does not net to zero (off by ${total}¢).`));
  }
  return { issues, unbalancedRoundIds, totalCents: total };
}

/** Net cents per player for a list of transactions (players with no activity are 0). */
export function netByPlayer(
  transactions: readonly LedgerTransaction[],
  playerIds: readonly PlayerId[],
): Record<PlayerId, Cents> {
  const net: Record<PlayerId, Cents> = {};
  for (const id of playerIds) net[id] = 0;
  for (const tx of transactions) {
    for (const p of toPostings(tx)) {
      net[p.playerId] = (net[p.playerId] ?? 0) + p.deltaCents;
    }
  }
  return net;
}

/**
 * Derive balances from rounds' ledger transactions. Displayed balances are
 * ALWAYS computed here from the ledger; nothing stores a running total.
 */
export function computeBalances(players: readonly Player[], rounds: readonly Round[]): Balance[] {
  const ids = players.map((p) => p.id);
  const balances = new Map<PlayerId, Balance>(
    ids.map((id) => [id, { playerId: id, netCents: 0, receivedCents: 0, paidCents: 0, wins: 0, losses: 0 }]),
  );
  for (const round of rounds) {
    if (round.deletedAt) continue;
    const roundNet = netByPlayer(round.transactions, ids);
    for (const tx of round.transactions) {
      const payer = balances.get(tx.payerId);
      const receiver = balances.get(tx.receiverId);
      if (payer) {
        payer.paidCents += tx.amountCents;
        payer.netCents -= tx.amountCents;
      }
      if (receiver) {
        receiver.receivedCents += tx.amountCents;
        receiver.netCents += tx.amountCents;
      }
    }
    const o = round.input.outcome;
    for (const id of ids) {
      const b = balances.get(id)!;
      if (o.type === 'win' && o.winnerId === id) b.wins += 1;
      else if ((roundNet[id] ?? 0) < 0) b.losses += 1;
    }
  }
  return ids.map((id) => balances.get(id)!);
}
