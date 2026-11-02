import { cloneConfig, exampleConfiguration } from '../config/defaults';
import { createGame, type OpContext } from '../engine/game';
import type {
  AppliedBonus,
  GameSession,
  ManualAdjustment,
  Player,
  RoundInput,
  ScoringConfiguration,
} from '../models/types';

export const PLAYERS: Player[] = [
  { id: 'a', name: 'Player A', seat: 'east' },
  { id: 'b', name: 'Player B', seat: 'south' },
  { id: 'c', name: 'Player C', seat: 'west' },
  { id: 'd', name: 'Player D', seat: 'north' },
];

/** Deterministic clock + id factory. */
export function makeCtx(prefix = 'id'): () => OpContext {
  let n = 0;
  return () => {
    n += 1;
    const t = n;
    return {
      now: new Date(Date.UTC(2026, 0, 1, 0, 0, 0) + t * 1000).toISOString(),
      newId: () => `${prefix}${t}-${(n += 1)}`,
    };
  };
}

export function config(patch: Partial<ScoringConfiguration> = {}): ScoringConfiguration {
  return { ...cloneConfig(exampleConfiguration()), ...patch };
}

export function newGame(cfg: ScoringConfiguration = config(), ctx = makeCtx()): GameSession {
  const res = createGame({ name: 'Test game', players: PLAYERS, config: cfg }, ctx());
  if (!res.ok) throw new Error(JSON.stringify(res.errors));
  return res.value;
}

export function selfDraw(
  winnerId: string,
  tai: number,
  extra: Partial<RoundInput> & { liablePlayerId?: string } = {},
): RoundInput {
  const { liablePlayerId, ...rest } = extra;
  return {
    outcome: { type: 'win', winnerId, method: 'self_draw', tai, ...(liablePlayerId ? { liablePlayerId } : {}) },
    bonuses: [],
    manualAdjustments: [],
    ...rest,
  };
}

export function discard(winnerId: string, discarderId: string, tai: number, extra: Partial<RoundInput> = {}): RoundInput {
  return {
    outcome: { type: 'win', winnerId, method: 'discard', discarderId, tai },
    bonuses: [],
    manualAdjustments: [],
    ...extra,
  };
}

export function draw(bonuses: AppliedBonus[] = [], manualAdjustments: ManualAdjustment[] = []): RoundInput {
  return { outcome: { type: 'draw' }, bonuses, manualAdjustments };
}

export function unwrap<T>(r: { ok: true; value: T } | { ok: false; errors: unknown }): T {
  if (!r.ok) throw new Error(`Expected ok result, got: ${JSON.stringify(r.errors)}`);
  return r.value;
}

/** Map of payerId -> amount for transfers to a given receiver. */
export function paymentsTo(transfers: { payerId: string; receiverId: string; amountCents: number }[], receiverId: string) {
  const m: Record<string, number> = {};
  for (const t of transfers) if (t.receiverId === receiverId) m[t.payerId] = (m[t.payerId] ?? 0) + t.amountCents;
  return m;
}
