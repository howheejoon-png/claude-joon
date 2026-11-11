/**
 * Core domain types for Mahjong Tally.
 *
 * Money is ALWAYS an integer number of cents (`Cents`). No value of this type
 * may ever hold a fractional amount; every engine function validates this.
 */

/** Integer number of cents. */
export type Cents = number;

export type PlayerId = string;
export type RoundId = string;
export type GameId = string;
export type TransactionId = string;

export type Seat = 'east' | 'south' | 'west' | 'north';
export const SEATS: readonly Seat[] = ['east', 'south', 'west', 'north'] as const;

/** Spirit animals assigned to players at the start of a game (one each). */
export type SpiritAnimal = 'mouse' | 'cat' | 'chicken' | 'centipede';
export const SPIRIT_ANIMAL_IDS: readonly SpiritAnimal[] = ['mouse', 'cat', 'chicken', 'centipede'] as const;

export interface Player {
  id: PlayerId;
  name: string;
  /** Where the player sits (the wind of that seat when the first dealer is East). */
  seat: Seat;
  /** Optional spirit animal: drawing it yourself is paid by everyone. */
  animal?: SpiritAnimal;
}

// ---------------------------------------------------------------------------
// Scoring configuration (house rules)
// ---------------------------------------------------------------------------

/** One row of the payout table: what is paid for a hand worth `tai`. */
export interface PayoutRow {
  tai: number;
  /** Discard win: amount the discarding player (放炮) pays. */
  discarderPays: Cents;
  /** Discard win in `shared` mode: amount EACH non-discarding opponent pays. */
  othersPay: Cents;
  /** Self-draw (自摸): amount EACH of the three opponents pays. */
  selfDrawEachPays: Cents;
}

/**
 * Who pays when a player wins off a discard.
 * - `discarder_only`: only the discarder pays (`discarderPays`).
 * - `shared`: the discarder pays `discarderPays` and the two other
 *   opponents each pay `othersPay`.
 */
export type DiscardLiability = 'discarder_only' | 'shared';

/**
 * Self-draw payers.
 * - `all_opponents`: all three opponents pay `selfDrawEachPays`.
 * - `all_opponents_or_liable`: same, but a liable player (包) may be chosen
 *   for a round; that player then pays every opponent's share alone.
 */
export type SelfDrawPayers = 'all_opponents' | 'all_opponents_or_liable';

export type PayoutCapMode = 'none' | 'per_payment' | 'per_round';

export interface PayoutCap {
  mode: PayoutCapMode;
  /** Cap in cents; ignored when mode is `none`. */
  amountCents: Cents;
}

/**
 * Rounding applied to each hand payment.
 * - `exact`: amounts must already be whole cents; otherwise scoring fails
 *   with an actionable error (nothing is rounded silently).
 * - `nearest` (half-up), `up`, `down`: round each payment to a multiple of
 *   `incrementCents`.
 */
export type RoundingMode = 'exact' | 'nearest' | 'up' | 'down';

export interface RoundingRule {
  mode: RoundingMode;
  incrementCents: number;
}

export interface DealerRule {
  enabled: boolean;
  /** Extra tai added to the hand when the dealer is the winner. */
  extraTaiWhenDealerWins: number;
  /** Extra cents each paying player pays when the dealer is the winner. */
  extraCentsPerPayerWhenDealerWins: Cents;
  /** Extra cents the dealer pays when the dealer is one of the paying players. */
  extraCentsWhenDealerPays: Cents;
}

/**
 * Kinds of configurable adjustment rules.
 * - `extra_tai`: adds `value` tai per count to the winning hand (win only).
 * - `winner_bonus_per_payer`: each paying player pays an extra `value` cents
 *   per count to the winner (win only).
 * - `payout_multiplier`: hand payments are multiplied by `value` percent,
 *   e.g. 200 = double (win only, not countable).
 * - `collect_from_each`: a chosen player collects `value` cents per count
 *   from each other player (e.g. a self-drawn kong or animal pair). Any round.
 * - `collect_from_one`: a chosen player collects `value` cents per count
 *   from ONE other chosen player (e.g. a kong made from someone's discard —
 *   the discarder pays; or a flower bite — the flowers' owner pays). Any round.
 * - `penalty_pay_each`: a chosen player pays `value` cents per count to each
 *   other player (e.g. false win). Any round.
 */
export type BonusKind =
  | 'extra_tai'
  | 'winner_bonus_per_payer'
  | 'payout_multiplier'
  | 'collect_from_each'
  | 'collect_from_one'
  | 'penalty_pay_each';

export interface BonusRule {
  id: string;
  name: string;
  kind: BonusKind;
  /** Tai, cents, or percent depending on `kind`. Always an integer. */
  value: number;
  enabled: boolean;
  /** Marked as a sample so the UI can label it as non-authoritative. */
  isExample?: boolean;
  /** A kong payout: a drawn hand with a kong passes the deal (see RotationRule). */
  countsAsKong?: boolean;
}

/**
 * When the deal moves on. Informational only: it drives the dealer / wind
 * tracker and never changes any payment.
 */
export interface RotationRule {
  /** The dealer keeps the deal after winning. */
  dealerKeepsOnWin: boolean;
  /** After a drawn hand: keep the deal, keep it unless a kong was made, or pass it. */
  onDraw: 'keeps' | 'keeps_unless_kong' | 'passes';
}

export interface ScoringConfiguration {
  schemaVersion: 1;
  name: string;
  /** Display label for the stake, e.g. "$0.30 / $0.60". Informational only. */
  stakeLabel: string;
  /** Base unit used by the table generator. Informational for scoring. */
  baseUnitCents: Cents;
  minTai: number;
  maxTai: number;
  payoutTable: PayoutRow[];
  discardLiability: DiscardLiability;
  selfDrawPayers: SelfDrawPayers;
  payoutCap: PayoutCap;
  rounding: RoundingRule;
  dealer: DealerRule;
  bonusRules: BonusRule[];
  /** Dealer rotation (optional for rules saved before it existed). */
  rotation?: RotationRule;
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

export type WinningMethod = 'self_draw' | 'discard';

/** A configured bonus rule applied to a round. */
export interface AppliedBonus {
  ruleId: string;
  /** How many times the rule applies (ignored for multipliers). */
  count: number;
  /** Player who collects (collect_from_each / collect_from_one) or pays (penalty_pay_each). */
  playerId?: PlayerId;
  /** For collect_from_one: the single player who pays `playerId`. */
  fromPlayerId?: PlayerId;
}

/** A one-off manual transfer, e.g. a custom penalty agreed at the table. */
export interface ManualAdjustment {
  id: string;
  payerId: PlayerId;
  receiverId: PlayerId;
  amountCents: Cents;
  note: string;
}

export interface WinOutcome {
  type: 'win';
  winnerId: PlayerId;
  method: WinningMethod;
  /** Required when method is `discard`. */
  discarderId?: PlayerId;
  /** Optional 包 liable player for self-draws when allowed by the rules. */
  liablePlayerId?: PlayerId;
  tai: number;
}

export interface DrawOutcome {
  type: 'draw';
}

export type RoundOutcome = WinOutcome | DrawOutcome;

/** Everything the user entered for a round. Scoring is a pure function of this + config. */
export interface RoundInput {
  outcome: RoundOutcome;
  dealerId?: PlayerId;
  /** Round (prevailing) wind of this hand. Informational; scoring ignores it. */
  prevailingWind?: Seat;
  bonuses: AppliedBonus[];
  manualAdjustments: ManualAdjustment[];
}

export type TransactionKind = 'hand' | 'bonus' | 'penalty' | 'manual';

/** A component line explaining how a hand payment was built. */
export interface PaymentComponent {
  label: string;
  /** Signed cents contributed by this component (may be negative for caps/rounding). */
  amountCents: Cents;
}

/**
 * A single transfer of money between two players. Every transfer creates a
 * matching debit (payer, −amount) and credit (receiver, +amount) posting.
 */
export interface LedgerTransaction {
  id: TransactionId;
  roundId: RoundId;
  payerId: PlayerId;
  receiverId: PlayerId;
  amountCents: Cents;
  kind: TransactionKind;
  description: string;
  components?: PaymentComponent[];
}

/** A double-entry posting derived from a transaction. */
export interface LedgerPosting {
  transactionId: TransactionId;
  roundId: RoundId;
  playerId: PlayerId;
  /** Signed cents: negative = debit (paid), positive = credit (received). */
  deltaCents: Cents;
}

export interface Round {
  id: RoundId;
  /** Monotonic creation sequence within the game (never reused). */
  seq: number;
  createdAt: string;
  updatedAt: string;
  input: RoundInput;
  /** Snapshot of the rules used to score this round (keeps history auditable). */
  configSnapshot: ScoringConfiguration;
  /** Players (ids, names, seats) as they were when this round was scored. */
  playersSnapshot: Player[];
  /** Transactions computed and confirmed for this round. */
  transactions: LedgerTransaction[];
  /** Effective tai after bonuses and the max-tai cap (win rounds only). */
  effectiveTai?: number;
  notes: string[];
  /** Set when the round is (soft) deleted; deleted rounds are excluded from the ledger. */
  deletedAt?: string;
  /** Edit trail for auditability. */
  revisions: RoundRevision[];
}

export interface RoundRevision {
  at: string;
  action: 'created' | 'edited' | 'deleted' | 'restored' | 'rescored';
  /** Net per player for the round before this change (cents). */
  previousNet?: Record<PlayerId, Cents>;
  /** Who made the change (player name), when known — shown in History. */
  by?: string;
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export type GameStatus = 'active' | 'finished';

export interface GameSession {
  schemaVersion: 1;
  id: GameId;
  name: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  status: GameStatus;
  /** Exactly four players, in seat order East, South, West, North. */
  players: Player[];
  /** Optional initial dealer. */
  initialDealerId?: PlayerId;
  /**
   * Manual "the next hand is…" setting (e.g. started the app mid-game). Applies
   * only while no round with seq >= setAtSeq exists.
   */
  nextHand?: { dealerId: PlayerId; prevailingWind: Seat; setAtSeq: number };
  /** Rules used for NEW rounds. Existing rounds keep their own snapshot. */
  config: ScoringConfiguration;
  /** All rounds, including soft-deleted ones (see Round.deletedAt). */
  rounds: Round[];
  nextSeq: number;
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export interface Balance {
  playerId: PlayerId;
  netCents: Cents;
  /** Total received (credits) in cents. */
  receivedCents: Cents;
  /** Total paid (debits) in cents, as a positive number. */
  paidCents: Cents;
  wins: number;
  losses: number;
}

export interface SettlementTransfer {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  amountCents: Cents;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  /** Dotted path for config issues, e.g. `payoutTable.2.discarderPays`. */
  path?: string;
  transactionId?: TransactionId;
  roundId?: RoundId;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationIssue[] };
