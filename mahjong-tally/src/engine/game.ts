/**
 * Pure game-session operations. Every operation returns a NEW GameSession;
 * nothing mutates its input. Balances are never stored — they are always
 * derived from the ledger (the transactions of non-deleted rounds), so
 * editing, deleting or restoring any round deterministically recomputes all
 * totals.
 */
import { cloneConfig } from '../config/defaults';
import type {
  Cents,
  GameSession,
  LedgerTransaction,
  Player,
  PlayerId,
  Result,
  Round,
  RoundId,
  RoundInput,
  ScoringConfiguration,
  ValidationIssue,
} from '../models/types';
import { SEATS } from '../models/types';
import { computeBalances, netByPlayer, validateLedger, type LedgerValidation } from './ledger';
import { scoreRound, toTransactions, type ScoredRound } from './scoring';
import { hasErrors, validateConfig, validatePlayers } from './validation';

export interface OpContext {
  /** ISO timestamp for the change. */
  now: string;
  /** Generates a unique id. */
  newId: () => string;
  /** Who is making the change (player name), recorded on round revisions. */
  by?: string;
}

const byOf = (ctx: OpContext) => (ctx.by ? { by: ctx.by } : {});

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, errors: [{ code, message, severity: 'error' }] };
}

export function sortPlayersBySeat(players: readonly Player[]): Player[] {
  return [...players].sort((a, b) => SEATS.indexOf(a.seat) - SEATS.indexOf(b.seat));
}

function cloneInput(input: RoundInput): RoundInput {
  return JSON.parse(JSON.stringify(input)) as RoundInput;
}

export interface CreateGameParams {
  name: string;
  players: Player[];
  config: ScoringConfiguration;
  initialDealerId?: PlayerId;
}

export function createGame(params: CreateGameParams, ctx: OpContext): Result<GameSession> {
  const playerIssues = validatePlayers(params.players);
  const configIssues = validateConfig(params.config);
  const errors = [...playerIssues, ...configIssues].filter((i) => i.severity === 'error');
  if (errors.length) return { ok: false, errors };
  if (params.initialDealerId && !params.players.some((p) => p.id === params.initialDealerId)) {
    return fail('DEALER_UNKNOWN', 'The selected dealer is not one of the players.');
  }
  const game: GameSession = {
    schemaVersion: 1,
    id: ctx.newId(),
    name: params.name.trim() || 'Mahjong game',
    createdAt: ctx.now,
    updatedAt: ctx.now,
    status: 'active',
    players: sortPlayersBySeat(params.players.map((p) => ({ ...p, name: p.name.trim() }))),
    ...(params.initialDealerId ? { initialDealerId: params.initialDealerId } : {}),
    config: cloneConfig(params.config),
    rounds: [],
    nextSeq: 1,
  };
  return { ok: true, value: game };
}

/** Non-deleted rounds in play order. */
export function activeRounds(game: GameSession): Round[] {
  return game.rounds.filter((r) => !r.deletedAt).sort((a, b) => a.seq - b.seq);
}

/** Soft-deleted rounds, most recently deleted first. */
export function deletedRounds(game: GameSession): Round[] {
  return game.rounds
    .filter((r) => r.deletedAt)
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '') || b.seq - a.seq);
}

/** Display numbers ("Round 3") for active rounds. */
export function roundNumbers(game: GameSession): Map<RoundId, number> {
  return new Map(activeRounds(game).map((r, i) => [r.id, i + 1]));
}

/** The single source of truth: all transactions of active rounds. */
export function gameLedger(game: GameSession): LedgerTransaction[] {
  return activeRounds(game).flatMap((r) => r.transactions);
}

export function gameBalances(game: GameSession) {
  return computeBalances(game.players, activeRounds(game));
}

export function roundNet(game: GameSession, round: Round): Record<PlayerId, Cents> {
  return netByPlayer(
    round.transactions,
    game.players.map((p) => p.id),
  );
}

export interface RoundPreview {
  scored: ScoredRound;
  transactions: LedgerTransaction[];
  net: Record<PlayerId, Cents>;
  validation: LedgerValidation;
  config: ScoringConfiguration;
}

/** Score a round without saving it — used for the payment preview. */
export function previewRound(
  game: GameSession,
  input: RoundInput,
  config: ScoringConfiguration = game.config,
  roundId: RoundId = 'preview',
): Result<RoundPreview> {
  const scored = scoreRound(input, { players: game.players, config });
  if (!scored.ok) return scored;
  const transactions = toTransactions(roundId, scored.value.transfers);
  const playerIds = game.players.map((p) => p.id);
  const validation = validateLedger(transactions, { playerIds, roundIds: [roundId] });
  if (!validation.ok) {
    return { ok: false, errors: validation.issues.filter((i) => i.severity === 'error') };
  }
  return {
    ok: true,
    value: { scored: scored.value, transactions, net: netByPlayer(transactions, playerIds), validation, config },
  };
}

/** Validate the whole game ledger after an operation; reject the operation if it would corrupt it. */
function guardLedger(game: GameSession): ValidationIssue[] {
  const active = activeRounds(game);
  const v = validateLedger(gameLedger(game), {
    playerIds: game.players.map((p) => p.id),
    roundIds: active.map((r) => r.id),
  });
  return v.ok ? [] : v.issues.filter((i) => i.severity === 'error');
}

function commit(game: GameSession, ctx: OpContext): Result<GameSession> {
  const issues = guardLedger(game);
  if (issues.length) return { ok: false, errors: issues };
  return { ok: true, value: { ...game, updatedAt: ctx.now } };
}

export function recordRound(
  game: GameSession,
  input: RoundInput,
  ctx: OpContext,
): Result<{ game: GameSession; round: Round }> {
  if (game.status !== 'active') return fail('GAME_FINISHED', 'This game is finished. Reopen it to record more rounds.');
  const roundId = ctx.newId();
  const preview = previewRound(game, input, game.config, roundId);
  if (!preview.ok) return preview;
  const round: Round = {
    id: roundId,
    seq: game.nextSeq,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    input: cloneInput(input),
    configSnapshot: cloneConfig(game.config),
    playersSnapshot: game.players.map((p) => ({ ...p })),
    transactions: preview.value.transactions,
    ...(preview.value.scored.effectiveTai !== undefined ? { effectiveTai: preview.value.scored.effectiveTai } : {}),
    notes: preview.value.scored.notes,
    revisions: [{ at: ctx.now, action: 'created', ...byOf(ctx) }],
  };
  const next = commit({ ...game, rounds: [...game.rounds, round], nextSeq: game.nextSeq + 1 }, ctx);
  if (!next.ok) return next;
  return { ok: true, value: { game: next.value, round } };
}

export interface EditOptions {
  /** Which rules to score the edited round with. Defaults to the round's own snapshot. */
  rules?: 'snapshot' | 'current';
}

export function previewEdit(
  game: GameSession,
  roundId: RoundId,
  input: RoundInput,
  options: EditOptions = {},
): Result<RoundPreview> {
  const round = game.rounds.find((r) => r.id === roundId);
  if (!round) return fail('ROUND_NOT_FOUND', 'That round no longer exists.');
  const config = options.rules === 'current' ? game.config : round.configSnapshot;
  return previewRound(game, input, config, roundId);
}

export function editRound(
  game: GameSession,
  roundId: RoundId,
  input: RoundInput,
  ctx: OpContext,
  options: EditOptions = {},
): Result<{ game: GameSession; round: Round }> {
  const existing = game.rounds.find((r) => r.id === roundId);
  if (!existing) return fail('ROUND_NOT_FOUND', 'That round no longer exists.');
  if (existing.deletedAt) return fail('ROUND_DELETED', 'Restore this round before editing it.');
  const preview = previewEdit(game, roundId, input, options);
  if (!preview.ok) return preview;
  const { effectiveTai: _drop, ...rest } = existing;
  const round: Round = {
    ...rest,
    updatedAt: ctx.now,
    input: cloneInput(input),
    configSnapshot: cloneConfig(preview.value.config),
    playersSnapshot: game.players.map((p) => ({ ...p })),
    transactions: preview.value.transactions,
    ...(preview.value.scored.effectiveTai !== undefined ? { effectiveTai: preview.value.scored.effectiveTai } : {}),
    notes: preview.value.scored.notes,
    revisions: [...existing.revisions, { at: ctx.now, action: 'edited', previousNet: roundNet(game, existing), ...byOf(ctx) }],
  };
  const next = commit({ ...game, rounds: game.rounds.map((r) => (r.id === roundId ? round : r)) }, ctx);
  if (!next.ok) return next;
  return { ok: true, value: { game: next.value, round } };
}

export function deleteRound(game: GameSession, roundId: RoundId, ctx: OpContext): Result<GameSession> {
  const existing = game.rounds.find((r) => r.id === roundId);
  if (!existing) return fail('ROUND_NOT_FOUND', 'That round no longer exists.');
  if (existing.deletedAt) return fail('ROUND_ALREADY_DELETED', 'That round is already deleted.');
  const round: Round = {
    ...existing,
    deletedAt: ctx.now,
    updatedAt: ctx.now,
    revisions: [...existing.revisions, { at: ctx.now, action: 'deleted', previousNet: roundNet(game, existing), ...byOf(ctx) }],
  };
  return commit({ ...game, rounds: game.rounds.map((r) => (r.id === roundId ? round : r)) }, ctx);
}

export function restoreRound(game: GameSession, roundId: RoundId, ctx: OpContext): Result<GameSession> {
  const existing = game.rounds.find((r) => r.id === roundId);
  if (!existing) return fail('ROUND_NOT_FOUND', 'That round no longer exists.');
  if (!existing.deletedAt) return fail('ROUND_NOT_DELETED', 'That round is not deleted.');
  const { deletedAt: _d, ...rest } = existing;
  const round: Round = {
    ...rest,
    updatedAt: ctx.now,
    revisions: [...existing.revisions, { at: ctx.now, action: 'restored', ...byOf(ctx) }],
  };
  return commit({ ...game, rounds: game.rounds.map((r) => (r.id === roundId ? round : r)) }, ctx);
}

/** Undo = soft-delete the most recent active round (restorable). */
export function undoLastRound(game: GameSession, ctx: OpContext): Result<{ game: GameSession; round: Round }> {
  const rounds = activeRounds(game);
  const last = rounds[rounds.length - 1];
  if (!last) return fail('NOTHING_TO_UNDO', 'There are no rounds to undo.');
  const result = deleteRound(game, last.id, ctx);
  if (!result.ok) return result;
  return { ok: true, value: { game: result.value, round: last } };
}

/** Permanently remove soft-deleted rounds (does not affect balances). */
export function purgeDeletedRounds(game: GameSession, ctx: OpContext): GameSession {
  return { ...game, rounds: game.rounds.filter((r) => !r.deletedAt), updatedAt: ctx.now };
}

/** Clear the scoresheet: soft-delete every active round so it can still be restored. */
export function resetGame(game: GameSession, ctx: OpContext): Result<GameSession> {
  let current = game;
  for (const r of activeRounds(game)) {
    const res = deleteRound(current, r.id, ctx);
    if (!res.ok) return res;
    current = res.value;
  }
  return { ok: true, value: current };
}

export function updatePlayers(game: GameSession, players: Player[], ctx: OpContext): Result<GameSession> {
  const issues = validatePlayers(players);
  if (hasErrors(issues)) return { ok: false, errors: issues.filter((i) => i.severity === 'error') };
  const existing = new Set(game.players.map((p) => p.id));
  if (players.some((p) => !existing.has(p.id)) || players.length !== game.players.length) {
    return fail('PLAYERS_CHANGED', 'Players can be renamed or re-seated, but not added or removed mid-game.');
  }
  return commit({ ...game, players: sortPlayersBySeat(players.map((p) => ({ ...p, name: p.name.trim() }))) }, ctx);
}

/** Change the rules for FUTURE rounds. Confirmed rounds keep their snapshot. */
export function updateGameConfig(
  game: GameSession,
  config: ScoringConfiguration,
  ctx: OpContext,
): Result<GameSession> {
  const issues = validateConfig(config);
  if (hasErrors(issues)) return { ok: false, errors: issues.filter((i) => i.severity === 'error') };
  return commit({ ...game, config: cloneConfig(config) }, ctx);
}

export interface RescoreRoundDiff {
  roundId: RoundId;
  before: Record<PlayerId, Cents>;
  after: Record<PlayerId, Cents>;
  changed: boolean;
}

export interface RescorePreview {
  rounds: RescoreRoundDiff[];
  balancesBefore: Record<PlayerId, Cents>;
  balancesAfter: Record<PlayerId, Cents>;
  changedCount: number;
}

/**
 * Preview re-scoring EVERY active round with `config`. This is the only way
 * historical results change because of a rules change, and it must be
 * explicitly confirmed by the user.
 */
export function previewRescore(game: GameSession, config: ScoringConfiguration): Result<RescorePreview> {
  const ids = game.players.map((p) => p.id);
  const diffs: RescoreRoundDiff[] = [];
  const errors: ValidationIssue[] = [];
  const numbers = roundNumbers(game);
  const after: Record<PlayerId, Cents> = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const round of activeRounds(game)) {
    const p = previewRound(game, round.input, config, round.id);
    if (!p.ok) {
      errors.push(
        ...p.errors.map((e) => ({ ...e, roundId: round.id, message: `Round ${numbers.get(round.id)}: ${e.message}` })),
      );
      continue;
    }
    const before = roundNet(game, round);
    const changed = ids.some((id) => before[id] !== p.value.net[id]);
    diffs.push({ roundId: round.id, before, after: p.value.net, changed });
    for (const id of ids) after[id] = (after[id] ?? 0) + (p.value.net[id] ?? 0);
  }
  if (errors.length) return { ok: false, errors };
  const balancesBefore = Object.fromEntries(gameBalances(game).map((b) => [b.playerId, b.netCents]));
  return {
    ok: true,
    value: { rounds: diffs, balancesBefore, balancesAfter: after, changedCount: diffs.filter((d) => d.changed).length },
  };
}

export function applyRescore(game: GameSession, config: ScoringConfiguration, ctx: OpContext): Result<GameSession> {
  const preview = previewRescore(game, config);
  if (!preview.ok) return preview;
  let rounds = game.rounds;
  for (const round of activeRounds(game)) {
    const p = previewRound(game, round.input, config, round.id);
    if (!p.ok) return p;
    const { effectiveTai: _drop, ...rest } = round;
    const updated: Round = {
      ...rest,
      updatedAt: ctx.now,
      configSnapshot: cloneConfig(config),
      playersSnapshot: game.players.map((pl) => ({ ...pl })),
      transactions: p.value.transactions,
      ...(p.value.scored.effectiveTai !== undefined ? { effectiveTai: p.value.scored.effectiveTai } : {}),
      notes: p.value.scored.notes,
      revisions: [...round.revisions, { at: ctx.now, action: 'rescored', previousNet: roundNet(game, round), ...byOf(ctx) }],
    };
    rounds = rounds.map((r) => (r.id === round.id ? updated : r));
  }
  return commit({ ...game, rounds, config: cloneConfig(config) }, ctx);
}

export function finishGame(game: GameSession, ctx: OpContext): GameSession {
  return { ...game, status: 'finished', finishedAt: ctx.now, updatedAt: ctx.now };
}

export function reopenGame(game: GameSession, ctx: OpContext): GameSession {
  const { finishedAt: _f, ...rest } = game;
  return { ...rest, status: 'active', updatedAt: ctx.now };
}

/**
 * Suggest the dealer for the next round (UI default only — no financial
 * effect unless dealer rules are configured). Assumption: the dealer keeps
 * the deal after winning or after a drawn round; otherwise the deal passes
 * to the next seat (East → South → West → North).
 */
export function suggestNextDealer(game: GameSession): PlayerId | undefined {
  const rounds = activeRounds(game);
  const last = rounds[rounds.length - 1];
  if (!last) return game.initialDealerId;
  const dealer = last.input.dealerId;
  if (!dealer) return undefined;
  const o = last.input.outcome;
  if (o.type === 'draw' || o.winnerId === dealer) return dealer;
  const players = sortPlayersBySeat(game.players);
  const idx = players.findIndex((p) => p.id === dealer);
  if (idx < 0) return undefined;
  return players[(idx + 1) % players.length]!.id;
}

export interface GameStats {
  roundsPlayed: number;
  wins: number;
  draws: number;
  biggestWin?: { roundId: RoundId; winnerId: PlayerId; amountCents: Cents };
  totalMovedCents: Cents;
}

export function gameStats(game: GameSession): GameStats {
  const rounds = activeRounds(game);
  let biggestWin: GameStats['biggestWin'];
  let totalMoved = 0;
  let wins = 0;
  for (const r of rounds) {
    totalMoved += r.transactions.reduce((a, t) => a + t.amountCents, 0);
    const o = r.input.outcome;
    if (o.type !== 'win') continue;
    wins += 1;
    const net = roundNet(game, r)[o.winnerId] ?? 0;
    if (!biggestWin || net > biggestWin.amountCents) biggestWin = { roundId: r.id, winnerId: o.winnerId, amountCents: net };
  }
  return {
    roundsPlayed: rounds.length,
    wins,
    draws: rounds.length - wins,
    ...(biggestWin ? { biggestWin } : {}),
    totalMovedCents: totalMoved,
  };
}
