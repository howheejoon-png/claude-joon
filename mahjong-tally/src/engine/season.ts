/**
 * Season leaderboard: totals across every game (night) on this phone.
 * Pure and integer-cent only. Players are matched across games by name
 * (trimmed, case-insensitive); the most recent spelling is shown.
 */
import type { Cents, GameSession } from '../models/types';
import { roundRational } from '../utils/money';
import { activeRounds, gameBalances, roundNet } from './game';
import { isKongRule } from './table';

export interface SeasonOptions {
  /** Only games started on or after this ISO date. */
  from?: string;
  /** Include games that are not marked finished. */
  includeActive: boolean;
}

export interface NightRef {
  gameId: string;
  gameName: string;
  date: string;
  cents: Cents;
}

export interface SeasonPlayer {
  key: string;
  name: string;
  nights: number;
  totalCents: Cents;
  /** Average per night, rounded to the nearest cent (display only). */
  averageCents: Cents;
  nightsUp: number;
  nightsDown: number;
  nightsEven: number;
  bestNight?: NightRef;
  worstNight?: NightRef;
  bestHand?: NightRef;
  handsWon: number;
  selfDraws: number;
  kongs: number;
  /** Winning nights in a row, ending with the latest night played. */
  currentStreak: number;
  longestStreak: number;
}

export interface SeasonSummary {
  players: SeasonPlayer[];
  nights: number;
  hands: number;
  movedCents: Cents;
  /** Sum of every player's total. Always 0 for valid games. */
  balanceCheckCents: Cents;
  biggestHand?: NightRef & { name: string };
  kongKing?: { name: string; kongs: number };
  selfDrawKing?: { name: string; selfDraws: number };
  longestStreak?: { name: string; streak: number };
}

export const nameKey = (name: string) => name.trim().toLowerCase();

export function seasonGames(games: readonly GameSession[], opts: SeasonOptions): GameSession[] {
  return games
    .filter((g) => (opts.includeActive || g.status === 'finished') && (!opts.from || g.createdAt >= opts.from) && activeRounds(g).length > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function computeSeason(games: readonly GameSession[], opts: SeasonOptions): SeasonSummary {
  const nights = seasonGames(games, opts);
  const byKey = new Map<string, SeasonPlayer & { streak: number }>();
  let hands = 0;
  let moved = 0;
  let biggest: SeasonSummary['biggestHand'];

  const playerFor = (name: string) => {
    const key = nameKey(name);
    let p = byKey.get(key);
    if (!p) {
      p = {
        key,
        name: name.trim(),
        nights: 0,
        totalCents: 0,
        averageCents: 0,
        nightsUp: 0,
        nightsDown: 0,
        nightsEven: 0,
        handsWon: 0,
        selfDraws: 0,
        kongs: 0,
        currentStreak: 0,
        longestStreak: 0,
        streak: 0,
      };
      byKey.set(key, p);
    }
    p.name = name.trim(); // later games overwrite: most recent spelling wins
    return p;
  };

  for (const game of nights) {
    const nameOf = new Map(game.players.map((pl) => [pl.id, pl.name]));
    const ref = (cents: Cents): NightRef => ({ gameId: game.id, gameName: game.name, date: game.createdAt, cents });

    for (const b of gameBalances(game)) {
      const p = playerFor(nameOf.get(b.playerId) ?? '?');
      p.nights += 1;
      p.totalCents += b.netCents;
      if (b.netCents > 0) p.nightsUp += 1;
      else if (b.netCents < 0) p.nightsDown += 1;
      else p.nightsEven += 1;
      if (!p.bestNight || b.netCents > p.bestNight.cents) p.bestNight = ref(b.netCents);
      if (!p.worstNight || b.netCents < p.worstNight.cents) p.worstNight = ref(b.netCents);
      p.streak = b.netCents > 0 ? p.streak + 1 : 0;
      p.longestStreak = Math.max(p.longestStreak, p.streak);
    }

    for (const round of activeRounds(game)) {
      hands += 1;
      moved += round.transactions.reduce((a, t) => a + t.amountCents, 0);
      const o = round.input.outcome;
      if (o.type === 'win') {
        const name = nameOf.get(o.winnerId) ?? '?';
        const p = playerFor(name);
        p.handsWon += 1;
        if (o.method === 'self_draw') p.selfDraws += 1;
        const won = roundNet(game, round)[o.winnerId] ?? 0;
        if (!p.bestHand || won > p.bestHand.cents) p.bestHand = ref(won);
        if (!biggest || won > biggest.cents) biggest = { ...ref(won), name };
      }
      const rules = new Map(round.configSnapshot.bonusRules.map((r) => [r.id, r]));
      for (const bonus of round.input.bonuses) {
        const rule = rules.get(bonus.ruleId);
        if (rule && isKongRule(rule) && bonus.playerId) playerFor(nameOf.get(bonus.playerId) ?? '?').kongs += bonus.count;
      }
    }
  }

  const players: SeasonPlayer[] = [...byKey.values()]
    .map(({ streak, ...p }) => ({
      ...p,
      currentStreak: streak,
      averageCents: p.nights ? (roundRational(p.totalCents, p.nights, 'nearest', 1).cents ?? 0) : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));

  const top = <K extends 'kongs' | 'selfDraws' | 'longestStreak'>(k: K) =>
    players.reduce<SeasonPlayer | undefined>((best, p) => (p[k] > 0 && (!best || p[k] > best[k]) ? p : best), undefined);
  const kong = top('kongs');
  const sd = top('selfDraws');
  const streak = top('longestStreak');

  return {
    players,
    nights: nights.length,
    hands,
    movedCents: moved,
    balanceCheckCents: players.reduce((a, p) => a + p.totalCents, 0),
    ...(biggest ? { biggestHand: biggest } : {}),
    ...(kong ? { kongKing: { name: kong.name, kongs: kong.kongs } } : {}),
    ...(sd ? { selfDrawKing: { name: sd.name, selfDraws: sd.selfDraws } } : {}),
    ...(streak ? { longestStreak: { name: streak.name, streak: streak.longestStreak } } : {}),
  };
}
