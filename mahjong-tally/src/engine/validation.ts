import { TAI_LIMITS } from '../config/defaults';
import type {
  BonusKind,
  Player,
  RoundInput,
  ScoringConfiguration,
  ValidationIssue,
} from '../models/types';
import { SEATS, SPIRIT_ANIMAL_IDS } from '../models/types';
import { isCents } from '../utils/money';

const BONUS_KINDS: readonly BonusKind[] = [
  'extra_tai',
  'winner_bonus_per_payer',
  'payout_multiplier',
  'collect_from_each',
  'collect_from_one',
  'penalty_pay_each',
];

/** Bonus kinds that only make sense for a winning hand. */
export const WIN_ONLY_BONUS_KINDS: readonly BonusKind[] = [
  'extra_tai',
  'winner_bonus_per_payer',
  'payout_multiplier',
];

/** Bonus kinds that require choosing a player (collector / offender). */
export const PLAYER_BONUS_KINDS: readonly BonusKind[] = ['collect_from_each', 'collect_from_one', 'penalty_pay_each'];

/** Bonus kinds paid immediately during a hand (kongs, flowers, penalties), whoever wins. */
export const INSTANT_BONUS_KINDS: readonly BonusKind[] = PLAYER_BONUS_KINDS;

const MAX_SANE_CENTS = 100_000_00; // $100,000 — guards against typos like 600000
const MAX_MULTIPLIER_PERCENT = 10_000;

function err(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, severity: 'error', ...(path !== undefined ? { path } : {}) };
}
function warn(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, severity: 'warning', ...(path !== undefined ? { path } : {}) };
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

function checkMoney(
  issues: ValidationIssue[],
  value: unknown,
  path: string,
  label: string,
  opts: { allowZero: boolean },
): void {
  if (!isCents(value)) {
    issues.push(err('NOT_WHOLE_CENTS', `${label} must be a whole number of cents.`, path));
  } else if (value < 0) {
    issues.push(err('NEGATIVE_AMOUNT', `${label} cannot be negative.`, path));
  } else if (!opts.allowZero && value === 0) {
    issues.push(err('ZERO_AMOUNT', `${label} must be more than $0.00.`, path));
  } else if (value > MAX_SANE_CENTS) {
    issues.push(err('AMOUNT_TOO_LARGE', `${label} is unrealistically large — check for a typo.`, path));
  }
}

/**
 * Validate a scoring configuration. Returns actionable issues; any issue with
 * severity `error` means the configuration cannot be used for scoring.
 */
export function validateConfig(config: ScoringConfiguration): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!config || typeof config !== 'object') {
    return [err('CONFIG_MISSING', 'Scoring rules are missing.')];
  }
  if (config.schemaVersion !== 1) {
    issues.push(err('CONFIG_VERSION', 'Unsupported scoring-rules version.', 'schemaVersion'));
  }
  if (typeof config.name !== 'string' || config.name.trim() === '') {
    issues.push(warn('CONFIG_NAME', 'Give these house rules a name so you can recognise them later.', 'name'));
  }

  const { minTai, maxTai } = config;
  let taiRangeOk = true;
  if (!isInt(minTai) || minTai < TAI_LIMITS.min || minTai > TAI_LIMITS.max) {
    issues.push(err('MIN_TAI', `Minimum tai must be a whole number from ${TAI_LIMITS.min} to ${TAI_LIMITS.max}.`, 'minTai'));
    taiRangeOk = false;
  }
  if (!isInt(maxTai) || maxTai < TAI_LIMITS.min || maxTai > TAI_LIMITS.max) {
    issues.push(err('MAX_TAI', `Maximum tai must be a whole number from ${TAI_LIMITS.min} to ${TAI_LIMITS.max}.`, 'maxTai'));
    taiRangeOk = false;
  }
  if (taiRangeOk && minTai > maxTai) {
    issues.push(err('TAI_RANGE', 'Minimum tai cannot be greater than maximum tai.', 'maxTai'));
    taiRangeOk = false;
  }

  if (config.discardLiability !== 'discarder_only' && config.discardLiability !== 'shared') {
    issues.push(err('DISCARD_LIABILITY', 'Choose who pays on a discard win.', 'discardLiability'));
  }
  if (config.selfDrawPayers !== 'all_opponents' && config.selfDrawPayers !== 'all_opponents_or_liable') {
    issues.push(err('SELF_DRAW_PAYERS', 'Choose who pays on a self-draw.', 'selfDrawPayers'));
  }

  // Payout table
  if (!Array.isArray(config.payoutTable)) {
    issues.push(err('TABLE_MISSING', 'The payout table is missing.', 'payoutTable'));
  } else if (taiRangeOk) {
    const seen = new Set<number>();
    config.payoutTable.forEach((row, i) => {
      const p = `payoutTable.${i}`;
      if (!isInt(row.tai)) {
        issues.push(err('ROW_TAI', `Row ${i + 1} has an invalid tai value.`, `${p}.tai`));
        return;
      }
      if (seen.has(row.tai)) {
        issues.push(err('ROW_DUPLICATE', `There are two rows for ${row.tai} tai.`, `${p}.tai`));
      }
      seen.add(row.tai);
      if (row.tai < minTai || row.tai > maxTai) {
        issues.push(err('ROW_OUT_OF_RANGE', `Row for ${row.tai} tai is outside ${minTai}–${maxTai} tai.`, `${p}.tai`));
      }
      const t = `${row.tai} tai`;
      checkMoney(issues, row.discarderPays, `${p}.discarderPays`, `${t}: discarder payment`, { allowZero: true });
      checkMoney(issues, row.othersPay, `${p}.othersPay`, `${t}: others' payment`, { allowZero: true });
      checkMoney(issues, row.selfDrawEachPays, `${p}.selfDrawEachPays`, `${t}: self-draw payment`, { allowZero: true });
      if (isCents(row.selfDrawEachPays) && row.selfDrawEachPays === 0) {
        issues.push(warn('SELF_DRAW_ZERO', `A ${t} self-draw would pay nothing.`, `${p}.selfDrawEachPays`));
      }
      const discardTotal =
        config.discardLiability === 'shared'
          ? (isCents(row.discarderPays) ? row.discarderPays : 0) + (isCents(row.othersPay) ? row.othersPay : 0)
          : isCents(row.discarderPays)
            ? row.discarderPays
            : 0;
      if (discardTotal === 0) {
        issues.push(warn('DISCARD_ZERO', `A ${t} discard win would pay nothing.`, `${p}.discarderPays`));
      }
    });
    for (let tai = minTai; tai <= maxTai; tai += 1) {
      if (!seen.has(tai)) {
        issues.push(err('ROW_MISSING', `The payout table needs a row for ${tai} tai.`, 'payoutTable'));
      }
    }
    // Monotonic check (warning only: some houses deliberately flatten the top end).
    const sorted = [...config.payoutTable].filter((r) => isInt(r.tai)).sort((a, b) => a.tai - b.tai);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (
        cur.discarderPays < prev.discarderPays ||
        cur.othersPay < prev.othersPay ||
        cur.selfDrawEachPays < prev.selfDrawEachPays
      ) {
        issues.push(warn('TABLE_DECREASING', `${cur.tai} tai pays less than ${prev.tai} tai. Is that intended?`, 'payoutTable'));
        break;
      }
    }
  }

  // Cap
  const cap = config.payoutCap;
  if (!cap || !['none', 'per_payment', 'per_round'].includes(cap.mode)) {
    issues.push(err('CAP_MODE', 'Choose a payout cap option.', 'payoutCap.mode'));
  } else if (cap.mode !== 'none') {
    checkMoney(issues, cap.amountCents, 'payoutCap.amountCents', 'Payout cap', { allowZero: false });
  }

  // Rounding
  const rounding = config.rounding;
  if (!rounding || !['exact', 'nearest', 'up', 'down'].includes(rounding.mode)) {
    issues.push(err('ROUNDING_MODE', 'Choose a rounding rule.', 'rounding.mode'));
  } else if (rounding.mode !== 'exact') {
    if (!isInt(rounding.incrementCents) || rounding.incrementCents <= 0 || rounding.incrementCents > 10_000) {
      issues.push(err('ROUNDING_INCREMENT', 'Rounding increment must be between 1¢ and $100.00.', 'rounding.incrementCents'));
    }
  }

  // Dealer
  const d = config.dealer;
  if (!d) {
    issues.push(err('DEALER_MISSING', 'Dealer rules are missing.', 'dealer'));
  } else {
    if (!isInt(d.extraTaiWhenDealerWins) || d.extraTaiWhenDealerWins < 0 || d.extraTaiWhenDealerWins > TAI_LIMITS.max) {
      issues.push(err('DEALER_TAI', 'Dealer extra tai must be a whole number from 0 to 20.', 'dealer.extraTaiWhenDealerWins'));
    }
    checkMoney(issues, d.extraCentsPerPayerWhenDealerWins, 'dealer.extraCentsPerPayerWhenDealerWins', 'Dealer win bonus', { allowZero: true });
    checkMoney(issues, d.extraCentsWhenDealerPays, 'dealer.extraCentsWhenDealerPays', 'Dealer surcharge', { allowZero: true });
    if (
      d.enabled &&
      d.extraTaiWhenDealerWins === 0 &&
      d.extraCentsPerPayerWhenDealerWins === 0 &&
      d.extraCentsWhenDealerPays === 0
    ) {
      issues.push(warn('DEALER_NO_EFFECT', 'Dealer bonus is on but every dealer value is zero, so it has no effect.', 'dealer'));
    }
  }

  // Dealer rotation (optional: rules saved before it existed use the default)
  if (config.rotation !== undefined) {
    const r = config.rotation;
    if (!r || typeof r.dealerKeepsOnWin !== 'boolean' || !['keeps', 'keeps_unless_kong', 'passes'].includes(r.onDraw)) {
      issues.push(err('ROTATION', 'Choose when the dealer keeps the deal.', 'rotation'));
    }
  }

  // Bonus rules
  if (!Array.isArray(config.bonusRules)) {
    issues.push(err('BONUS_MISSING', 'Adjustment rules are missing.', 'bonusRules'));
  } else {
    const ids = new Set<string>();
    config.bonusRules.forEach((rule, i) => {
      const p = `bonusRules.${i}`;
      if (typeof rule.id !== 'string' || rule.id === '' || ids.has(rule.id)) {
        issues.push(err('BONUS_ID', `Adjustment ${i + 1} has a missing or duplicate id.`, `${p}.id`));
      }
      ids.add(rule.id);
      if (typeof rule.name !== 'string' || rule.name.trim() === '') {
        issues.push(err('BONUS_NAME', `Adjustment ${i + 1} needs a name.`, `${p}.name`));
      }
      if (!BONUS_KINDS.includes(rule.kind)) {
        issues.push(err('BONUS_KIND', `“${rule.name}” has an unknown type.`, `${p}.kind`));
        return;
      }
      if (!isInt(rule.value)) {
        issues.push(err('BONUS_VALUE', `“${rule.name}” needs a whole-number value.`, `${p}.value`));
        return;
      }
      if (rule.enabled) {
        if (rule.value <= 0) {
          issues.push(err('BONUS_VALUE', `“${rule.name}” is enabled but its value is not positive.`, `${p}.value`));
        } else if (rule.kind === 'payout_multiplier' && rule.value > MAX_MULTIPLIER_PERCENT) {
          issues.push(err('BONUS_VALUE', `“${rule.name}” multiplier is too large.`, `${p}.value`));
        } else if (rule.kind === 'extra_tai' && rule.value > TAI_LIMITS.max) {
          issues.push(err('BONUS_VALUE', `“${rule.name}” adds too many tai.`, `${p}.value`));
        } else if (rule.kind !== 'extra_tai' && rule.kind !== 'payout_multiplier' && rule.value > MAX_SANE_CENTS) {
          issues.push(err('BONUS_VALUE', `“${rule.name}” amount is unrealistically large.`, `${p}.value`));
        }
        if (rule.kind === 'payout_multiplier' && rule.value % 100 !== 0 && config.rounding?.mode === 'exact') {
          issues.push(
            warn(
              'MULTIPLIER_FRACTIONAL',
              `“${rule.name}” can produce fractions of a cent. With “Exact” rounding such rounds will be rejected — choose a rounding rule.`,
              `${p}.value`,
            ),
          );
        }
      }
    });
  }

  return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/** Validate a set of four players: unique ids, non-empty unique names, one per seat. */
export function validatePlayers(players: readonly Player[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (players.length !== 4) {
    issues.push(err('PLAYER_COUNT', 'A game needs exactly four players.'));
    return issues;
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const seats = new Set<string>();
  const animals = new Set<string>();
  players.forEach((p, i) => {
    if (!p.id || ids.has(p.id)) issues.push(err('PLAYER_ID', `Player ${i + 1} has a missing or duplicate id.`, `players.${i}.id`));
    ids.add(p.id);
    const name = p.name.trim();
    if (name === '') issues.push(err('PLAYER_NAME', `Player ${i + 1} needs a name.`, `players.${i}.name`));
    else if (names.has(name.toLowerCase()))
      issues.push(err('PLAYER_NAME_DUP', `Two players are called “${name}”. Names must be unique.`, `players.${i}.name`));
    names.add(name.toLowerCase());
    if (!SEATS.includes(p.seat)) issues.push(err('PLAYER_SEAT', `Player ${i + 1} has an invalid seat.`, `players.${i}.seat`));
    else if (seats.has(p.seat)) issues.push(err('PLAYER_SEAT_DUP', `Two players are seated ${p.seat}.`, `players.${i}.seat`));
    seats.add(p.seat);
    if (p.animal !== undefined) {
      if (!SPIRIT_ANIMAL_IDS.includes(p.animal)) issues.push(err('PLAYER_ANIMAL', `${name || `Player ${i + 1}`} has an unknown spirit animal.`, `players.${i}.animal`));
      else if (animals.has(p.animal)) issues.push(err('PLAYER_ANIMAL_DUP', `Two players have the ${p.animal} as their spirit animal.`, `players.${i}.animal`));
      animals.add(p.animal);
    }
  });
  return issues;
}

/** Validate what the user entered for a round against the players and rules. */
export function validateRoundInput(
  input: RoundInput,
  players: readonly Player[],
  config: ScoringConfiguration,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set(players.map((p) => p.id));
  const known = (id: string | undefined): id is string => typeof id === 'string' && ids.has(id);
  const o = input.outcome;

  if (input.dealerId !== undefined && !known(input.dealerId)) {
    issues.push(err('DEALER_UNKNOWN', 'The selected dealer is not in this game.', 'dealerId'));
  }
  if (input.prevailingWind !== undefined && !SEATS.includes(input.prevailingWind)) {
    issues.push(err('WIND_INVALID', 'The round wind is not valid.', 'prevailingWind'));
  }

  if (o.type === 'win') {
    if (!known(o.winnerId)) issues.push(err('WINNER_REQUIRED', 'Select the winner.', 'winnerId'));
    if (o.method !== 'self_draw' && o.method !== 'discard') {
      issues.push(err('METHOD_REQUIRED', 'Choose Self Draw or Discard Win.', 'method'));
    }
    if (o.method === 'discard') {
      if (!known(o.discarderId)) issues.push(err('DISCARDER_REQUIRED', 'Select who discarded the winning tile.', 'discarderId'));
      else if (o.discarderId === o.winnerId)
        issues.push(err('DISCARDER_IS_WINNER', 'The winner cannot also be the discarder.', 'discarderId'));
      if (o.liablePlayerId !== undefined)
        issues.push(err('LIABLE_ON_DISCARD', 'A liable player only applies to self-draws.', 'liablePlayerId'));
    }
    if (o.method === 'self_draw' && o.liablePlayerId !== undefined) {
      if (config.selfDrawPayers !== 'all_opponents_or_liable') {
        issues.push(err('LIABLE_NOT_ALLOWED', 'Your house rules do not allow a liable (包) player.', 'liablePlayerId'));
      } else if (!known(o.liablePlayerId)) {
        issues.push(err('LIABLE_UNKNOWN', 'The liable player is not in this game.', 'liablePlayerId'));
      } else if (o.liablePlayerId === o.winnerId) {
        issues.push(err('LIABLE_IS_WINNER', 'The winner cannot be the liable player.', 'liablePlayerId'));
      }
    }
    if (!isInt(o.tai)) {
      issues.push(err('TAI_REQUIRED', 'Select the tai for this hand.', 'tai'));
    } else if (o.tai < config.minTai || o.tai > config.maxTai) {
      issues.push(err('TAI_OUT_OF_RANGE', `Tai must be between ${config.minTai} and ${config.maxTai}.`, 'tai'));
    }
  } else if (o.type !== 'draw') {
    issues.push(err('OUTCOME_REQUIRED', 'Choose whether someone won or the round was drawn.', 'outcome'));
  }

  const rules = new Map((config.bonusRules ?? []).map((r) => [r.id, r]));
  const seenRules = new Set<string>();
  input.bonuses.forEach((b, i) => {
    const p = `bonuses.${i}`;
    const rule = rules.get(b.ruleId);
    if (!rule) {
      issues.push(err('BONUS_UNKNOWN', 'An adjustment refers to a rule that no longer exists.', p));
      return;
    }
    if (!rule.enabled) {
      issues.push(err('BONUS_DISABLED', `“${rule.name}” is turned off in the house rules.`, p));
      return;
    }
    const playerScoped = PLAYER_BONUS_KINDS.includes(rule.kind);
    const key = playerScoped ? `${b.ruleId}:${b.playerId ?? ''}:${b.fromPlayerId ?? ''}` : b.ruleId;
    if (seenRules.has(key)) {
      issues.push(err('BONUS_DUPLICATE', `“${rule.name}” was added twice. Use the count instead.`, p));
    }
    seenRules.add(key);
    if (o.type === 'draw' && WIN_ONLY_BONUS_KINDS.includes(rule.kind)) {
      issues.push(err('BONUS_WIN_ONLY', `“${rule.name}” only applies to a winning hand.`, p));
    }
    if (rule.kind !== 'payout_multiplier' && (!isInt(b.count) || b.count < 1 || b.count > 99)) {
      issues.push(err('BONUS_COUNT', `“${rule.name}” count must be a whole number from 1 to 99.`, `${p}.count`));
    }
    if (playerScoped && !known(b.playerId)) {
      issues.push(err('BONUS_PLAYER', `Choose which player “${rule.name}” applies to.`, `${p}.playerId`));
    }
    if (rule.kind === 'collect_from_one') {
      if (!known(b.fromPlayerId)) {
        issues.push(err('BONUS_FROM_PLAYER', `Choose who pays for “${rule.name}”.`, `${p}.fromPlayerId`));
      } else if (b.fromPlayerId === b.playerId) {
        issues.push(err('BONUS_SELF', `“${rule.name}”: a player cannot pay themselves.`, `${p}.fromPlayerId`));
      }
    } else if (b.fromPlayerId !== undefined) {
      issues.push(err('BONUS_FROM_UNEXPECTED', `“${rule.name}” is paid by everyone, not one player.`, `${p}.fromPlayerId`));
    }
  });

  input.manualAdjustments.forEach((m, i) => {
    const p = `manualAdjustments.${i}`;
    if (!known(m.payerId)) issues.push(err('MANUAL_PAYER', 'Choose who pays the manual adjustment.', `${p}.payerId`));
    if (!known(m.receiverId)) issues.push(err('MANUAL_RECEIVER', 'Choose who receives the manual adjustment.', `${p}.receiverId`));
    if (m.payerId === m.receiverId) issues.push(err('MANUAL_SELF', 'A player cannot pay themselves.', p));
    if (!isCents(m.amountCents) || m.amountCents <= 0)
      issues.push(err('MANUAL_AMOUNT', 'Manual adjustment amount must be more than $0.00.', `${p}.amountCents`));
    else if (m.amountCents > MAX_SANE_CENTS)
      issues.push(err('MANUAL_AMOUNT', 'Manual adjustment amount is unrealistically large.', `${p}.amountCents`));
  });

  return issues;
}
