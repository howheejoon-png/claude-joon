/**
 * Transport for shared games: an append-only operation log per game, held in
 * the app's Supabase database and reached through two RPC functions
 * (`mt_append_op`, `mt_get_ops`). The game code in the share link is the only
 * key to a game; the publishable API key below is public by design.
 */
import type { GameOp } from './ops';

export const REMOTE_URL: string =
  (import.meta.env.VITE_SYNC_URL as string | undefined) ?? 'https://yxmzafodsreliuwpjoau.supabase.co';
export const REMOTE_KEY: string =
  (import.meta.env.VITE_SYNC_KEY as string | undefined) ?? 'sb_publishable_F1i8aoBA04Z5iBaquDhsTg_fasVTuIo';

export interface RemoteOp {
  seq: number;
  op: GameOp;
}

export interface SyncTransport {
  /** Append an op; returns its sequence number. Retrying the same op is safe. */
  append(code: string, op: GameOp): Promise<number>;
  /** Ops with a sequence number greater than `afterSeq`, oldest first. */
  fetchAfter(code: string, afterSeq: number): Promise<RemoteOp[]>;
}

export type TransportErrorKind = 'offline' | 'unavailable' | 'rejected';

export class TransportError extends Error {
  constructor(
    readonly kind: TransportErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

const PAGE = 500;

export function supabaseTransport(url = REMOTE_URL, key = REMOTE_KEY, fetchImpl: typeof fetch = (...a) => fetch(...a)): SyncTransport {
  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
    } catch {
      throw new TransportError('offline', 'No internet connection.');
    }
    if (res.ok) return (await res.json()) as T;
    const text = await res.text().catch(() => '');
    if (res.status >= 500 || res.status === 404 || res.status === 401 || res.status === 403) {
      throw new TransportError(
        'unavailable',
        res.status >= 500
          ? 'The sharing server is asleep or unavailable.'
          : 'The sharing server refused the request.',
      );
    }
    throw new TransportError('rejected', `The sharing server rejected a change (${res.status}). ${text.slice(0, 120)}`);
  }

  return {
    async append(code, op) {
      const seq = await rpc<number>('mt_append_op', {
        p_game_id: code,
        p_op_id: op.opId,
        p_device_id: op.deviceId,
        p_payload: op,
      });
      return Number(seq);
    },
    async fetchAfter(code, afterSeq) {
      const all: RemoteOp[] = [];
      let after = afterSeq;
      for (;;) {
        const rows = await rpc<{ seq: number | string; payload: GameOp }[]>('mt_get_ops', {
          p_game_id: code,
          p_after: after,
          p_limit: PAGE,
        });
        for (const row of rows) all.push({ seq: Number(row.seq), op: row.payload });
        if (rows.length < PAGE) break;
        after = Number(rows[rows.length - 1]!.seq);
      }
      return all;
    },
  };
}

/** In-memory transport with the same semantics as the server (tests and offline demos). */
export function memoryTransport(): SyncTransport & { log: Map<string, RemoteOp[]> } {
  const log = new Map<string, RemoteOp[]>();
  const byOpId = new Map<string, { code: string; seq: number }>();
  let seq = 0;
  return {
    log,
    async append(code, op) {
      const existing = byOpId.get(op.opId);
      if (existing) {
        if (existing.code !== code) throw new TransportError('rejected', 'operation id already used');
        return existing.seq;
      }
      seq += 1;
      const list = log.get(code) ?? [];
      list.push({ seq, op: JSON.parse(JSON.stringify(op)) as GameOp });
      log.set(code, list);
      byOpId.set(op.opId, { code, seq });
      return seq;
    },
    async fetchAfter(code, afterSeq) {
      return (log.get(code) ?? []).filter((r) => r.seq > afterSeq).map((r) => ({ seq: r.seq, op: JSON.parse(JSON.stringify(r.op)) as GameOp }));
    },
  };
}

/** Random, unguessable share code (144 bits, URL-safe). */
export function newShareCode(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function isShareCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(code);
}
