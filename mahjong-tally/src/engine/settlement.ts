/**
 * Final settlement: turn net balances into a list of payments that clears
 * every balance exactly.
 *
 * Algorithm (exact, integer cents):
 *   For k players with non-zero balances, the minimum number of transfers is
 *   k − g, where g is the largest number of groups the players can be split
 *   into such that each group's balances sum to zero. We find g with a
 *   subset dynamic programme (2^k states; k ≤ 4 here, supported up to 16),
 *   then settle each group greedily. In a group that cannot be split further,
 *   each greedy transfer clears at least one player and the last clears two,
 *   so a group of size s needs exactly s − 1 transfers — which is also the
 *   lower bound. The plan is therefore guaranteed minimal.
 *
 *   Every player in the plan only pays or only receives, so there are never
 *   circular transfers.
 */
import type { Cents, PlayerId, SettlementTransfer } from '../models/types';
import { isCents } from '../utils/money';

export interface NetBalance {
  playerId: PlayerId;
  netCents: Cents;
}

export interface SettlementPlan {
  transfers: SettlementTransfer[];
  /** True when the plan is proven to use the fewest possible transfers. */
  isMinimal: boolean;
  /** Total moved across all transfers. */
  totalTransferredCents: Cents;
}

export type SettlementResult =
  | { ok: true; plan: SettlementPlan }
  | { ok: false; error: string };

const MAX_EXACT_PLAYERS = 16;

export function computeSettlement(balances: readonly NetBalance[]): SettlementResult {
  for (const b of balances) {
    if (!isCents(b.netCents)) return { ok: false, error: `Balance for ${b.playerId} is not a whole number of cents.` };
  }
  const total = balances.reduce((a, b) => a + b.netCents, 0);
  if (total !== 0) {
    return { ok: false, error: `Balances do not sum to zero (off by ${total}¢); settlement is not possible.` };
  }
  const ids = new Set(balances.map((b) => b.playerId));
  if (ids.size !== balances.length) return { ok: false, error: 'Duplicate player in balances.' };

  // Input order is preserved for deterministic tie-breaking.
  const nonZero = balances.filter((b) => b.netCents !== 0);
  if (nonZero.length === 0) return { ok: true, plan: { transfers: [], isMinimal: true, totalTransferredCents: 0 } };

  let groups: NetBalance[][];
  let isMinimal: boolean;
  if (nonZero.length <= MAX_EXACT_PLAYERS) {
    groups = maxZeroSumPartition(nonZero);
    isMinimal = true;
  } else {
    groups = [nonZero];
    isMinimal = false;
  }

  const transfers: SettlementTransfer[] = [];
  for (const group of groups) transfers.push(...settleGroup(group));

  // Post-condition: applying the plan clears every balance exactly.
  const remaining = new Map(balances.map((b) => [b.playerId, b.netCents]));
  for (const t of transfers) {
    remaining.set(t.fromPlayerId, (remaining.get(t.fromPlayerId) ?? 0) + t.amountCents);
    remaining.set(t.toPlayerId, (remaining.get(t.toPlayerId) ?? 0) - t.amountCents);
  }
  for (const [id, v] of remaining) {
    if (v !== 0) return { ok: false, error: `Internal error: settlement leaves ${id} with ${v}¢.` };
  }

  return {
    ok: true,
    plan: { transfers, isMinimal, totalTransferredCents: transfers.reduce((a, t) => a + t.amountCents, 0) },
  };
}

/** Split players into the maximum number of zero-sum groups (bitmask DP). */
function maxZeroSumPartition(players: readonly NetBalance[]): NetBalance[][] {
  const n = players.length;
  const full = (1 << n) - 1;
  const sum = new Array<number>(full + 1).fill(0);
  for (let mask = 1; mask <= full; mask += 1) {
    const low = mask & -mask;
    const i = 31 - Math.clz32(low);
    sum[mask] = sum[mask ^ low]! + players[i]!.netCents;
  }
  // dp[mask] = max number of zero-sum "prefix cuts" when ordering the players in mask.
  const dp = new Array<number>(full + 1).fill(0);
  for (let mask = 1; mask <= full; mask += 1) {
    let best = 0;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) best = Math.max(best, dp[mask ^ (1 << i)]!);
    }
    dp[mask] = best + (sum[mask] === 0 ? 1 : 0);
  }
  // Reconstruct an ordering, then cut it wherever the running sum hits zero.
  const orderReversed: number[] = [];
  let mask = full;
  while (mask) {
    const bonus = sum[mask] === 0 ? 1 : 0;
    let chosen = -1;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i) && dp[mask ^ (1 << i)]! + bonus === dp[mask]) {
        chosen = i;
        break;
      }
    }
    orderReversed.push(chosen);
    mask ^= 1 << chosen;
  }
  const order = orderReversed.reverse();
  const groups: NetBalance[][] = [];
  let current: NetBalance[] = [];
  let running = 0;
  for (const i of order) {
    current.push(players[i]!);
    running += players[i]!.netCents;
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current); // unreachable when total is zero
  return groups;
}

/** Greedy settlement inside one zero-sum group: largest debtor pays largest creditor. */
function settleGroup(group: readonly NetBalance[]): SettlementTransfer[] {
  const index = new Map(group.map((b, i) => [b.playerId, i]));
  const debtors = group.filter((b) => b.netCents < 0).map((b) => ({ id: b.playerId, amount: -b.netCents }));
  const creditors = group.filter((b) => b.netCents > 0).map((b) => ({ id: b.playerId, amount: b.netCents }));
  const byAmount = (a: { id: string; amount: number }, b: { id: string; amount: number }) =>
    b.amount - a.amount || index.get(a.id)! - index.get(b.id)!;
  const transfers: SettlementTransfer[] = [];
  while (debtors.length && creditors.length) {
    debtors.sort(byAmount);
    creditors.sort(byAmount);
    const d = debtors[0]!;
    const c = creditors[0]!;
    const amount = Math.min(d.amount, c.amount);
    transfers.push({ fromPlayerId: d.id, toPlayerId: c.id, amountCents: amount });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) debtors.shift();
    if (c.amount === 0) creditors.shift();
  }
  return transfers;
}
