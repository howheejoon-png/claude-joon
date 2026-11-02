/**
 * Scoring engine: turns what happened in a round (RoundInput) plus a set of
 * house rules (ScoringConfiguration) into money transfers between players.
 *
 * Pure functions only — no React, no storage, no clocks, no randomness.
 * All amounts are integer cents. Fractions of a cent can only arise from
 * percentage multipliers; they are resolved by the configured rounding rule,
 * or rejected with an actionable error in `exact` mode. Nothing is ever
 * rounded or "corrected" silently.
 */
import type {
  BonusRule,
  Cents,
  LedgerTransaction,
  PaymentComponent,
  Player,
  PlayerId,
  RoundId,
  RoundInput,
  ScoringConfiguration,
  TransactionKind,
  ValidationIssue,
  Result,
} from '../models/types';
import { SEATS } from '../models/types';
import { allocateProportionally, formatCents, roundRational } from '../utils/money';
import { hasErrors, validateConfig, validateRoundInput } from './validation';

export interface TransferDraft {
  payerId: PlayerId;
  receiverId: PlayerId;
  amountCents: Cents;
  kind: TransactionKind;
  description: string;
  components?: PaymentComponent[];
}

export interface ScoredRound {
  transfers: TransferDraft[];
  /** Tai used for the payout lookup (after bonuses and the max-tai cap). */
  effectiveTai?: number;
  /** Human-readable notes about caps, rounding and liability. */
  notes: string[];
}

export interface ScoreContext {
  players: readonly Player[];
  config: ScoringConfiguration;
}

interface Share {
  payerId: PlayerId;
  /** Base amount from the payout table (integer cents). */
  base: Cents;
  baseLabel: string;
  /** Fixed per-payer extras (integer cents), applied after multipliers. */
  extras: PaymentComponent[];
  /** Final amount after multipliers, rounding and caps. */
  final: Cents;
  components: PaymentComponent[];
}

function scoreError(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, severity: 'error', ...(path ? { path } : {}) };
}

function seatOrder(players: readonly Player[]): Player[] {
  return [...players].sort((a, b) => SEATS.indexOf(a.seat) - SEATS.indexOf(b.seat));
}

const MULTIPLIER_LABEL = (pct: number) => {
  const whole = Math.trunc(pct / 100);
  const frac = pct - whole * 100;
  return frac === 0 ? `×${whole}` : `×${whole}.${frac.toString().padStart(2, '0').replace(/0$/, '')}`;
};

/**
 * Score one round. Returns transfers, or validation errors describing exactly
 * why the round cannot be scored.
 */
export function scoreRound(input: RoundInput, ctx: ScoreContext): Result<ScoredRound> {
  const { config } = ctx;
  const configIssues = validateConfig(config).filter((i) => i.severity === 'error');
  if (configIssues.length > 0) {
    return {
      ok: false,
      errors: [
        scoreError('CONFIG_INVALID', 'The house rules for this round are invalid. Fix them in Settings → Scoring rules.'),
        ...configIssues,
      ],
    };
  }
  const inputIssues = validateRoundInput(input, ctx.players, config);
  if (hasErrors(inputIssues)) return { ok: false, errors: inputIssues.filter((i) => i.severity === 'error') };

  const players = seatOrder(ctx.players);
  const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? 'Unknown player';
  const rules = new Map(config.bonusRules.map((r) => [r.id, r]));
  const applied = input.bonuses
    .map((b) => ({ bonus: b, rule: rules.get(b.ruleId) as BonusRule }))
    .filter((x) => x.rule !== undefined);

  const transfers: TransferDraft[] = [];
  const notes: string[] = [];
  let effectiveTai: number | undefined;

  const outcome = input.outcome;
  if (outcome.type === 'win') {
    const handResult = scoreHand(input, ctx, players, applied, nameOf);
    if (!handResult.ok) return handResult;
    transfers.push(...handResult.value.transfers);
    notes.push(...handResult.value.notes);
    effectiveTai = handResult.value.effectiveTai;
  }

  // Instant adjustments (any round, including draws).
  for (const { bonus, rule } of applied) {
    if (rule.kind !== 'collect_from_each' && rule.kind !== 'penalty_pay_each') continue;
    const subject = bonus.playerId!;
    const amount = rule.value * bonus.count;
    const countText = bonus.count > 1 ? ` ×${bonus.count}` : '';
    for (const other of players) {
      if (other.id === subject) continue;
      if (rule.kind === 'collect_from_each') {
        transfers.push({
          payerId: other.id,
          receiverId: subject,
          amountCents: amount,
          kind: 'bonus',
          description: `${rule.name}${countText}`,
        });
      } else {
        transfers.push({
          payerId: subject,
          receiverId: other.id,
          amountCents: amount,
          kind: 'penalty',
          description: `${rule.name}${countText}`,
        });
      }
    }
  }

  for (const m of input.manualAdjustments) {
    transfers.push({
      payerId: m.payerId,
      receiverId: m.receiverId,
      amountCents: m.amountCents,
      kind: 'manual',
      description: m.note.trim() === '' ? 'Manual adjustment' : m.note.trim(),
    });
  }

  if (outcome.type === 'draw') notes.unshift('Drawn round — no hand payment.');

  // Final guard: every transfer must be a positive integer between two different players.
  for (const t of transfers) {
    if (!Number.isSafeInteger(t.amountCents) || t.amountCents <= 0 || t.payerId === t.receiverId) {
      return {
        ok: false,
        errors: [scoreError('INTERNAL_INVALID_TRANSFER', `Scoring produced an invalid transfer (${t.description}).`)],
      };
    }
  }

  return { ok: true, value: { transfers, notes, ...(effectiveTai !== undefined ? { effectiveTai } : {}) } };
}

function scoreHand(
  input: RoundInput,
  ctx: ScoreContext,
  players: Player[],
  applied: { bonus: RoundInput['bonuses'][number]; rule: BonusRule }[],
  nameOf: (id: PlayerId) => string,
): Result<ScoredRound> {
  const { config } = ctx;
  const outcome = input.outcome;
  if (outcome.type !== 'win') throw new Error('scoreHand requires a win');
  const notes: string[] = [];
  const winnerId = outcome.winnerId;
  const dealerId = input.dealerId;
  const dealerRule = config.dealer;
  const dealerWins = dealerRule.enabled && dealerId === winnerId;

  // 1. Effective tai: base + dealer extra + extra-tai bonuses, capped at max tai.
  let rawTai = outcome.tai;
  const taiParts: string[] = [`${outcome.tai} tai`];
  if (dealerWins && dealerRule.extraTaiWhenDealerWins > 0) {
    rawTai += dealerRule.extraTaiWhenDealerWins;
    taiParts.push(`+${dealerRule.extraTaiWhenDealerWins} dealer`);
  }
  for (const { bonus, rule } of applied) {
    if (rule.kind === 'extra_tai') {
      rawTai += rule.value * bonus.count;
      taiParts.push(`+${rule.value * bonus.count} ${rule.name}`);
    }
  }
  const effectiveTai = Math.min(rawTai, config.maxTai);
  if (rawTai > config.maxTai) notes.push(`Hand was ${rawTai} tai; capped at the maximum of ${config.maxTai} tai.`);
  else if (taiParts.length > 1) notes.push(`Effective tai: ${taiParts.join(' ')} = ${effectiveTai} tai.`);

  const row = config.payoutTable.find((r) => r.tai === effectiveTai);
  if (!row) {
    return { ok: false, errors: [scoreError('ROW_MISSING', `No payout is configured for ${effectiveTai} tai.`)] };
  }

  // 2. Shares: one per paying opponent, in seat order.
  const opponents = players.filter((p) => p.id !== winnerId);
  const shares: Share[] = [];
  for (const opp of opponents) {
    let base: Cents;
    let baseLabel: string;
    if (outcome.method === 'self_draw') {
      base = row.selfDrawEachPays;
      baseLabel = `Self-draw (自摸), ${effectiveTai} tai`;
    } else if (opp.id === outcome.discarderId) {
      base = row.discarderPays;
      baseLabel = `Discarder (放炮), ${effectiveTai} tai`;
    } else if (config.discardLiability === 'shared') {
      base = row.othersPay;
      baseLabel = `Shared discard payment, ${effectiveTai} tai`;
    } else {
      continue; // discarder_only: other opponents are not paying players
    }
    const extras: PaymentComponent[] = [];
    for (const { bonus, rule } of applied) {
      if (rule.kind === 'winner_bonus_per_payer') {
        extras.push({ label: `${rule.name}${bonus.count > 1 ? ` ×${bonus.count}` : ''}`, amountCents: rule.value * bonus.count });
      }
    }
    if (dealerWins && dealerRule.extraCentsPerPayerWhenDealerWins > 0) {
      extras.push({ label: 'Dealer win bonus', amountCents: dealerRule.extraCentsPerPayerWhenDealerWins });
    }
    if (dealerRule.enabled && dealerId === opp.id && dealerRule.extraCentsWhenDealerPays > 0) {
      extras.push({ label: 'Dealer surcharge', amountCents: dealerRule.extraCentsWhenDealerPays });
    }
    shares.push({ payerId: opp.id, base, baseLabel, extras, final: 0, components: [] });
  }

  // 3. Multipliers, extras and rounding, computed exactly as a rational number.
  const multipliers = applied.filter((x) => x.rule.kind === 'payout_multiplier').map((x) => x.rule);
  let pctProduct = 1;
  let denominator = 1;
  for (const m of multipliers) {
    pctProduct *= m.value;
    denominator *= 100;
  }
  if (!Number.isSafeInteger(pctProduct) || !Number.isSafeInteger(denominator)) {
    return { ok: false, errors: [scoreError('MULTIPLIER_OVERFLOW', 'Too many multipliers applied to one hand.')] };
  }
  const { rounding } = config;
  for (const share of shares) {
    const components: PaymentComponent[] = [{ label: share.baseLabel, amountCents: share.base }];
    const extrasTotal = share.extras.reduce((a, e) => a + e.amountCents, 0);
    const numerator = share.base * pctProduct + extrasTotal * denominator;
    if (!Number.isSafeInteger(numerator)) {
      return { ok: false, errors: [scoreError('AMOUNT_OVERFLOW', 'A payment is too large to calculate safely.')] };
    }
    const rounded = roundRational(numerator, denominator, rounding.mode, rounding.incrementCents);
    if (rounded.cents === null) {
      return {
        ok: false,
        errors: [
          scoreError(
            'FRACTIONAL_CENTS',
            `${nameOf(share.payerId)}'s payment works out to a fraction of a cent. Choose a rounding rule in Settings → Scoring rules, or change the multiplier.`,
            'rounding.mode',
          ),
        ],
      };
    }
    if (multipliers.length > 0) {
      // Show the multiplier effect in whole cents (floored); any remainder appears as rounding.
      const multiplied = roundRational(share.base * pctProduct, denominator, 'down', 1).cents!;
      components.push({
        label: `Multiplier ${multipliers.map((m) => `${m.name} ${MULTIPLIER_LABEL(m.value)}`).join(', ')}`,
        amountCents: multiplied - share.base,
      });
    }
    components.push(...share.extras);
    const preRounding = components.reduce((a, c) => a + c.amountCents, 0);
    if (rounded.cents !== preRounding) {
      components.push({
        label: `Rounding (${rounding.mode} to ${formatCents(rounding.incrementCents)})`,
        amountCents: rounded.cents - preRounding,
      });
    }
    share.final = rounded.cents;
    share.components = components;
  }

  // 4. Payout caps.
  const cap = config.payoutCap;
  if (cap.mode === 'per_payment') {
    for (const share of shares) {
      if (share.final > cap.amountCents) {
        share.components.push({ label: `Cap (max ${formatCents(cap.amountCents)} per payment)`, amountCents: cap.amountCents - share.final });
        share.final = cap.amountCents;
        notes.push(`${nameOf(share.payerId)}'s payment capped at ${formatCents(cap.amountCents)}.`);
      }
    }
  } else if (cap.mode === 'per_round') {
    const total = shares.reduce((a, s) => a + s.final, 0);
    if (total > cap.amountCents) {
      if (!Number.isSafeInteger(total) || shares.some((s) => !Number.isSafeInteger(s.final * cap.amountCents))) {
        return { ok: false, errors: [scoreError('AMOUNT_OVERFLOW', 'This hand is too large to apply the round cap exactly.')] };
      }
      const allocation = allocateProportionally(
        cap.amountCents,
        shares.map((s) => s.final),
      );
      shares.forEach((share, i) => {
        const capped = allocation[i]!;
        if (capped !== share.final) {
          share.components.push({ label: `Round cap (max ${formatCents(cap.amountCents)} per hand)`, amountCents: capped - share.final });
          share.final = capped;
        }
      });
      notes.push(`Hand total ${formatCents(total)} capped at ${formatCents(cap.amountCents)}, shared in proportion.`);
    }
  }

  // 5. Liability (包): one player pays every share on a self-draw.
  const transfers: TransferDraft[] = [];
  const liable = outcome.method === 'self_draw' ? outcome.liablePlayerId : undefined;
  if (liable) {
    const components: PaymentComponent[] = shares.map((s) => ({
      label: s.payerId === liable ? `Own share` : `Covers ${nameOf(s.payerId)}'s share`,
      amountCents: s.final,
    }));
    const amount = shares.reduce((a, s) => a + s.final, 0);
    notes.push(`${nameOf(liable)} is liable (包) and pays for all opponents.`);
    if (amount > 0) {
      transfers.push({
        payerId: liable,
        receiverId: winnerId,
        amountCents: amount,
        kind: 'hand',
        description: `Liable (包) for ${nameOf(winnerId)}'s self-draw`,
        components,
      });
    }
  } else {
    for (const share of shares) {
      if (share.final <= 0) {
        notes.push(`${nameOf(share.payerId)} owes nothing for this hand under the configured table.`);
        continue;
      }
      transfers.push({
        payerId: share.payerId,
        receiverId: winnerId,
        amountCents: share.final,
        kind: 'hand',
        description:
          outcome.method === 'self_draw'
            ? `Self-draw by ${nameOf(winnerId)}`
            : share.payerId === outcome.discarderId
              ? `Discarded to ${nameOf(winnerId)}`
              : `Shared payment to ${nameOf(winnerId)}`,
        components: share.components,
      });
    }
  }

  return { ok: true, value: { transfers, notes, effectiveTai } };
}

/** Assign stable, deterministic transaction ids (`<roundId>:<index>`). */
export function toTransactions(roundId: RoundId, transfers: readonly TransferDraft[]): LedgerTransaction[] {
  return transfers.map((t, i) => ({
    id: `${roundId}:${i}`,
    roundId,
    payerId: t.payerId,
    receiverId: t.receiverId,
    amountCents: t.amountCents,
    kind: t.kind,
    description: t.description,
    ...(t.components ? { components: t.components.map((c) => ({ ...c })) } : {}),
  }));
}
