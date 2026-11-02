import type { BonusRule, Cents, PayoutRow, ScoringConfiguration, Seat } from '../models/types';
import { formatCents } from '../utils/money';

export const SEAT_LABEL: Record<Seat, string> = {
  east: 'East',
  south: 'South',
  west: 'West',
  north: 'North',
};

/** Traditional wind characters, used as a decorative seat marker. */
export const SEAT_GLYPH: Record<Seat, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
};

export const DEFAULT_PLAYER_NAMES = ['Player A', 'Player B', 'Player C', 'Player D'] as const;

/** Absolute bounds the editor allows; house rules choose within these. */
export const TAI_LIMITS = { min: 0, max: 20 } as const;

export type TableProgression = 'doubling' | 'linear';

export interface TableGeneratorOptions {
  baseUnitCents: Cents;
  minTai: number;
  maxTai: number;
  progression: TableProgression;
  /** Units paid by the discarder at the lowest tai. */
  discarderUnits: number;
  /** Units paid by each other opponent on a discard win (shared mode). */
  othersUnits: number;
  /** Units paid by each opponent on a self-draw. */
  selfDrawUnits: number;
}

/**
 * Build a payout table from a base unit. Pure helper used by the editor to
 * pre-fill values; every row stays individually editable afterwards.
 * All results are integers because the base and units are integers.
 */
export function generatePayoutTable(opts: TableGeneratorOptions): PayoutRow[] {
  const rows: PayoutRow[] = [];
  for (let tai = opts.minTai; tai <= opts.maxTai; tai += 1) {
    const step = tai - opts.minTai;
    const factor = opts.progression === 'doubling' ? 2 ** step : step + 1;
    const unit = opts.baseUnitCents * factor;
    rows.push({
      tai,
      discarderPays: unit * opts.discarderUnits,
      othersPay: unit * opts.othersUnits,
      selfDrawEachPays: unit * opts.selfDrawUnits,
    });
  }
  return rows;
}

export function stakeLabelFor(baseUnitCents: Cents): string {
  return `${formatCents(baseUnitCents)} / ${formatCents(baseUnitCents * 2)}`;
}

/**
 * Common Singapore "instant payouts" settled during a hand — kongs, flower
 * bites, animals — whoever ends up winning (also in drawn rounds).
 * Amounts are EXAMPLES in multiples of the base unit and are labelled as
 * such in the UI; every group should check them against its own rules.
 * They only move money when a player records the event in a round.
 */
export function instantPayoutTemplates(baseUnitCents: Cents): BonusRule[] {
  const u = baseUnitCents;
  const t = (id: string, name: string, kind: BonusRule['kind'], value: number): BonusRule => ({
    id,
    name,
    kind,
    value,
    enabled: true,
    isExample: true,
  });
  return [
    t('sg-kong-discard', 'Kong from a discard (明杠)', 'collect_from_one', u),
    t('sg-kong-pong', 'Kong added to own pong (加杠)', 'collect_from_each', u),
    t('sg-kong-concealed', 'Concealed kong (暗杠)', 'collect_from_each', u * 2),
    t('sg-flower-bite', 'Flower bite — both of a player’s flowers (咬花)', 'collect_from_one', u),
    t('sg-flower-set', 'Complete flower set (4 of a kind)', 'collect_from_each', u * 2),
    t('sg-animal', 'Animal drawn (動物)', 'collect_from_each', u),
    t('sg-animal-pair', 'Animal pair (cat & mouse / rooster & centipede)', 'collect_from_each', u),
  ];
}

/**
 * EXAMPLE adjustment rules: the instant-payout templates above, plus two
 * switched-off examples (a special-hand tai bonus and a false-win penalty).
 */
export function exampleBonusRules(baseUnitCents: Cents = 30): BonusRule[] {
  return [
    ...instantPayoutTemplates(baseUnitCents),
    {
      id: 'example-special-hand',
      name: 'Special hand bonus',
      kind: 'extra_tai',
      value: 1,
      enabled: false,
      isExample: true,
    },
    {
      id: 'example-false-win',
      name: 'False win penalty',
      kind: 'penalty_pay_each',
      value: 100,
      enabled: false,
      isExample: true,
    },
  ];
}

/** Append any instant-payout templates the rules don't already have (matched by id). */
export function withInstantPayoutTemplates(bonusRules: readonly BonusRule[], baseUnitCents: Cents): { rules: BonusRule[]; added: number } {
  const existing = new Set(bonusRules.map((r) => r.id));
  const missing = instantPayoutTemplates(baseUnitCents).filter((r) => !existing.has(r.id));
  return { rules: [...bonusRules, ...missing], added: missing.length };
}

export const EXAMPLE_TABLE_OPTIONS: TableGeneratorOptions = {
  baseUnitCents: 30,
  minTai: 1,
  maxTai: 5,
  progression: 'doubling',
  discarderUnits: 2,
  othersUnits: 1,
  selfDrawUnits: 2,
};

/**
 * EXAMPLE configuration for a "$0.30 / $0.60" game: a doubling table where the
 * discarder pays double, the other two pay single, and every opponent pays
 * double on a self-draw. This is a common pattern, NOT an authoritative
 * Singapore Mahjong rule — groups must confirm or edit it before playing.
 */
export function exampleConfiguration(): ScoringConfiguration {
  return {
    schemaVersion: 1,
    name: 'Example — $0.30 / $0.60 doubling',
    stakeLabel: stakeLabelFor(EXAMPLE_TABLE_OPTIONS.baseUnitCents),
    baseUnitCents: EXAMPLE_TABLE_OPTIONS.baseUnitCents,
    minTai: EXAMPLE_TABLE_OPTIONS.minTai,
    maxTai: EXAMPLE_TABLE_OPTIONS.maxTai,
    payoutTable: generatePayoutTable(EXAMPLE_TABLE_OPTIONS),
    discardLiability: 'shared',
    selfDrawPayers: 'all_opponents',
    payoutCap: { mode: 'none', amountCents: 0 },
    rounding: { mode: 'exact', incrementCents: 1 },
    dealer: {
      enabled: false,
      extraTaiWhenDealerWins: 0,
      extraCentsPerPayerWhenDealerWins: 0,
      extraCentsWhenDealerPays: 0,
    },
    bonusRules: exampleBonusRules(EXAMPLE_TABLE_OPTIONS.baseUnitCents),
  };
}

/** Deep clone via structured JSON (configs are plain data). */
export function cloneConfig(config: ScoringConfiguration): ScoringConfiguration {
  return JSON.parse(JSON.stringify(config)) as ScoringConfiguration;
}

/** Ensure the table has exactly one row for each tai in [minTai, maxTai], keeping existing values. */
export function resizePayoutTable(
  table: readonly PayoutRow[],
  minTai: number,
  maxTai: number,
): PayoutRow[] {
  const byTai = new Map(table.map((r) => [r.tai, r]));
  const rows: PayoutRow[] = [];
  let last: PayoutRow | undefined;
  for (let tai = minTai; tai <= maxTai; tai += 1) {
    const existing = byTai.get(tai);
    if (existing) {
      rows.push({ ...existing });
      last = existing;
    } else {
      // New rows start by doubling the previous row so the user has a starting point to edit.
      rows.push(
        last
          ? {
              tai,
              discarderPays: last.discarderPays * 2,
              othersPay: last.othersPay * 2,
              selfDrawEachPays: last.selfDrawEachPays * 2,
            }
          : { tai, discarderPays: 0, othersPay: 0, selfDrawEachPays: 0 },
      );
      last = rows[rows.length - 1];
    }
  }
  return rows;
}
