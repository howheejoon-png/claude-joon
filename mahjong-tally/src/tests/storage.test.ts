import { afterEach, describe, expect, it } from 'vitest';
import { checkGameHealth } from '../engine/audit';
import { gameBalances, recordRound } from '../engine/game';
import type { GameSession } from '../models/types';
import { TallyStorage } from '../storage/db';
import { BACKUP_FORMAT, migrateGameDocument, parseBackup } from '../storage/schema';
import { config, discard, makeCtx, newGame, selfDraw, unwrap } from './helpers';

let dbCounter = 0;
const opened: TallyStorage[] = [];
function freshName() {
  dbCounter += 1;
  return `test-db-${dbCounter}`;
}
function open(name: string) {
  const s = new TallyStorage(name);
  opened.push(s);
  return s;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((s) => s.close()));
});

function sampleGame(prefix = 'g'): GameSession {
  const ctx = makeCtx(prefix);
  let g = newGame(config(), ctx);
  g = unwrap(recordRound(g, selfDraw('a', 3), ctx())).game;
  g = unwrap(recordRound(g, discard('b', 'c', 2), ctx())).game;
  return g;
}

describe('TallyStorage (IndexedDB)', () => {
  it('saves and loads a game exactly', async () => {
    const s = open(freshName());
    const g = sampleGame();
    await s.saveGame(g);
    expect(await s.loadGame(g.id)).toEqual(g);
    expect(await s.loadGame('missing')).toBeNull();
  });

  it('restores the session after the app is closed and reopened', async () => {
    const name = freshName();
    const first = open(name);
    const g = sampleGame();
    await first.saveGame(g);
    await first.saveSettings({ activeGameId: g.id, theme: 'dark', lastPlayerNames: ['Ann', 'Ben', 'Cal', 'Dee'] });
    await first.close();

    const second = open(name); // simulates a page refresh / app restart
    const settings = await second.loadSettings();
    expect(settings.activeGameId).toBe(g.id);
    expect(settings.theme).toBe('dark');
    expect(settings.lastPlayerNames).toEqual(['Ann', 'Ben', 'Cal', 'Dee']);
    const restored = await second.loadGame(settings.activeGameId!);
    expect(restored).toEqual(g);
    expect(gameBalances(restored!)).toEqual(gameBalances(g));
    expect(checkGameHealth(restored!).ok).toBe(true);
  });

  it('keeps multiple saved games, most recently updated first', async () => {
    const s = open(freshName());
    const g1 = { ...sampleGame('x'), updatedAt: '2026-01-01T00:00:00.000Z' };
    const g2 = { ...sampleGame('y'), updatedAt: '2026-02-01T00:00:00.000Z' };
    await s.saveGame(g1);
    await s.saveGame(g2);
    const { games, unreadable } = await s.loadGames();
    expect(games.map((g) => g.id)).toEqual([g2.id, g1.id]);
    expect(unreadable).toEqual([]);
  });

  it('autosave overwrites the same record after each round', async () => {
    const s = open(freshName());
    const ctx = makeCtx('z');
    let g = newGame(config(), ctx);
    await s.saveGame(g);
    g = unwrap(recordRound(g, selfDraw('a', 1), ctx())).game;
    await s.saveGame(g);
    const { games } = await s.loadGames();
    expect(games).toHaveLength(1);
    expect(games[0]!.rounds).toHaveLength(1);
  });

  it('settings default sensibly and merge patches', async () => {
    const s = open(freshName());
    expect(await s.loadSettings()).toEqual({
      theme: 'system',
      houseRules: null,
      houseRulesConfirmedAt: null,
      activeGameId: null,
      lastPlayerNames: [],
      deviceId: null,
      identities: {},
    });
    await s.saveSettings({ theme: 'light' });
    const rules = config();
    await s.saveSettings({ houseRules: rules, houseRulesConfirmedAt: '2026-01-01T00:00:00.000Z' });
    const loaded = await s.loadSettings();
    expect(loaded.theme).toBe('light');
    expect(loaded.houseRules).toEqual(rules);
  });

  it('deleting the active game clears activeGameId', async () => {
    const s = open(freshName());
    const g = sampleGame();
    await s.saveGame(g);
    await s.saveSettings({ activeGameId: g.id });
    await s.deleteGame(g.id);
    expect(await s.loadGame(g.id)).toBeNull();
    expect((await s.loadSettings()).activeGameId).toBeNull();
  });

  it('reports unreadable records without deleting them', async () => {
    const s = open(freshName());
    await s.saveGame({ ...sampleGame(), schemaVersion: 99 } as unknown as GameSession);
    const { games, unreadable } = await s.loadGames();
    expect(games).toEqual([]);
    expect(unreadable).toHaveLength(1);
    expect(unreadable[0]!.reason).toMatch(/newer version/);
  });

  it('export → parse → import round-trips all games and house rules', async () => {
    const source = open(freshName());
    const g1 = sampleGame('p');
    const g2 = sampleGame('q');
    await source.saveGame(g1);
    await source.saveGame(g2);
    await source.saveSettings({ houseRules: config(), houseRulesConfirmedAt: '2026-01-01T00:00:00.000Z' });
    const backup = await source.exportBackup('2026-03-01T00:00:00.000Z');
    expect(backup.format).toBe(BACKUP_FORMAT);

    // Through JSON, as a real file would be.
    const parsed = unwrap(parseBackup(JSON.parse(JSON.stringify(backup))));
    expect(parsed.games).toHaveLength(2);

    const target = open(freshName());
    const existing = sampleGame('r');
    await target.saveGame(existing);
    expect(await target.importBackup(parsed, 'merge')).toBe(2);
    expect((await target.loadGames()).games).toHaveLength(3);
    expect((await target.loadSettings()).houseRules).toEqual(config());

    const replaced = open(freshName());
    await replaced.saveGame(existing);
    await replaced.saveSettings({ activeGameId: existing.id });
    await replaced.importBackup(parsed, 'replace');
    const after = await replaced.loadGames();
    expect(after.games.map((g) => g.id).sort()).toEqual([g1.id, g2.id].sort());
    expect((await replaced.loadSettings()).activeGameId).toBeNull();
    expect(await replaced.loadGame(g1.id)).toEqual(g1);
  });
});

describe('backup parsing and migrations', () => {
  it('rejects files that are not backups or are too new', () => {
    expect(parseBackup({ hello: 'world' }).ok).toBe(false);
    expect(parseBackup(null).ok).toBe(false);
    expect(parseBackup({ format: BACKUP_FORMAT, version: 99, games: [] }).ok).toBe(false);
    expect(parseBackup({ format: BACKUP_FORMAT, version: 1 }).ok).toBe(false);
  });

  it('rejects a backup whose game ledger has been tampered with', () => {
    const g = JSON.parse(JSON.stringify(sampleGame())) as GameSession;
    g.rounds[0]!.transactions[0]!.amountCents += 1;
    const res = parseBackup({ format: BACKUP_FORMAT, version: 1, games: [g], settings: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]!.code).toBe('BACKUP_GAME_CORRUPT');
  });

  it('rejects a backup with invalid house rules', () => {
    const res = parseBackup({
      format: BACKUP_FORMAT,
      version: 1,
      games: [],
      settings: { houseRules: { ...config(), minTai: 9, maxTai: 1 } },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects malformed game records', () => {
    const res = parseBackup({ format: BACKUP_FORMAT, version: 1, games: [{ id: 'x', name: 'Bad', players: [] }] });
    expect(res.ok).toBe(false);
  });

  it('migrates a version-0 game document to the current schema', () => {
    const g = sampleGame();
    const v0 = JSON.parse(JSON.stringify(g)) as Record<string, unknown>;
    delete v0.schemaVersion;
    delete v0.nextSeq;
    delete v0.status;
    for (const r of v0.rounds as Record<string, unknown>[]) {
      delete r.seq;
      delete r.playersSnapshot;
      delete r.revisions;
      delete r.notes;
    }
    const migrated = unwrap(migrateGameDocument(v0));
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.nextSeq).toBe(3);
    expect(migrated.status).toBe('active');
    expect(migrated.rounds.map((r) => r.seq)).toEqual([1, 2]);
    expect(migrated.rounds[0]!.playersSnapshot).toEqual(g.players);
    expect(migrated.rounds[0]!.revisions[0]!.action).toBe('created');
    expect(checkGameHealth(migrated).ok).toBe(true);
    expect(gameBalances(migrated)).toEqual(gameBalances(g));
  });

  it('refuses to guess at documents from a newer schema', () => {
    const res = migrateGameDocument({ ...sampleGame(), schemaVersion: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]!.code).toBe('GAME_TOO_NEW');
  });

  it('leaves current documents untouched', () => {
    const g = sampleGame();
    expect(unwrap(migrateGameDocument(g))).toEqual(g);
  });
});

describe('migration never silently drops data', () => {
  it('a v0 document without a rounds list is rejected, not treated as empty', () => {
    const g = JSON.parse(JSON.stringify(sampleGame())) as Record<string, unknown>;
    delete g.schemaVersion;
    delete g.rounds;
    const res = migrateGameDocument(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.map((e) => e.code)).toContain('GAME_ROUNDS');
  });
});
