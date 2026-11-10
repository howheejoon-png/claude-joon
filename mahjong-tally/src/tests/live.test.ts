/**
 * Live check against the real sharing database. Skipped unless LIVE_SYNC=1:
 *   LIVE_SYNC=1 npx vitest run src/tests/live.test.ts
 * Creates one throwaway game whose code starts with "livetest".
 */
import { describe, expect, it } from 'vitest';
import { instantPayoutTemplates } from '../config/defaults';
import { checkGameHealth } from '../engine/audit';
import { activeRounds, gameBalances } from '../engine/game';
import { applyOp, type GameOp, type GameOpBody } from '../sync/ops';
import { newShareCode, supabaseTransport } from '../sync/remote';
import { joinShare, shownGame, startShare, syncShare, type ShareState } from '../sync/share';
import { config, discard, draw, newGame, selfDraw } from './helpers';

const live = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.LIVE_SYNC === '1';

describe.skipIf(!live)('live sharing database', () => {
  it('two phones share, record and converge through the real server', async () => {
    const server = supabaseTransport();
    const code = `livetest${newShareCode()}`;
    let n = 0;
    const op = (deviceId: string, body: GameOpBody): GameOp => ({
      v: 1,
      opId: globalThis.crypto.randomUUID(),
      deviceId,
      at: new Date(Date.UTC(2026, 10, 10, 13, 0, (n += 1))).toISOString(),
      body,
    });
    const act = (share: ShareState, deviceId: string, body: GameOpBody): ShareState => {
      const o = op(deviceId, body);
      const r = applyOp(shownGame(share), o);
      if (!r.ok) throw new Error(r.errors[0]?.message);
      return { ...share, pending: [...share.pending, o] };
    };

    const base = newGame(config({ bonusRules: instantPayoutTemplates(300) }));
    let a = startShare(base, code, op('live-a', { type: 'snapshot', game: base }), new Date().toISOString());
    const first = await syncShare(a, server, 'live-a');
    expect(first.error).toBeUndefined();
    a = first.share;
    expect(a.pending).toHaveLength(0);
    expect(a.lastSeq).toBeGreaterThan(0);

    const joined = await joinShare(code, server, 'live-b', new Date().toISOString());
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    let b = joined.share;

    a = act(a, 'live-a', { type: 'record', roundId: 'live-r1', input: selfDraw('a', 3) });
    b = act(b, 'live-b', { type: 'record', roundId: 'live-r2', input: discard('b', 'c', 1) });
    b = act(b, 'live-b', { type: 'record', roundId: 'live-r3', input: draw([{ ruleId: 'sg-kong-discard', count: 1, playerId: 'd', fromPlayerId: 'a' }]) });
    for (let i = 0; i < 2; i += 1) {
      const ra = await syncShare(a, server, 'live-a');
      expect(ra.error).toBeUndefined();
      a = ra.share;
      const rb = await syncShare(b, server, 'live-b');
      expect(rb.error).toBeUndefined();
      b = rb.share;
    }
    const ga = shownGame(a)!;
    const gb = shownGame(b)!;
    expect(activeRounds(ga).map((r) => r.id)).toEqual(['live-r1', 'live-r2', 'live-r3']);
    expect(JSON.stringify(ga.rounds)).toBe(JSON.stringify(gb.rounds));
    expect(checkGameHealth(ga).ok).toBe(true);
    expect(gameBalances(ga).reduce((s, x) => s + x.netCents, 0)).toBe(0);

    // Retrying an op that is already stored returns the same sequence number and adds nothing.
    const rows = await server.fetchAfter(code, 0);
    expect(rows).toHaveLength(4);
    expect(await server.append(code, rows[1]!.op)).toBe(rows[1]!.seq);
    expect(await server.fetchAfter(code, 0)).toHaveLength(4);
  }, 60_000);
});
