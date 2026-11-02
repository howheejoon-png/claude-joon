import type { BonusRule, Cents, PayoutRow, ScoringConfiguration, Seat } from '../models/types';
import { formatCents, roundRational } from '../utils/money';

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
 * Kong, flower and animal payouts settled during a hand, whoever ends up
 * winning (also in drawn rounds). They only move money when a player records
 * the event in a round.
 *
 * Amounts scale with the base unit so they stay in proportion to the stake;
 * at a $3 / $6 game they are $6 for a kong from a discard and $2 for
 * everything else. Groups can edit every amount.
 */
export function instantPayoutTemplates(baseUnitCents: Cents): BonusRule[] {
  const u = baseUnitCents;
  // Two thirds of the base unit, rounded to the nearest cent ($3 base -> $2).
  const small = roundRational(2 * u, 3, 'nearest', 1).cents ?? u;
  const t = (id: string, name: string, kind: BonusRule['kind'], value: number): BonusRule => ({
    id,
    name,
    kind,
    value,
    enabled: true,
    isExample: true,
  });
  return [
    t('sg-kong-discard', 'Kong from a discard (明杠)', 'collect_from_one', u * 2),
    t('sg-kong-self', 'Self-drawn kong (自摸杠)', 'collect_from_each', small),
    t('sg-flower-own', 'Own flower', 'collect_from_each', small),
    t('sg-flower-other', 'Someone else’s flower', 'collect_from_one', small),
    t('sg-animal-own', 'Own spirit animal', 'collect_from_each', small),
    t('sg-animal-cat-mouse', 'Cat & mouse pair (貓鼠)', 'collect_from_each', small),
    t('sg-animal-chicken-centipede', 'Chicken & centipede pair (雞蜈蚣)', 'collect_from_each', small),
  ];
}

/**
 * Wording for the Record screen's player pickers, by template id. Rules the
 * group adds themselves fall back to generic wording.
 */
export const INSTANT_RULE_PROMPTS: Record<string, { collector: string; payer?: string; payerShort?: string }> = {
  'sg-kong-discard': { collector: 'Who made the kong?', payer: 'Who discarded the tile?', payerShort: 'from the discarder' },
  'sg-kong-self': { collector: 'Who made the kong?' },
  'sg-flower-own': { collector: 'Who drew their own flower?' },
  'sg-flower-other': { collector: 'Who drew the flower?', payer: 'Whose flower is it?', payerShort: 'from the flower’s owner' },
  'sg-animal-own': { collector: 'Who drew their own animal?' },
  'sg-animal-cat-mouse': { collector: 'Who has the cat and the mouse?' },
  'sg-animal-chicken-centipede': { collector: 'Who has the chicken and the centipede?' },
};

/** Ids of earlier template versions, replaced by the current set. */
const LEGACY_INSTANT_IDS = [
  'example-flower-animal',
  'example-kong',
  'sg-kong-pong',
  'sg-kong-concealed',
  'sg-flower-bite',
  'sg-flower-set',
  'sg-animal',
  'sg-animal-pair',
];

/** Whether a rules list has the current kong/flower/animal set. */
export function instantTemplateStatus(bonusRules: readonly BonusRule[]): 'current' | 'missing' | 'outdated' {
  const ids = new Set(bonusRules.map((r) => r.id));
  const current = instantPayoutTemplates(0).map((r) => r.id);
  const hasLegacy = LEGACY_INSTANT_IDS.some((id) => ids.has(id));
  if (current.every((id) => ids.has(id)) && !hasLegacy) return 'current';
  if (!hasLegacy && current.every((id) => !ids.has(id))) return 'missing';
  return 'outdated';
}

/**
 * Install the current kong/flower/animal set: removes older template
 * versions and any previous copies of the current ones, then appends fresh
 * templates priced from the base unit. The group's other rules are kept.
 */
export function applyInstantPayoutTemplates(
  bonusRules: readonly BonusRule[],
  baseUnitCents: Cents,
): { rules: BonusRule[]; removed: BonusRule[]; added: BonusRule[] } {
  const fresh = instantPayoutTemplates(baseUnitCents);
  const replaceIds = new Set([...LEGACY_INSTANT_IDS, ...fresh.map((r) => r.id)]);
  const removed = bonusRules.filter((r) => replaceIds.has(r.id));
  const kept = bonusRules.filter((r) => !replaceIds.has(r.id));
  return { rules: [...kept, ...fresh], removed, added: fresh };
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
