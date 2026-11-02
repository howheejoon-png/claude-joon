/**
 * IndexedDB persistence (via `idb`). The database schema is versioned; each
 * upgrade step runs in order so a device on any older version is migrated
 * forward. Data never leaves the device.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GameSession } from '../models/types';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_SETTINGS,
  migrateGameDocument,
  type AppSettings,
  type BackupFile,
} from './schema';

export const DB_NAME = 'mahjong-tally';
export const DB_VERSION = 1;

interface TallyDB extends DBSchema {
  games: {
    key: string;
    value: GameSession;
    indexes: { byUpdatedAt: string };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

type Migration = (db: IDBPDatabase<TallyDB>) => void;

/** Ordered schema migrations. Index i upgrades from version i to i + 1. */
const MIGRATIONS: Migration[] = [
  (db) => {
    const games = db.createObjectStore('games', { keyPath: 'id' });
    games.createIndex('byUpdatedAt', 'updatedAt');
    db.createObjectStore('settings');
  },
];

export interface LoadedGames {
  games: GameSession[];
  /** Records that could not be read (kept in storage untouched, reported to the user). */
  unreadable: { id: string; reason: string }[];
}

export class TallyStorage {
  private dbPromise: Promise<IDBPDatabase<TallyDB>> | null = null;

  constructor(private readonly dbName: string = DB_NAME) {}

  private db(): Promise<IDBPDatabase<TallyDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<TallyDB>(this.dbName, DB_VERSION, {
        upgrade(db, oldVersion) {
          for (let v = oldVersion; v < DB_VERSION; v += 1) MIGRATIONS[v]!(db);
        },
      }).then((db) => {
        // If a newer version of the app (another tab) needs to upgrade, step aside.
        db.addEventListener('versionchange', () => {
          db.close();
          this.dbPromise = null;
        });
        return db;
      });
    }
    return this.dbPromise;
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      (await this.dbPromise).close();
      this.dbPromise = null;
    }
  }

  async loadSettings(): Promise<AppSettings> {
    const db = await this.db();
    const stored = (await db.get('settings', 'app')) as Partial<AppSettings> | undefined;
    return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const db = await this.db();
    const tx = db.transaction('settings', 'readwrite');
    const current = ((await tx.store.get('app')) as Partial<AppSettings> | undefined) ?? {};
    const next: AppSettings = { ...DEFAULT_SETTINGS, ...current, ...patch };
    await tx.store.put(next, 'app');
    await tx.done;
    return next;
  }

  async loadGames(): Promise<LoadedGames> {
    const db = await this.db();
    const raw = await db.getAll('games');
    const games: GameSession[] = [];
    const unreadable: LoadedGames['unreadable'] = [];
    for (const doc of raw) {
      const migrated = migrateGameDocument(doc);
      if (migrated.ok) games.push(migrated.value);
      else unreadable.push({ id: String((doc as { id?: unknown }).id ?? '?'), reason: migrated.errors[0]?.message ?? 'Unknown error' });
    }
    games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { games, unreadable };
  }

  async loadGame(id: string): Promise<GameSession | null> {
    const db = await this.db();
    const doc = await db.get('games', id);
    if (!doc) return null;
    const migrated = migrateGameDocument(doc);
    return migrated.ok ? migrated.value : null;
  }

  async saveGame(game: GameSession): Promise<void> {
    const db = await this.db();
    // Structured clone through IndexedDB; the stored record is a full snapshot of the game.
    await db.put('games', game);
  }

  async deleteGame(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['games', 'settings'], 'readwrite');
    await tx.objectStore('games').delete(id);
    const settings = ((await tx.objectStore('settings').get('app')) as Partial<AppSettings> | undefined) ?? {};
    if (settings.activeGameId === id) {
      await tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...settings, activeGameId: null }, 'app');
    }
    await tx.done;
  }

  async exportBackup(now: string): Promise<BackupFile> {
    const [settings, { games }] = await Promise.all([this.loadSettings(), this.loadGames()]);
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      app: 'Mahjong Tally',
      settings: {
        theme: settings.theme,
        houseRules: settings.houseRules,
        houseRulesConfirmedAt: settings.houseRulesConfirmedAt,
        lastPlayerNames: settings.lastPlayerNames,
      },
      games,
    };
  }

  /**
   * Import an already-verified backup (see `parseBackup`). `merge` keeps
   * existing games and overwrites games with the same id; `replace` deletes
   * all existing games first. Runs in a single transaction: all or nothing.
   */
  async importBackup(backup: BackupFile, mode: 'merge' | 'replace'): Promise<number> {
    const db = await this.db();
    const tx = db.transaction(['games', 'settings'], 'readwrite');
    const gamesStore = tx.objectStore('games');
    if (mode === 'replace') await gamesStore.clear();
    for (const g of backup.games) await gamesStore.put(g);
    const settingsStore = tx.objectStore('settings');
    const current = ((await settingsStore.get('app')) as Partial<AppSettings> | undefined) ?? {};
    const next: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...current,
      ...(backup.settings.houseRules
        ? { houseRules: backup.settings.houseRules, houseRulesConfirmedAt: backup.settings.houseRulesConfirmedAt }
        : {}),
      ...(mode === 'replace' ? { activeGameId: null } : {}),
    };
    await settingsStore.put(next, 'app');
    await tx.done;
    return backup.games.length;
  }
}

/** Ask the browser to keep our storage even under pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Not supported — data is still saved, just evictable.
  }
  return false;
}
