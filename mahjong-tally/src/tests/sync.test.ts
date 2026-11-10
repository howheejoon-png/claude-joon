import fc from 'fast-check';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { instantPayoutTemplates } from '../config/defaults';
import { checkGameHealth } from '../engine/audit';
import { activeRounds, gameBalances } from '../engine/game';
import type { GameSession, RoundInput } from '../models/types';
import { TallyStorage } from '../storage/db';
import { applyOp, type GameOp, type GameOpBody } from '../sync/ops';
import { TransportError, memoryTransport, newShareCode, type SyncTransport } from '../sync/remote';
import { joinShare, shownGame, startShare, syncShare, type ShareState } from '../sync/share';
import { config, discard, draw, newGame, selfDraw } from './helpers';

let clock = Date.UTC(2026, 10, 10, 12, 0, 0);
let ids = 0;
const nextAt = () => new Date((clock += 1000)).toISOString();
const nextId = (p = 'op') => `${p}-${(ids += 1)}`;

function op(deviceId: string, body: GameOpBody, author?: string): GameOp {
  return { v: 1, opId: nextId(), deviceId, at: nextAt(), body, ...(author ? { author } : {}) };
}

/** A simulated phone: a share state plus a transport that can be cut off. */
class Phone {
  online = true;
  constructor(
    readonly deviceId: string,
    readonly server: SyncTransport,
    public share: ShareState,
  ) {}
  private get transport(): SyncTransport {
    return {
      append: (code, o) => (this.online ? this.server.append(code, o) : Promise.reject(new TransportError('offline', 'offline'))),
      fetchAfter: (code, s) => (this.online ? this.server.fetchAfter(code, s) : Promise.reject(new TransportError('offline', 'offline'))),
    };
  }
  get game(): GameSession {
    return shownGame(this.share)!;
  }
  /** Make a change locally (exactly what the store does). */
  act(body: GameOpBody, author?: string) {
    const o = op(this.deviceId, body, author);
    const r = applyOp(this.game, o);
    if (!r.ok) return r;
    this.share = { ...this.share, pending: [...this.share.pending, o] };
    return r;
  }
  async sync() {
    const out = await syncShare(this.share, this.transport, this.deviceId);
    this.share = out.share;
    return out;
  }
}

async function tableOf(n: number, cfg = config({ bonusRules: instantPayoutTemplates(300) })) {
  const server = memoryTransport();
  const base = newGame(cfg);
  const code = newShareCode();
  const host = new Phone('phone-0', server, startShare(base, code, op('phone-0', { type: 'snapshot', game: base }), nextAt()));
  await host.sync();
  const phones = [host];
  for (let i = 1; i < n; i += 1) {
    const joined = await joinShare(code, server, `phone-${i}`, nextAt());
    if (!joined.ok) throw new Error(joined.message);
    phones.push(new Phone(`phone-${i}`, server, joined.share));
  }
  return { server, code, phones };
}

const fingerprint = (g: GameSession) =>
  JSON.stringify({
    rounds: g.rounds.map((r) => ({ id: r.id, seq: r.seq, deleted: Boolean(r.deletedAt), tx: r.transactions })),
    players: g.players,
    config: g.config,
    status: g.status,
    name: g.name,
  });

describe('live sharing: ops', () => {
  it('replays a record op with its own round id and author', () => {
    const g = newGame();
    const o = op('dev', { type: 'record', roundId: 'r-fixed', input: selfDraw('a', 1) }, 'Player A');
    const r = applyOp(g, o);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.rounds[0]?.id).toBe('r-fixed');
    expect(r.value.rounds[0]?.createdAt).toBe(o.at);
    expect(r.value.rounds[0]?.revisions[0]).toMatchObject({ action: 'created', by: 'Player A' });
    // Replaying the same op again is rejected, never double-counted.
    expect(applyOp(r.value, o).ok).toBe(false);
  });

  it('rejects malformed, unknown and out-of-place ops without throwing', () => {
    const g = newGame();
    expect(applyOp(g, { v: 1 } as unknown as GameOp).ok).toBe(false);
    expect(applyOp(g, op('d', { type: 'nope' } as unknown as GameOpBody)).ok).toBe(false);
    expect(applyOp(g, op('d', { type: 'snapshot', game: g })).ok).toBe(false); // game already exists
    expect(applyOp(null, op('d', { type: 'record', roundId: 'x', input: selfDraw('a', 1) })).ok).toBe(false);
    expect(applyOp(g, op('d', { type: 'delete', roundId: 'missing' })).ok).toBe(false);
  });
});

describe('live sharing: sync', () => {
  it('phones that record at the same time end with the identical ledger', async () => {
    const { phones } = await tableOf(3);
    const [a, b, c] = phones as [Phone, Phone, Phone];
    // Three phones each record a different hand before anyone syncs.
    expect(a.act({ type: 'record', roundId: 'ra', input: selfDraw('a', 2) }, 'Player A').ok).toBe(true);
    expect(b.act({ type: 'record', roundId: 'rb', input: discard('b', 'c', 1) }, 'Player B').ok).toBe(true);
    expect(c.act({ type: 'record', roundId: 'rc', input: draw([{ ruleId: 'sg-kong-self', count: 1, playerId: 'd' }]) }).ok).toBe(true);
    await b.sync();
    await a.sync();
    await c.sync();
    for (const p of phones) await p.sync();
    const prints = phones.map((p) => fingerprint(p.game));
    expect(new Set(prints).size).toBe(1);
    expect(activeRounds(a.game).map((r) => r.id)).toEqual(['rb', 'ra', 'rc']); // server order
    for (const p of phones) {
      expect(p.share.pending).toHaveLength(0);
      expect(checkGameHealth(p.game).ok).toBe(true);
      expect(gameBalances(p.game).reduce((s, x) => s + x.netCents, 0)).toBe(0);
    }
  });

  it('keeps working offline and catches up when back online', async () => {
    const { phones } = await tableOf(2);
    const [a, b] = phones as [Phone, Phone];
    a.online = false;
    a.act({ type: 'record', roundId: 'r1', input: selfDraw('a', 1) });
    a.act({ type: 'record', roundId: 'r2', input: discard('c', 'a', 3) });
    const offline = await a.sync();
    expect(offline.error?.kind).toBe('offline');
    expect(activeRounds(a.game)).toHaveLength(2); // shown locally
    expect(a.share.pending).toHaveLength(2);
    await b.sync();
    expect(activeRounds(b.game)).toHaveLength(0);
    a.online = true;
    await a.sync();
    await b.sync();
    expect(a.share.pending).toHaveLength(0);
    expect(fingerprint(b.game)).toBe(fingerprint(a.game));
    expect(activeRounds(b.game)).toHaveLength(2);
  });

  it('retrying a push never duplicates a change', async () => {
    const { server, code, phones } = await tableOf(1);
    const [a] = phones as [Phone];
    a.act({ type: 'record', roundId: 'r1', input: selfDraw('a', 1) });
    const pending = a.share.pending[0]!;
    await server.append(code, pending); // first attempt reached the server but the reply was lost
    await a.sync(); // retry
    await a.sync();
    expect((await server.fetchAfter(code, 0)).filter((r) => r.op.opId === pending.opId)).toHaveLength(1);
    expect(activeRounds(a.game)).toHaveLength(1);
  });

  it('a change made impossible by another phone is skipped everywhere and reported to its author', async () => {
    const { phones } = await tableOf(2);
    const [a, b] = phones as [Phone, Phone];
    a.act({ type: 'record', roundId: 'r1', input: selfDraw('a', 1) });
    await a.sync();
    await b.sync();
    // A deletes the round while B (not yet synced) edits it.
    a.act({ type: 'delete', roundId: 'r1' });
    const edited: RoundInput = selfDraw('a', 3);
    expect(b.act({ type: 'edit', roundId: 'r1', input: edited, rules: 'snapshot' }).ok).toBe(true);
    await a.sync();
    const out = await b.sync();
    expect(out.rejectedMine).toHaveLength(1);
    expect(out.rejectedMine[0]?.message).toMatch(/restore/i);
    await a.sync();
    expect(fingerprint(a.game)).toBe(fingerprint(b.game));
    expect(activeRounds(b.game)).toHaveLength(0);
  });

  it('joining an unknown link says so', async () => {
    const r = await joinShare(newShareCode(), memoryTransport(), 'x', nextAt());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('share codes are long, URL-safe and unique', () => {
    const codes = new Set(Array.from({ length: 200 }, () => newShareCode()));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it('random interleavings of phones, syncs and outages always converge to one exact ledger', async () => {
    const playerIds = ['a', 'b', 'c', 'd'];
    const actionArb = fc.record({
      phone: fc.nat(2),
      kind: fc.constantFrom('record', 'record', 'record', 'delete', 'restore', 'edit', 'kong', 'sync', 'sync', 'toggle'),
      x: fc.nat(1000),
      y: fc.nat(1000),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(actionArb, { minLength: 5, maxLength: 40 }), async (actions) => {
        const { phones } = await tableOf(3);
        for (const act of actions) {
          const p = phones[act.phone]!;
          const rounds = p.game.rounds;
          const pick = <T,>(xs: T[], n: number) => xs[n % xs.length]!;
          switch (act.kind) {
            case 'record': {
              const winner = pick(playerIds, act.x);
              const others = playerIds.filter((id) => id !== winner);
              const input = act.y % 2 ? selfDraw(winner, 1 + (act.y % 5)) : discard(winner, pick(others, act.y), 1 + (act.x % 5));
              p.act({ type: 'record', roundId: nextId('r'), input });
              break;
            }
            case 'kong':
              p.act({
                type: 'record',
                roundId: nextId('r'),
                input: draw([{ ruleId: 'sg-kong-discard', count: 1, playerId: pick(playerIds, act.x), fromPlayerId: pick(playerIds, act.x + 1) }]),
              });
              break;
            case 'delete':
              if (rounds.length) p.act({ type: 'delete', roundId: pick(rounds, act.x).id });
              break;
            case 'restore':
              if (rounds.length) p.act({ type: 'restore', roundId: pick(rounds, act.x).id });
              break;
            case 'edit':
              if (rounds.length) p.act({ type: 'edit', roundId: pick(rounds, act.x).id, input: selfDraw(pick(playerIds, act.y), 1 + (act.y % 5)), rules: 'snapshot' });
              break;
            case 'toggle':
              p.online = !p.online;
              break;
            default:
              await p.sync();
          }
          // Every phone's own view is always a valid, balanced ledger.
          expect(gameBalances(p.game).reduce((s, b) => s + b.netCents, 0)).toBe(0);
        }
        for (const p of phones) p.online = true;
        for (let i = 0; i < 2; i += 1) for (const p of phones) await p.sync();
        const prints = phones.map((p) => fingerprint(p.game));
        expect(new Set(prints).size).toBe(1);
        for (const p of phones) {
          expect(p.share.pending).toHaveLength(0);
          expect(checkGameHealth(p.game).ok).toBe(true);
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe('storage v2', () => {
  it('upgrades a version-1 database without losing games, and stores share state', async () => {
    const name = `upgrade-${nextId()}`;
    const g = newGame();
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const games = db.createObjectStore('games', { keyPath: 'id' });
        games.createIndex('byUpdatedAt', 'updatedAt');
        db.createObjectStore('settings');
      },
    });
    await v1.put('games', g);
    await v1.put('settings', { theme: 'dark', activeGameId: g.id }, 'app');
    v1.close();

    const s = new TallyStorage(name);
    const loaded = await s.loadGames();
    expect(loaded.games.map((x) => x.id)).toEqual([g.id]);
    const settings = await s.loadSettings();
    expect(settings).toMatchObject({ theme: 'dark', activeGameId: g.id, deviceId: null, identities: {} });
    expect(await s.loadShares()).toEqual([]);

    const share = startShare(g, newShareCode(), op('d', { type: 'snapshot', game: g }), nextAt());
    await s.saveShare(share, g);
    expect((await s.loadShares())[0]?.code).toBe(share.code);
    await s.deleteGame(g.id);
    expect(await s.loadShares()).toEqual([]);
    expect((await s.loadGames()).games).toEqual([]);
    await s.close();
  });
});
