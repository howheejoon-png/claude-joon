import { describe, expect, it } from 'vitest';
import { checkGameHealth } from '../engine/audit';
import {
  activeRounds,
  applyRescore,
  createGame,
  deleteRound,
  deletedRounds,
  editRound,
  finishGame,
  gameBalances,
  gameLedger,
  gameStats,
  previewEdit,
  previewRescore,
  previewRound,
  purgeDeletedRounds,
  recordRound,
  reopenGame,
  resetGame,
  restoreRound,
  roundNumbers,
  suggestNextDealer,
  undoLastRound,
  updateGameConfig,
  updatePlayers,
} from '../engine/game';
import { validateLedger } from '../engine/ledger';
import type { GameSession, RoundInput } from '../models/types';
import { PLAYERS, config, discard, draw, makeCtx, newGame, selfDraw, unwrap } from './helpers';

const nets = (g: GameSession) => Object.fromEntries(gameBalances(g).map((b) => [b.playerId, b.netCents]));
const total = (g: GameSession) => gameBalances(g).reduce((a, b) => a + b.netCents, 0);

function play(inputs: RoundInput[], ctx = makeCtx()) {
  let g = newGame(config(), ctx);
  for (const i of inputs) g = unwrap(recordRound(g, i, ctx())).game;
  return { g, ctx };
}

function expectHealthy(g: GameSession) {
  expect(total(g)).toBe(0);
  const h = checkGameHealth(g);
  expect(h.issues).toEqual([]);
  expect(h.ok).toBe(true);
}

describe('createGame', () => {
  it('creates a four-player game with players in seat order', () => {
    const ctx = makeCtx();
    const shuffled = [PLAYERS[2]!, PLAYERS[0]!, PLAYERS[3]!, PLAYERS[1]!];
    const g = unwrap(createGame({ name: '  Friday  ', players: shuffled, config: config(), initialDealerId: 'b' }, ctx()));
    expect(g.players.map((p) => p.seat)).toEqual(['east', 'south', 'west', 'north']);
    expect(g.name).toBe('Friday');
    expect(g.initialDealerId).toBe('b');
    expect(g.rounds).toEqual([]);
    expect(nets(g)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it('rejects invalid players and rules', () => {
    const ctx = makeCtx();
    expect(createGame({ name: 'x', players: PLAYERS.slice(0, 3), config: config() }, ctx()).ok).toBe(false);
    const dupName = PLAYERS.map((p) => ({ ...p, name: 'Same' }));
    expect(createGame({ name: 'x', players: dupName, config: config() }, ctx()).ok).toBe(false);
    const dupSeat = PLAYERS.map((p) => ({ ...p, seat: 'east' as const }));
    expect(createGame({ name: 'x', players: dupSeat, config: config() }, ctx()).ok).toBe(false);
    expect(createGame({ name: 'x', players: PLAYERS, config: config({ minTai: 6 }) }, ctx()).ok).toBe(false);
    expect(createGame({ name: 'x', players: PLAYERS, config: config(), initialDealerId: 'zz' }, ctx()).ok).toBe(false);
  });

  it('does not share config objects with the caller', () => {
    const cfg = config();
    const g = newGame(cfg);
    cfg.payoutTable[0]!.selfDrawEachPays = 99999;
    expect(g.config.payoutTable[0]!.selfDrawEachPays).toBe(60);
  });
});

describe('recording rounds', () => {
  it('records rounds and derives balances from the ledger', () => {
    const { g } = play([selfDraw('a', 3), discard('b', 'c', 1), draw()]);
    expect(activeRounds(g)).toHaveLength(3);
    expect(nets(g)).toEqual({ a: 720 - 30, b: -240 + 120, c: -240 - 60, d: -240 - 30 });
    expectHealthy(g);
    expect(gameLedger(g)).toHaveLength(6);
  });

  it('stores a rules snapshot and player snapshot with each round', () => {
    const { g } = play([selfDraw('a', 1)]);
    const r = activeRounds(g)[0]!;
    expect(r.configSnapshot).toEqual(g.config);
    expect(r.configSnapshot).not.toBe(g.config);
    expect(r.playersSnapshot).toEqual(g.players);
    expect(r.revisions).toEqual([{ at: r.createdAt, action: 'created' }]);
  });

  it('refuses invalid rounds without changing the game', () => {
    const ctx = makeCtx();
    const g = newGame(config(), ctx);
    const res = recordRound(g, discard('a', 'a', 1), ctx());
    expect(res.ok).toBe(false);
    expect(g.rounds).toEqual([]);
  });

  it('refuses to record in a finished game until reopened', () => {
    const ctx = makeCtx();
    const g = finishGame(newGame(config(), ctx), ctx());
    expect(g.status).toBe('finished');
    expect(recordRound(g, selfDraw('a', 1), ctx()).ok).toBe(false);
    const reopened = reopenGame(g, ctx());
    expect(reopened.status).toBe('active');
    expect(reopened.finishedAt).toBeUndefined();
    expect(recordRound(reopened, selfDraw('a', 1), ctx()).ok).toBe(true);
  });

  it('preview matches what gets recorded', () => {
    const ctx = makeCtx();
    const g = newGame(config(), ctx);
    const p = unwrap(previewRound(g, discard('d', 'a', 2)));
    expect(p.net).toEqual({ a: -120, b: -60, c: -60, d: 240 });
    expect(p.validation.ok).toBe(true);
    const rec = unwrap(recordRound(g, discard('d', 'a', 2), ctx()));
    expect(nets(rec.game)).toEqual(p.net);
  });

  it('drawn rounds leave balances unchanged unless instant bonuses apply', () => {
    const cfg = config({
      bonusRules: [{ id: 'k', name: 'Kong', kind: 'collect_from_each', value: 50, enabled: true }],
    });
    const ctx = makeCtx();
    let g = newGame(cfg, ctx);
    g = unwrap(recordRound(g, draw(), ctx())).game;
    expect(nets(g)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    g = unwrap(recordRound(g, draw([{ ruleId: 'k', count: 1, playerId: 'd' }]), ctx())).game;
    expect(nets(g)).toEqual({ a: -50, b: -50, c: -50, d: 150 });
    expect(gameStats(g)).toMatchObject({ roundsPlayed: 2, wins: 0, draws: 2 });
    expectHealthy(g);
  });
});

describe('undo, delete, restore', () => {
  it('undo reverses the most recent round exactly', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2)]);
    const before = nets(play([selfDraw('a', 3)]).g);
    const undone = unwrap(undoLastRound(g, ctx()));
    expect(nets(undone.game)).toEqual(before);
    expect(undone.round.input).toEqual(discard('b', 'c', 2));
    expect(deletedRounds(undone.game)).toHaveLength(1);
    expectHealthy(undone.game);
  });

  it('undo with no rounds fails cleanly', () => {
    const ctx = makeCtx();
    expect(undoLastRound(newGame(config(), ctx), ctx()).ok).toBe(false);
  });

  it('deleting an earlier round recalculates every balance', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2), selfDraw('d', 1)]);
    const first = activeRounds(g)[0]!;
    const after = unwrap(deleteRound(g, first.id, ctx()));
    expect(nets(after)).toEqual(nets(play([discard('b', 'c', 2), selfDraw('d', 1)]).g));
    expect(roundNumbers(after).get(activeRounds(after)[0]!.id)).toBe(1);
    expect(roundNumbers(after).has(first.id)).toBe(false);
    expectHealthy(after);
    expect(deleteRound(after, first.id, ctx()).ok).toBe(false); // already deleted
    expect(deleteRound(after, 'nope', ctx()).ok).toBe(false);
  });

  it('restoring a deleted round puts its financial impact back', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2)]);
    const original = nets(g);
    const id = activeRounds(g)[0]!.id;
    const deleted = unwrap(deleteRound(g, id, ctx()));
    const restored = unwrap(restoreRound(deleted, id, ctx()));
    expect(nets(restored)).toEqual(original);
    expect(activeRounds(restored).map((r) => r.id)).toEqual(activeRounds(g).map((r) => r.id));
    expect(restored.rounds.find((r) => r.id === id)!.revisions.map((r) => r.action)).toEqual([
      'created',
      'deleted',
      'restored',
    ]);
    expect(restoreRound(restored, id, ctx()).ok).toBe(false);
    expectHealthy(restored);
  });

  it('purging deleted rounds does not change balances', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2)]);
    const del = unwrap(deleteRound(g, activeRounds(g)[1]!.id, ctx()));
    const purged = purgeDeletedRounds(del, ctx());
    expect(purged.rounds).toHaveLength(1);
    expect(nets(purged)).toEqual(nets(del));
  });

  it('reset soft-deletes every round so balances go to zero and can be restored', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2)]);
    const reset = unwrap(resetGame(g, ctx()));
    expect(nets(reset)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(deletedRounds(reset)).toHaveLength(2);
    expectHealthy(reset);
  });
});

describe('editing rounds', () => {
  it('editing an earlier round recalculates all balances deterministically', () => {
    const { g, ctx } = play([selfDraw('a', 3), discard('b', 'c', 2), selfDraw('d', 1)]);
    const first = activeRounds(g)[0]!;
    const edited = unwrap(editRound(g, first.id, discard('a', 'd', 1), ctx()));
    expect(nets(edited.game)).toEqual(nets(play([discard('a', 'd', 1), discard('b', 'c', 2), selfDraw('d', 1)]).g));
    expect(edited.round.id).toBe(first.id);
    expect(edited.round.seq).toBe(first.seq);
    expect(edited.round.transactions.every((t) => t.roundId === first.id)).toBe(true);
    expect(edited.round.revisions.at(-1)).toMatchObject({
      action: 'edited',
      previousNet: { a: 720, b: -240, c: -240, d: -240 },
    });
    expectHealthy(edited.game);
  });

  it('edits keep the round’s own rules snapshot unless current rules are requested', () => {
    const { g, ctx } = play([selfDraw('a', 1)]);
    const id = activeRounds(g)[0]!.id;
    const doubled = config({
      payoutTable: config().payoutTable.map((r) => ({ ...r, selfDrawEachPays: r.selfDrawEachPays * 2 })),
    });
    const g2 = unwrap(updateGameConfig(g, doubled, ctx()));
    // Changing rules does not change history.
    expect(nets(g2)).toEqual(nets(g));
    const keep = unwrap(editRound(g2, id, selfDraw('a', 1), ctx()));
    expect(nets(keep.game)).toEqual({ a: 180, b: -60, c: -60, d: -60 });
    const preview = unwrap(previewEdit(g2, id, selfDraw('a', 1), { rules: 'current' }));
    expect(preview.net).toEqual({ a: 360, b: -120, c: -120, d: -120 });
    const cur = unwrap(editRound(g2, id, selfDraw('a', 1), ctx(), { rules: 'current' }));
    expect(nets(cur.game)).toEqual({ a: 360, b: -120, c: -120, d: -120 });
    expect(cur.round.configSnapshot).toEqual(doubled);
    expectHealthy(cur.game);
  });

  it('cannot edit a deleted or missing round, or with invalid input', () => {
    const { g, ctx } = play([selfDraw('a', 1)]);
    const id = activeRounds(g)[0]!.id;
    expect(editRound(g, 'missing', selfDraw('a', 1), ctx()).ok).toBe(false);
    expect(editRound(g, id, discard('a', 'a', 1), ctx()).ok).toBe(false);
    const del = unwrap(deleteRound(g, id, ctx()));
    expect(editRound(del, id, selfDraw('b', 1), ctx()).ok).toBe(false);
  });

  it('editing a win into a draw clears its effective tai', () => {
    const { g, ctx } = play([selfDraw('a', 1)]);
    const id = activeRounds(g)[0]!.id;
    const e = unwrap(editRound(g, id, draw(), ctx()));
    expect(e.round.effectiveTai).toBeUndefined();
    expect(e.round.transactions).toEqual([]);
  });
});

describe('rules changes and rescoring', () => {
  const doubled = () =>
    config({
      payoutTable: config().payoutTable.map((r) => ({
        ...r,
        discarderPays: r.discarderPays * 2,
        othersPay: r.othersPay * 2,
        selfDrawEachPays: r.selfDrawEachPays * 2,
      })),
    });

  it('changing rules only affects future rounds', () => {
    const { g, ctx } = play([selfDraw('a', 1)]);
    const g2 = unwrap(updateGameConfig(g, doubled(), ctx()));
    const g3 = unwrap(recordRound(g2, selfDraw('b', 1), ctx())).game;
    expect(nets(g3)).toEqual({ a: 180 - 120, b: -60 + 360, c: -180, d: -180 });
    expectHealthy(g3);
  });

  it('rejects invalid rules changes', () => {
    const { g, ctx } = play([]);
    const res = updateGameConfig(g, config({ payoutCap: { mode: 'per_round', amountCents: 0 } }), ctx());
    expect(res.ok).toBe(false);
  });

  it('rescoring requires a preview and then re-scores every round with the new rules', () => {
    const { g, ctx } = play([selfDraw('a', 1), discard('b', 'c', 2), draw()]);
    const preview = unwrap(previewRescore(g, doubled()));
    expect(preview.changedCount).toBe(2);
    expect(preview.balancesBefore).toEqual(nets(g));
    for (const id of Object.keys(preview.balancesBefore)) {
      expect(preview.balancesAfter[id]).toBe(preview.balancesBefore[id]! * 2);
    }
    const rescored = unwrap(applyRescore(g, doubled(), ctx()));
    expect(nets(rescored)).toEqual(preview.balancesAfter);
    expect(rescored.config).toEqual(doubled());
    activeRounds(rescored).forEach((r) => expect(r.revisions.at(-1)?.action === 'rescored').toBe(true));
    expectHealthy(rescored);
  });

  it('rescore fails as a whole if any round cannot be scored under the new rules', () => {
    const { g, ctx } = play([selfDraw('a', 5)]);
    const smaller = config({ maxTai: 3, payoutTable: config().payoutTable.filter((r) => r.tai <= 3) });
    const p = previewRescore(g, smaller);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.errors[0]!.message).toMatch(/^Round 1:/);
    expect(applyRescore(g, smaller, ctx()).ok).toBe(false);
  });
});

describe('players', () => {
  it('renaming or re-seating players keeps history auditable', () => {
    const { g, ctx } = play([selfDraw('a', 1), discard('b', 'c', 1)]);
    const reseated = PLAYERS.map((p) => ({
      ...p,
      name: p.name + ' X',
      seat: ({ east: 'north', south: 'east', west: 'south', north: 'west' } as const)[p.seat],
    }));
    const g2 = unwrap(updatePlayers(g, reseated, ctx()));
    expect(g2.players.map((p) => p.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(nets(g2)).toEqual(nets(g));
    expectHealthy(g2);
    // New rounds after re-seating still balance and the audit still passes.
    const g3 = unwrap(recordRound(g2, discard('c', 'a', 2), ctx())).game;
    expectHealthy(g3);
  });

  it('cannot add or remove players mid-game', () => {
    const { g, ctx } = play([]);
    const swapped = [...PLAYERS.slice(0, 3), { id: 'zz', name: 'New', seat: 'north' as const }];
    expect(updatePlayers(g, swapped, ctx()).ok).toBe(false);
  });
});

describe('dealer suggestion and stats', () => {
  it('suggests the initial dealer, keeps the deal on dealer win or draw, and rotates otherwise', () => {
    const ctx = makeCtx();
    let g = unwrap(createGame({ name: 'x', players: PLAYERS, config: config(), initialDealerId: 'a' }, ctx()));
    expect(suggestNextDealer(g)).toBe('a');
    g = unwrap(recordRound(g, selfDraw('a', 1, { dealerId: 'a' }), ctx())).game;
    expect(suggestNextDealer(g)).toBe('a');
    g = unwrap(recordRound(g, { ...draw(), dealerId: 'a' }, ctx())).game;
    expect(suggestNextDealer(g)).toBe('a');
    g = unwrap(recordRound(g, selfDraw('c', 1, { dealerId: 'a' }), ctx())).game;
    expect(suggestNextDealer(g)).toBe('b');
    g = unwrap(recordRound(g, selfDraw('c', 1, { dealerId: 'd' }), ctx())).game;
    expect(suggestNextDealer(g)).toBe('a'); // wraps North → East
    g = unwrap(recordRound(g, selfDraw('c', 1), ctx())).game;
    expect(suggestNextDealer(g)).toBeUndefined();
  });

  it('reports the biggest winning round and totals', () => {
    const { g } = play([selfDraw('a', 1), discard('b', 'c', 4), draw()]);
    const s = gameStats(g);
    expect(s.roundsPlayed).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.draws).toBe(1);
    expect(s.biggestWin).toMatchObject({ winnerId: 'b', amountCents: 960 });
    expect(s.totalMovedCents).toBe(180 + 960);
  });

  it('round numbers are 1..n for active rounds in play order', () => {
    const { g } = play([selfDraw('a', 1), selfDraw('b', 1), selfDraw('c', 1)]);
    const nums = roundNumbers(g);
    expect(activeRounds(g).map((r) => nums.get(r.id))).toEqual([1, 2, 3]);
  });

  it('every operation keeps the whole ledger valid', () => {
    const { g } = play([selfDraw('a', 1), discard('b', 'c', 4), draw()]);
    const v = validateLedger(gameLedger(g), {
      playerIds: g.players.map((p) => p.id),
      roundIds: activeRounds(g).map((r) => r.id),
    });
    expect(v.ok).toBe(true);
  });
});
