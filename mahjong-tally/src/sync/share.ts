/**
 * Shared-game sync. State per shared game on this phone:
 *
 *   confirmed = replay of every server op up to `lastSeq` (authoritative)
 *   pending   = this phone's ops not yet seen back from the server
 *   shown     = replay(confirmed, pending)  — what the screen displays
 *
 * A sync pushes every pending op (idempotent), pulls everything after
 * `lastSeq`, replays it onto `confirmed`, and drops pending ops that came
 * back. Every phone replays the same ordered log through the same pure engine,
 * so every phone ends with the identical ledger. Nothing here touches React,
 * storage or the clock.
 */
import type { GameSession } from '../models/types';
import { applyOp, foldOps, type GameOp } from './ops';
import { TransportError, type SyncTransport } from './remote';

export interface ShareState {
  gameId: string;
  code: string;
  lastSeq: number;
  confirmed: GameSession | null;
  pending: GameOp[];
  createdAt: string;
}

export interface SyncOutcome {
  share: ShareState;
  /** Game to display (confirmed + pending), or null if nothing exists yet. */
  game: GameSession | null;
  /** This phone's ops that the shared log rejected (e.g. edited a round someone deleted). */
  rejectedMine: { op: GameOp; message: string }[];
  /** How many ops from other phones arrived. */
  fromOthers: number;
  error?: TransportError;
}

export function shownGame(share: ShareState): GameSession | null {
  return foldOps(share.confirmed, share.pending).game;
}

/** Fold newly pulled server ops into a share; pure. */
export function absorbRemote(
  share: ShareState,
  rows: readonly { seq: number; op: GameOp }[],
  deviceId: string,
): Omit<SyncOutcome, 'error'> {
  const sorted = [...rows].filter((r) => r.seq > share.lastSeq).sort((a, b) => a.seq - b.seq);
  let confirmed = share.confirmed;
  const rejectedMine: SyncOutcome['rejectedMine'] = [];
  let fromOthers = 0;
  const seen = new Set<string>();
  let lastSeq = share.lastSeq;
  for (const row of sorted) {
    seen.add(row.op?.opId);
    lastSeq = Math.max(lastSeq, row.seq);
    const mine = row.op?.deviceId === deviceId;
    if (!mine) fromOthers += 1;
    const r = applyOp(confirmed, row.op);
    if (r.ok) confirmed = r.value;
    else if (mine) rejectedMine.push({ op: row.op, message: r.errors[0]?.message ?? 'Change could not be applied.' });
  }
  const next: ShareState = {
    ...share,
    lastSeq,
    confirmed,
    pending: share.pending.filter((op) => !seen.has(op.opId)),
  };
  return { share: next, game: shownGame(next), rejectedMine, fromOthers };
}

/** Push pending ops, then pull and replay everything new. Never throws. */
export async function syncShare(share: ShareState, transport: SyncTransport, deviceId: string): Promise<SyncOutcome> {
  try {
    for (const op of share.pending) await transport.append(share.code, op);
    const rows = await transport.fetchAfter(share.code, share.lastSeq);
    return absorbRemote(share, rows, deviceId);
  } catch (e) {
    const error = e instanceof TransportError ? e : new TransportError('unavailable', e instanceof Error ? e.message : String(e));
    return { share, game: shownGame(share), rejectedMine: [], fromOthers: 0, error };
  }
}

/** Start sharing a local game: its full state becomes the log's first op. */
export function startShare(game: GameSession, code: string, snapshotOp: GameOp, now: string): ShareState {
  if (snapshotOp.body.type !== 'snapshot') throw new Error('startShare needs a snapshot op');
  return { gameId: game.id, code, lastSeq: 0, confirmed: null, pending: [snapshotOp], createdAt: now };
}

export type JoinResult =
  | { ok: true; share: ShareState; game: GameSession }
  | { ok: false; reason: 'not_found' | 'unreadable'; message: string }
  | { ok: false; reason: 'network'; message: string; error: TransportError };

/** Join a shared game from its code by replaying its whole log. */
export async function joinShare(code: string, transport: SyncTransport, deviceId: string, now: string): Promise<JoinResult> {
  let rows;
  try {
    rows = await transport.fetchAfter(code, 0);
  } catch (e) {
    const error = e instanceof TransportError ? e : new TransportError('unavailable', String(e));
    return { ok: false, reason: 'network', message: error.message, error };
  }
  if (rows.length === 0) {
    return { ok: false, reason: 'not_found', message: 'This game link doesn’t match any shared game. Ask for the link again.' };
  }
  const empty: ShareState = { gameId: '', code, lastSeq: 0, confirmed: null, pending: [], createdAt: now };
  const absorbed = absorbRemote(empty, rows, deviceId);
  const game = absorbed.share.confirmed;
  if (!game) return { ok: false, reason: 'unreadable', message: 'This shared game could not be read. Update the app and try again.' };
  return { ok: true, share: { ...absorbed.share, gameId: game.id }, game };
}
