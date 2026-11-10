/**
 * Game operations: every change to a game is a small, serialisable record.
 *
 * Local games apply them immediately. Shared games also append them to an
 * ordered server log; every phone replays the same log through the same pure
 * engine, so all phones derive the identical ledger. `applyOp` is therefore
 * fully deterministic: it reads nothing but the game and the op (the op
 * carries its own timestamp and any new ids).
 */
import * as engine from '../engine/game';
import type { GameSession, Player, PlayerId, Result, RoundId, RoundInput, ScoringConfiguration, Seat } from '../models/types';
import { migrateGameDocument } from '../storage/schema';

export type GameOpBody =
  | { type: 'snapshot'; game: GameSession }
  | { type: 'record'; roundId: RoundId; input: RoundInput }
  | { type: 'edit'; roundId: RoundId; input: RoundInput; rules: 'snapshot' | 'current' }
  | { type: 'delete'; roundId: RoundId }
  | { type: 'restore'; roundId: RoundId }
  | { type: 'reset' }
  | { type: 'purge' }
  | { type: 'players'; players: Player[] }
  | { type: 'config'; config: ScoringConfiguration }
  | { type: 'rescore'; config: ScoringConfiguration }
  | { type: 'finish' }
  | { type: 'reopen' }
  | { type: 'rename'; name: string }
  | { type: 'table'; dealerId: PlayerId; prevailingWind: Seat; firstDealerId?: PlayerId };

export interface GameOp {
  v: 1;
  /** Unique id; makes appending idempotent and lets a phone recognise its own ops. */
  opId: string;
  /** Random id of the phone that made the op. */
  deviceId: string;
  /** Name of the player using that phone, if they said who they are. */
  author?: string;
  /** When the op was made (used as the change's timestamp everywhere). */
  at: string;
  body: GameOpBody;
}

function fail(code: string, message: string): Result<GameSession> {
  return { ok: false, errors: [{ code, message, severity: 'error' }] };
}

/** Context for engine calls: the op's own time, author, and (for record) its pre-chosen round id. */
function ctxFor(op: GameOp, roundId?: RoundId): engine.OpContext {
  let used = false;
  return {
    now: op.at,
    ...(op.author ? { by: op.author } : {}),
    newId: () => {
      if (!roundId || used) throw new Error(`Operation ${op.body.type} needs no new ids`);
      used = true;
      return roundId;
    },
  };
}

/** Apply one op. Never throws; an invalid op returns errors and leaves the game unchanged. */
export function applyOp(game: GameSession | null, op: GameOp): Result<GameSession> {
  try {
    return applyOpUnsafe(game, op);
  } catch (e) {
    return fail('OP_FAILED', e instanceof Error ? e.message : 'The change could not be applied.');
  }
}

function applyOpUnsafe(game: GameSession | null, op: GameOp): Result<GameSession> {
  if (!op || op.v !== 1 || typeof op.opId !== 'string' || typeof op.at !== 'string' || !op.body) {
    return fail('OP_MALFORMED', 'A change from another phone was not readable.');
  }
  const body = op.body;
  if (body.type === 'snapshot') {
    if (game) return fail('OP_SNAPSHOT_EXISTS', 'This shared game was already started.');
    const migrated = migrateGameDocument(body.game);
    return migrated.ok ? { ok: true, value: migrated.value } : migrated;
  }
  if (!game) return fail('OP_NO_GAME', 'The shared game has not been started yet.');
  const ctx = ctxFor(op, body.type === 'record' ? body.roundId : undefined);
  const gameOnly = (r: Result<{ game: GameSession }>): Result<GameSession> => (r.ok ? { ok: true, value: r.value.game } : r);

  switch (body.type) {
    case 'record':
      if (game.rounds.some((r) => r.id === body.roundId)) return fail('OP_DUPLICATE', 'That round was already recorded.');
      return gameOnly(engine.recordRound(game, body.input, ctx));
    case 'edit':
      return gameOnly(engine.editRound(game, body.roundId, body.input, ctx, { rules: body.rules }));
    case 'delete':
      return engine.deleteRound(game, body.roundId, ctx);
    case 'restore':
      return engine.restoreRound(game, body.roundId, ctx);
    case 'reset':
      return engine.resetGame(game, ctx);
    case 'purge':
      return { ok: true, value: engine.purgeDeletedRounds(game, ctx) };
    case 'players':
      return engine.updatePlayers(game, body.players, ctx);
    case 'config':
      return engine.updateGameConfig(game, body.config, ctx);
    case 'rescore':
      return engine.applyRescore(game, body.config, ctx);
    case 'finish':
      return { ok: true, value: engine.finishGame(game, ctx) };
    case 'reopen':
      return { ok: true, value: engine.reopenGame(game, ctx) };
    case 'table':
      return engine.setNextHand(
        game,
        { dealerId: body.dealerId, prevailingWind: body.prevailingWind, ...(body.firstDealerId ? { firstDealerId: body.firstDealerId } : {}) },
        ctx,
      );
    case 'rename': {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return fail('NAME', 'Game name cannot be empty.');
      return { ok: true, value: { ...game, name: name.slice(0, 60), updatedAt: op.at } };
    }
    default:
      return fail('OP_UNKNOWN', 'A change from a newer version of the app was skipped. Update the app.');
  }
}

export interface FoldResult {
  game: GameSession | null;
  /** Ops that were skipped because they could not be applied at their position. */
  rejected: { op: GameOp; message: string }[];
}

/** Replay ops in order on top of `base`, skipping (and reporting) any that fail. */
export function foldOps(base: GameSession | null, ops: readonly GameOp[]): FoldResult {
  let game = base;
  const rejected: FoldResult['rejected'] = [];
  for (const op of ops) {
    const r = applyOp(game, op);
    if (r.ok) game = r.value;
    else rejected.push({ op, message: r.errors[0]?.message ?? 'Change could not be applied.' });
  }
  return { game, rejected };
}
