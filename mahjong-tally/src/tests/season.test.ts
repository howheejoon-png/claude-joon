import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantPayoutTemplates } from '../config/defaults';
import { createGame, finishGame, gameBalances, recordRound } from '../engine/game';
import { computeSeason, nameKey } from '../engine/season';
import type { GameSession, Player, RoundInput } from '../models/types';
import { config, discard, draw, selfDraw, unwrap } from './helpers';

let n = 0;
function night(date: string, names: [string, string, string, string], hands: RoundInput[], finished = true): GameSession {
  const players: Player[] = (['east', 'south', 'west', 'north'] as const).map((seat, i) => ({ id: 'abcd'[i]!, name: names[i]!, seat }));
  const ctx = () => ({ now: date, newId: () => `g${(n += 1)}` });
  let g = unwrap(createGame({ name: `Night ${date.slice(0, 10)}`, players, config: config({ bonusRules: instantPayoutTemplates(300) }) }, ctx()));
  for (const h of hands) g = unwrap(recordRound(g, h, ctx())).game;
  return finished ? finishGame(g, ctx()) : g;
}

const NAMES: [string, string, string, string] = ['Zem', 'Iris', 'Joon', 'Yao'];

describe('season leaderboard', () => {
  it('adds up every night per player, matching names case-insensitively', () => {
    const g1 = night('2026-01-03T12:00:00.000Z', NAMES, [selfDraw('a', 3), discard('b', 'c', 1)]);
    const g2 = night('2026-01-10T12:00:00.000Z', ['zem ', 'IRIS', 'joon', 'Yao'], [selfDraw('c', 2)]);
    const s = computeSeason([g2, g1], { includeActive: false });
    expect(s.nights).toBe(2);
    expect(s.hands).toBe(3);
    expect(s.players).toHaveLength(4);
    const nets = (g: GameSession) => Object.fromEntries(gameBalances(g).map((b) => [nameKey(g.players.find((p) => p.id === b.playerId)!.name), b.netCents]));
    const n1 = nets(g1);
    const n2 = nets(g2);
    for (const p of s.players) {
      expect(p.totalCents).toBe((n1[p.key] ?? 0) + (n2[p.key] ?? 0));
      expect(p.nights).toBe(2);
    }
    expect(s.balanceCheckCents).toBe(0);
    expect(s.players.find((p) => p.key === 'iris')?.name).toBe('IRIS'); // latest spelling
    expect(s.players.map((p) => p.totalCents)).toEqual([...s.players.map((p) => p.totalCents)].sort((a, b) => b - a));
  });

  it('streaks, best/worst nights, self-draws, kongs and the biggest hand', () => {
    const hands = (winner: string) => [selfDraw(winner, 1)];
    const games = [
      night('2026-02-01T12:00:00.000Z', NAMES, hands('a')),
      night('2026-02-08T12:00:00.000Z', NAMES, hands('a')),
      night('2026-02-15T12:00:00.000Z', NAMES, [discard('b', 'a', 5)]),
      // Zem +$7.20 on a 3-tai self-draw, then pays $4.00 for Yao's two self-drawn kongs: still up.
      night('2026-02-22T12:00:00.000Z', NAMES, [selfDraw('a', 3), draw([{ ruleId: 'sg-kong-self', count: 2, playerId: 'd' }])]),
    ];
    const s = computeSeason(games, { includeActive: false });
    const zem = s.players.find((p) => p.key === 'zem')!;
    expect(zem).toMatchObject({ nightsUp: 3, nightsDown: 1, longestStreak: 2, currentStreak: 1, handsWon: 3, selfDraws: 3 });
    expect(zem.bestNight?.cents).toBeGreaterThan(0);
    expect(zem.worstNight?.cents).toBeLessThan(0);
    expect(s.kongKing).toEqual({ name: 'Yao', kongs: 2 });
    expect(s.selfDrawKing).toEqual({ name: 'Zem', selfDraws: 3 });
    expect(s.biggestHand).toMatchObject({ name: 'Iris' }); // 5-tai discard win
    expect(s.longestStreak).toEqual({ name: 'Zem', streak: 2 });
  });

  it('filters by date and by finished games; empty nights are ignored', () => {
    const old = night('2025-12-31T12:00:00.000Z', NAMES, [selfDraw('a', 1)]);
    const recent = night('2026-03-01T12:00:00.000Z', NAMES, [selfDraw('b', 1)]);
    const live = night('2026-03-08T12:00:00.000Z', NAMES, [selfDraw('c', 1)], false);
    const empty = night('2026-03-09T12:00:00.000Z', NAMES, []);
    expect(computeSeason([old, recent, live, empty], { includeActive: true }).nights).toBe(3);
    expect(computeSeason([old, recent, live, empty], { includeActive: false }).nights).toBe(2);
    expect(computeSeason([old, recent, live, empty], { includeActive: true, from: '2026-01-01T00:00:00.000Z' }).nights).toBe(2);
    expect(computeSeason([], { includeActive: true })).toMatchObject({ nights: 0, players: [], balanceCheckCents: 0 });
  });

  it('season totals always reconcile to zero and to the sum of the nights', () => {
    const handArb = fc.record({ w: fc.nat(3), d: fc.nat(2), tai: fc.integer({ min: 1, max: 5 }), self: fc.boolean() });
    fc.assert(
      fc.property(fc.array(fc.array(handArb, { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 6 }), (nights) => {
        const games = nights.map((hands, i) =>
          night(
            `2026-04-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
            NAMES,
            hands.map((h) => {
              const ids = ['a', 'b', 'c', 'd'];
              const winner = ids[h.w]!;
              const others = ids.filter((x) => x !== winner);
              return h.self ? selfDraw(winner, h.tai) : discard(winner, others[h.d]!, h.tai);
            }),
          ),
        );
        const s = computeSeason(games, { includeActive: false });
        expect(s.balanceCheckCents).toBe(0);
        const expected = games.flatMap((g) => gameBalances(g)).reduce((a, b) => a + Math.abs(b.netCents), 0);
        expect(s.players.reduce((a, p) => a + Math.abs(p.totalCents), 0)).toBeLessThanOrEqual(expected);
        for (const p of s.players) expect(Number.isSafeInteger(p.totalCents) && Number.isSafeInteger(p.averageCents)).toBe(true);
      }),
      { numRuns: 80 },
    );
  });
});
