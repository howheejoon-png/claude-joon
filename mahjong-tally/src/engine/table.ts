/**
 * Table tracker: who deals, the round (prevailing) wind, each player's wind
 * for the hand, and therefore their own flowers. Pure and deterministic — it
 * replays the recorded hands, so editing or deleting a hand re-derives
 * everything after it. Nothing here affects money.
 *
 * Rules (house-configurable via ScoringConfiguration.rotation):
 * - The dealer is East for the hand; the following seats are South, West, North.
 * - A player's own flowers follow their wind: East 1, South 2, West 3, North 4.
 * - The dealer keeps the deal after winning; after a drawn hand they keep it
 *   unless a kong was made. Otherwise the deal passes to the next seat.
 * - When the deal comes back to the first dealer, the round wind moves on
 *   (East → South → West → North).
 */
import { DEFAULT_ROTATION, FLOWERS } from '../config/defaults';
import type { BonusRule, GameSession, Player, PlayerId, Round, RoundId, RotationRule, Seat } from '../models/types';
import { SEATS } from '../models/types';

export interface HandSetup {
  dealerId?: PlayerId;
  prevailingWind: Seat;
}

export interface TableState extends HandSetup {
  /** Number of the next hand (1-based). */
  handNumber: number;
  /** How many hands in a row the dealer has already dealt before this one. */
  dealerStreak: number;
  /** Each player's wind for the next hand. */
  winds: Record<PlayerId, Seat>;
  /** Each player's own flower number (1–4) for the next hand. */
  flowers: Record<PlayerId, number>;
  /** The round wind has gone past North at least once (a full game). */
  fullCircleDone: boolean;
  /** The player whose turn as dealer starts each new round wind. */
  firstDealerId?: PlayerId;
  /** Dealer and wind each recorded hand was played with. */
  hands: Record<RoundId, HandSetup & { streak: number }>;
}

export function rotationOf(game: GameSession): RotationRule {
  return game.config.rotation ?? DEFAULT_ROTATION;
}

/** An explicit `countsAsKong` wins; rules saved before it existed are recognised by their template id. */
export function isKongRule(rule: Pick<BonusRule, 'id' | 'countsAsKong'>): boolean {
  return rule.countsAsKong ?? rule.id.startsWith('sg-kong-');
}

/** Whether any kong payout was recorded in this hand (checked against the hand's own rules). */
export function handHadKong(round: Round): boolean {
  const rules = new Map(round.configSnapshot.bonusRules.map((r) => [r.id, r]));
  return round.input.bonuses.some((b) => {
    const rule = rules.get(b.ruleId);
    return b.count > 0 && (rule ? isKongRule(rule) : b.ruleId.startsWith('sg-kong-'));
  });
}

function bySeat(players: readonly Player[]): Player[] {
  return [...players].sort((a, b) => SEATS.indexOf(a.seat) - SEATS.indexOf(b.seat));
}

/** Each player's wind for a hand dealt by `dealerId` (their seat if there is no dealer). */
export function windsFor(players: readonly Player[], dealerId?: PlayerId): Record<PlayerId, Seat> {
  const ordered = bySeat(players);
  const d = dealerId ? ordered.findIndex((p) => p.id === dealerId) : -1;
  if (d < 0) return Object.fromEntries(players.map((p) => [p.id, p.seat]));
  return Object.fromEntries(ordered.map((p, i) => [p.id, SEATS[(i - d + SEATS.length) % SEATS.length]!]));
}

export function flowerNumber(wind: Seat): number {
  return FLOWERS[wind].number;
}

/** The player who deals after `dealerId`. */
export function nextSeatPlayer(players: readonly Player[], dealerId: PlayerId): PlayerId | undefined {
  const ordered = bySeat(players);
  const i = ordered.findIndex((p) => p.id === dealerId);
  return i < 0 ? undefined : ordered[(i + 1) % ordered.length]!.id;
}

/** Whether the dealer keeps the deal after this hand. */
export function dealerKeeps(rule: RotationRule, round: Round, dealerId: PlayerId): boolean {
  const o = round.input.outcome;
  if (o.type === 'win') return o.winnerId === dealerId && rule.dealerKeepsOnWin;
  if (rule.onDraw === 'keeps') return true;
  if (rule.onDraw === 'passes') return false;
  return !handHadKong(round);
}

export function tableState(game: GameSession): TableState {
  const rounds = game.rounds.filter((r) => !r.deletedAt).sort((a, b) => a.seq - b.seq);
  const rule = rotationOf(game);
  const known = new Set(game.players.map((p) => p.id));
  const firstDealerId =
    (game.initialDealerId && known.has(game.initialDealerId) ? game.initialDealerId : undefined) ??
    rounds.find((r) => r.input.dealerId && known.has(r.input.dealerId))?.input.dealerId;
  const override = game.nextHand && known.has(game.nextHand.dealerId) && SEATS.includes(game.nextHand.prevailingWind) ? game.nextHand : undefined;

  let hand: HandSetup = { ...(firstDealerId ? { dealerId: firstDealerId } : {}), prevailingWind: 'east' };
  let overrideUsed = false;
  let fullCircleDone = false;
  let prevDealer: PlayerId | undefined;
  let streak = 0;
  const hands: TableState['hands'] = {};

  for (const r of rounds) {
    if (override && !overrideUsed && r.seq >= override.setAtSeq) {
      hand = { dealerId: override.dealerId, prevailingWind: override.prevailingWind };
      overrideUsed = true;
    }
    // What this hand was actually played with: recorded values win over derived ones.
    const recordedDealer = r.input.dealerId && known.has(r.input.dealerId) ? r.input.dealerId : undefined;
    const recordedWind = r.input.prevailingWind && SEATS.includes(r.input.prevailingWind) ? r.input.prevailingWind : undefined;
    const played: HandSetup = {
      ...(recordedDealer ?? hand.dealerId ? { dealerId: recordedDealer ?? hand.dealerId } : {}),
      prevailingWind: recordedWind ?? hand.prevailingWind,
    };
    streak = played.dealerId && played.dealerId === prevDealer ? streak + 1 : 0;
    prevDealer = played.dealerId;
    hands[r.id] = { ...played, streak };

    // Work out the next hand.
    if (!played.dealerId) {
      hand = played;
      continue;
    }
    if (dealerKeeps(rule, r, played.dealerId)) {
      hand = played;
      continue;
    }
    const next = nextSeatPlayer(game.players, played.dealerId);
    let wind = played.prevailingWind;
    if (next && next === firstDealerId) {
      const w = SEATS.indexOf(wind);
      if (w === SEATS.length - 1) fullCircleDone = true;
      wind = SEATS[(w + 1) % SEATS.length]!;
    }
    hand = { ...(next ? { dealerId: next } : {}), prevailingWind: wind };
  }
  if (override && !overrideUsed) hand = { dealerId: override.dealerId, prevailingWind: override.prevailingWind };

  const dealerStreak = hand.dealerId && hand.dealerId === prevDealer ? streak + 1 : 0;
  const winds = windsFor(game.players, hand.dealerId);
  return {
    ...hand,
    handNumber: rounds.length + 1,
    dealerStreak,
    winds,
    flowers: Object.fromEntries(Object.entries(winds).map(([id, w]) => [id, flowerNumber(w)])),
    fullCircleDone,
    ...(firstDealerId ? { firstDealerId } : {}),
    hands,
  };
}
