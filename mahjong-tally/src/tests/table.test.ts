import { describe, expect, it } from 'vitest';
import { instantPayoutTemplates } from '../config/defaults';
import { createGame, deleteRound, recordRound, setNextHand } from '../engine/game';
import { dealerKeeps, handHadKong, isKongRule, tableState, windsFor } from '../engine/table';
import { hasErrors, validatePlayers } from '../engine/validation';
import type { GameSession, Player, RoundInput } from '../models/types';
import { PLAYERS, config, discard, draw, makeCtx, selfDraw, unwrap } from './helpers';

// PLAYERS: a East, b South, c West, d North.
function game(initialDealerId: string | null = 'a', cfg = config({ bonusRules: instantPayoutTemplates(300) })) {
  const ctx = makeCtx();
  const g = unwrap(createGame({ name: 't', players: PLAYERS, config: cfg, ...(initialDealerId ? { initialDealerId } : {}) }, ctx()));
  return { g, ctx };
}

/** Record a hand the way the app does: with the tracker's dealer and wind filled in. */
function play(g: GameSession, ctx: ReturnType<typeof makeCtx>, input: RoundInput): GameSession {
  const t = tableState(g);
  return unwrap(recordRound(g, { ...input, ...(t.dealerId ? { dealerId: t.dealerId } : {}), prevailingWind: t.prevailingWind }, ctx())).game;
}

const kong = (playerId: string) => draw([{ ruleId: 'sg-kong-self', count: 1, playerId }]);

describe('winds and flowers', () => {
  it('the dealer is East and the following seats are South, West, North', () => {
    expect(windsFor(PLAYERS, 'a')).toEqual({ a: 'east', b: 'south', c: 'west', d: 'north' });
    expect(windsFor(PLAYERS, 'c')).toEqual({ c: 'east', d: 'south', a: 'west', b: 'north' });
    expect(windsFor(PLAYERS, 'd')).toEqual({ d: 'east', a: 'south', b: 'west', c: 'north' });
    expect(windsFor(PLAYERS)).toEqual({ a: 'east', b: 'south', c: 'west', d: 'north' });
  });

  it('own flowers follow this hand’s wind', () => {
    const { g, ctx } = game();
    expect(tableState(g).flowers).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    const g2 = play(g, ctx, discard('b', 'c', 1)); // non-dealer wins → b deals
    expect(tableState(g2).dealerId).toBe('b');
    expect(tableState(g2).flowers).toEqual({ b: 1, c: 2, d: 3, a: 4 });
  });
});

describe('dealer rotation (house rule: keep on win; on a draw keep unless a kong)', () => {
  it('dealer win keeps, draw keeps, kong draw passes, other winner passes', () => {
    const { ctx, g: start } = game();
    let g = start;
    g = play(g, ctx, selfDraw('a', 1));
    expect(tableState(g)).toMatchObject({ dealerId: 'a', dealerStreak: 1, handNumber: 2 });
    g = play(g, ctx, draw());
    expect(tableState(g)).toMatchObject({ dealerId: 'a', dealerStreak: 2 });
    g = play(g, ctx, kong('c'));
    expect(tableState(g)).toMatchObject({ dealerId: 'b', dealerStreak: 0 });
    g = play(g, ctx, selfDraw('d', 2));
    expect(tableState(g).dealerId).toBe('c');
  });

  it('a kong from a discard also counts; explicit countsAsKong flags are honoured', () => {
    const { g } = game();
    const g1 = unwrap(recordRound(g, { ...draw([{ ruleId: 'sg-kong-discard', count: 1, playerId: 'b', fromPlayerId: 'c' }]), dealerId: 'a' }, makeCtx()()));
    expect(handHadKong(g1.round)).toBe(true);
    expect(isKongRule({ id: 'my-kong', countsAsKong: true })).toBe(true);
    expect(isKongRule({ id: 'sg-kong-self', countsAsKong: false })).toBe(false);
    expect(isKongRule({ id: 'sg-kong-self' })).toBe(true); // rules saved before the flag existed
    expect(isKongRule({ id: 'sg-flower-own' })).toBe(false);
  });

  it('other rotation settings', () => {
    const { g } = game();
    const r = unwrap(recordRound(g, { ...draw(), dealerId: 'a' }, makeCtx()())).round;
    expect(dealerKeeps({ dealerKeepsOnWin: true, onDraw: 'passes' }, r, 'a')).toBe(false);
    expect(dealerKeeps({ dealerKeepsOnWin: true, onDraw: 'keeps' }, r, 'a')).toBe(true);
    const win = unwrap(recordRound(g, { ...selfDraw('a', 1), dealerId: 'a' }, makeCtx()())).round;
    expect(dealerKeeps({ dealerKeepsOnWin: false, onDraw: 'keeps' }, win, 'a')).toBe(false);
  });

  it('the round wind moves on when the deal returns to the first dealer, and a full game is noticed', () => {
    const { ctx, g: start } = game();
    let g = start;
    const winds: string[] = [];
    // Every hand is won by the player after the dealer, so the deal passes each time.
    for (let hand = 0; hand < 16; hand += 1) {
      const t = tableState(g);
      winds.push(t.prevailingWind);
      const next = PLAYERS[(PLAYERS.findIndex((p) => p.id === t.dealerId) + 1) % 4]!.id;
      g = play(g, ctx, selfDraw(next, 1));
    }
    expect(winds).toEqual([...Array(4).fill('east'), ...Array(4).fill('south'), ...Array(4).fill('west'), ...Array(4).fill('north')]);
    expect(tableState(g)).toMatchObject({ prevailingWind: 'east', fullCircleDone: true, dealerId: 'a', handNumber: 17 });
  });

  it('a game whose first dealer is not East seat still rotates from that player', () => {
    const { ctx, g: start } = game('c');
    let g = start;
    expect(tableState(g).winds).toEqual({ c: 'east', d: 'south', a: 'west', b: 'north' });
    for (const winner of ['d', 'a', 'b']) g = play(g, ctx, selfDraw(winner, 1)); // c → d → a → b
    expect(tableState(g)).toMatchObject({ dealerId: 'b', prevailingWind: 'east' });
    g = play(g, ctx, selfDraw('c', 1)); // back to c: South round
    expect(tableState(g)).toMatchObject({ dealerId: 'c', prevailingWind: 'south' });
  });
});

describe('recorded values, overrides and history changes', () => {
  it('recorded dealer and wind win over the derived ones; rounds without them fall back', () => {
    const { g, ctx } = game();
    let g1 = unwrap(recordRound(g, { ...selfDraw('b', 1), dealerId: 'c', prevailingWind: 'west' }, ctx())).game;
    let t = tableState(g1);
    expect(Object.values(t.hands)[0]).toMatchObject({ dealerId: 'c', prevailingWind: 'west' });
    expect(t).toMatchObject({ dealerId: 'd', prevailingWind: 'west' }); // c lost the deal → d
    g1 = unwrap(recordRound(g1, selfDraw('d', 1), ctx())).game; // old-style round: no dealer stored
    t = tableState(g1);
    expect(t).toMatchObject({ dealerId: 'd', dealerStreak: 1, prevailingWind: 'west' });
  });

  it('“next hand” override applies until a hand is recorded after it', () => {
    const { ctx, g: start } = game();
    let g = start;
    g = play(g, ctx, selfDraw('a', 1));
    g = unwrap(setNextHand(g, { dealerId: 'c', prevailingWind: 'south' }, ctx()));
    expect(tableState(g)).toMatchObject({ dealerId: 'c', prevailingWind: 'south' });
    g = play(g, ctx, selfDraw('c', 2)); // recorded with the override → dealer c keeps
    expect(tableState(g)).toMatchObject({ dealerId: 'c', prevailingWind: 'south', dealerStreak: 1 });
    g = play(g, ctx, selfDraw('b', 1));
    expect(tableState(g)).toMatchObject({ dealerId: 'd', prevailingWind: 'south' });
    // Rejects unknown players and winds.
    expect(setNextHand(g, { dealerId: 'zz', prevailingWind: 'east' }, ctx()).ok).toBe(false);
    expect(setNextHand(g, { dealerId: 'a', prevailingWind: 'up' as never }, ctx()).ok).toBe(false);
  });

  it('the override can also change the first dealer (round wind anchor)', () => {
    const { ctx, g: start } = game();
    let g = start;
    g = unwrap(setNextHand(g, { dealerId: 'b', prevailingWind: 'east', firstDealerId: 'b' }, ctx()));
    expect(tableState(g).firstDealerId).toBe('b');
    for (const w of ['c', 'd', 'a']) g = play(g, ctx, selfDraw(w, 1));
    expect(tableState(g)).toMatchObject({ dealerId: 'a', prevailingWind: 'east' });
    g = play(g, ctx, selfDraw('b', 1));
    expect(tableState(g)).toMatchObject({ dealerId: 'b', prevailingWind: 'south' });
  });

  it('deleting a hand re-derives everything after it', () => {
    const { ctx, g: start } = game();
    let g = start;
    g = play(g, ctx, selfDraw('b', 1)); // a → b
    const second = play(g, ctx, selfDraw('c', 1)); // b → c
    expect(tableState(second).dealerId).toBe('c');
    const firstId = Object.keys(tableState(second).hands)[0]!;
    const after = unwrap(deleteRound(second, firstId, ctx()));
    // The remaining hand was recorded with dealer b; c won so the deal goes to c either way,
    // but the hand number drops back.
    expect(tableState(after)).toMatchObject({ dealerId: 'c', handNumber: 2 });
  });

  it('without a first dealer nothing is tracked until a dealer is recorded', () => {
    const { g, ctx } = game(null);
    expect(tableState(g).dealerId).toBeUndefined();
    expect(tableState(g).winds).toEqual({ a: 'east', b: 'south', c: 'west', d: 'north' });
    const g1 = unwrap(recordRound(g, { ...selfDraw('b', 1), dealerId: 'd' }, ctx())).game;
    expect(tableState(g1)).toMatchObject({ dealerId: 'a', firstDealerId: 'd' });
  });
});

describe('spirit animals', () => {
  const withAnimals = (animals: (Player['animal'] | undefined)[]) =>
    PLAYERS.map((p, i) => (animals[i] ? { ...p, animal: animals[i] } : p));
  it('each animal belongs to at most one player, and must be a real animal', () => {
    expect(hasErrors(validatePlayers(withAnimals(['mouse', 'cat', 'chicken', 'centipede'])))).toBe(false);
    expect(hasErrors(validatePlayers(withAnimals(['mouse', undefined, 'cat', undefined])))).toBe(false);
    const dup = validatePlayers(withAnimals(['mouse', 'mouse', undefined, undefined]));
    expect(dup.map((i) => i.code)).toContain('PLAYER_ANIMAL_DUP');
    const bad = validatePlayers(withAnimals(['dragon' as never, undefined, undefined, undefined]));
    expect(bad.map((i) => i.code)).toContain('PLAYER_ANIMAL');
  });
});
