/**
 * Document-level schema handling: structural checks and migrations for game
 * documents read from IndexedDB or from an imported backup file.
 */
import { checkGameHealth } from '../engine/audit';
import { validateConfig } from '../engine/validation';
import type { GameSession, Result, ScoringConfiguration, ValidationIssue } from '../models/types';

export const CURRENT_GAME_SCHEMA = 1;
export const BACKUP_FORMAT = 'mahjong-tally-backup';
export const BACKUP_VERSION = 1;

export type ThemePreference = 'system' | 'dark' | 'light';

export interface AppSettings {
  theme: ThemePreference;
  /** Default house rules for new games (null until the group confirms rules). */
  houseRules: ScoringConfiguration | null;
  houseRulesConfirmedAt: string | null;
  activeGameId: string | null;
  lastPlayerNames: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  houseRules: null,
  houseRulesConfirmedAt: null,
  activeGameId: null,
  lastPlayerNames: [],
};

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: 'Mahjong Tally';
  settings: Pick<AppSettings, 'theme' | 'houseRules' | 'houseRulesConfirmedAt' | 'lastPlayerNames'>;
  games: GameSession[];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function err(code: string, message: string): ValidationIssue {
  return { code, message, severity: 'error' };
}

/**
 * Upgrade a raw game document to the current schema. Version 0 documents
 * (pre-release exports without `schemaVersion`, `nextSeq`, `playersSnapshot`
 * or `revisions`) are upgraded deterministically; anything newer than this
 * build understands is rejected rather than guessed at.
 */
export function migrateGameDocument(raw: unknown): Result<GameSession> {
  if (!isObject(raw)) return { ok: false, errors: [err('GAME_MALFORMED', 'A saved game is not a valid record.')] };
  const doc: Record<string, unknown> = { ...raw };
  const version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0;
  if (version > CURRENT_GAME_SCHEMA) {
    return {
      ok: false,
      errors: [err('GAME_TOO_NEW', `Game “${String(doc.name)}” was saved by a newer version of Mahjong Tally. Update the app first.`)],
    };
  }
  if (version < 1) {
    // A missing rounds list is NOT treated as "no rounds" — that would silently
    // drop data. It is left as-is so the structural check below rejects it.
    if (Array.isArray(doc.rounds)) {
      const players = Array.isArray(doc.players) ? doc.players : [];
      doc.rounds = (doc.rounds as unknown[]).map((r, i) =>
        isObject(r)
          ? {
              ...r,
              seq: typeof r.seq === 'number' ? r.seq : i + 1,
              playersSnapshot: Array.isArray(r.playersSnapshot) ? r.playersSnapshot : players,
              revisions: Array.isArray(r.revisions) ? r.revisions : [{ at: r.createdAt ?? doc.createdAt, action: 'created' }],
              notes: Array.isArray(r.notes) ? r.notes : [],
            }
          : r,
      );
      if (typeof doc.nextSeq !== 'number') {
        doc.nextSeq =
          (doc.rounds as unknown[]).reduce<number>((m, r) => (isObject(r) && typeof r.seq === 'number' ? Math.max(m, r.seq) : m), 0) + 1;
      }
    }
    doc.status = doc.status === 'finished' ? 'finished' : 'active';
    doc.schemaVersion = 1;
  }
  const structural = checkGameStructure(doc);
  if (structural.length) return { ok: false, errors: structural };
  return { ok: true, value: doc as unknown as GameSession };
}

/** Shallow structural validation of a game document. */
export function checkGameStructure(doc: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = typeof doc.name === 'string' ? doc.name : 'Untitled';
  if (typeof doc.id !== 'string' || doc.id === '') issues.push(err('GAME_ID', `Game “${name}” has no id.`));
  if (!Array.isArray(doc.players) || doc.players.length !== 4) {
    issues.push(err('GAME_PLAYERS', `Game “${name}” must have exactly four players.`));
  } else if (!doc.players.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.seat === 'string')) {
    issues.push(err('GAME_PLAYERS', `Game “${name}” has an invalid player record.`));
  }
  if (!isObject(doc.config)) issues.push(err('GAME_CONFIG', `Game “${name}” has no scoring rules.`));
  else if (validateConfig(doc.config as unknown as ScoringConfiguration).some((i) => i.severity === 'error'))
    issues.push(err('GAME_CONFIG', `Game “${name}” has invalid scoring rules.`));
  if (!Array.isArray(doc.rounds)) {
    issues.push(err('GAME_ROUNDS', `Game “${name}” has no rounds list.`));
  } else {
    const ids = new Set<string>();
    doc.rounds.forEach((r, i) => {
      if (
        !isObject(r) ||
        typeof r.id !== 'string' ||
        ids.has(r.id) ||
        typeof r.seq !== 'number' ||
        !isObject(r.input) ||
        !isObject(r.configSnapshot) ||
        !Array.isArray(r.transactions) ||
        !Array.isArray(r.playersSnapshot)
      ) {
        issues.push(err('GAME_ROUND', `Game “${name}”: round record ${i + 1} is malformed.`));
        return;
      }
      ids.add(r.id);
    });
  }
  if (typeof doc.nextSeq !== 'number') issues.push(err('GAME_SEQ', `Game “${name}” is missing its round counter.`));
  return issues;
}

/**
 * Parse and fully verify a backup file. Every game is migrated, structurally
 * checked, and its ledger validated and audited. Corrupted data is rejected
 * with an explanation — it is never silently repaired.
 */
export function parseBackup(raw: unknown): Result<BackupFile> {
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, errors: [err('BACKUP_FORMAT', 'This file is not a Mahjong Tally backup.')] };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, errors: [err('BACKUP_VERSION', 'This backup was made by a newer version of Mahjong Tally.')] };
  }
  if (!Array.isArray(raw.games)) return { ok: false, errors: [err('BACKUP_GAMES', 'The backup contains no games list.')] };
  const errors: ValidationIssue[] = [];
  const games: GameSession[] = [];
  for (const g of raw.games) {
    const migrated = migrateGameDocument(g);
    if (!migrated.ok) {
      errors.push(...migrated.errors);
      continue;
    }
    const health = checkGameHealth(migrated.value);
    if (!health.ok) {
      errors.push(
        err(
          'BACKUP_GAME_CORRUPT',
          `Game “${migrated.value.name}” failed its balance check: ${health.issues.find((i) => i.severity === 'error')?.message ?? 'unknown problem'}`,
        ),
      );
      continue;
    }
    games.push(migrated.value);
  }
  if (errors.length) return { ok: false, errors };

  const s = isObject(raw.settings) ? raw.settings : {};
  const theme: ThemePreference = s.theme === 'dark' || s.theme === 'light' ? s.theme : 'system';
  let houseRules: ScoringConfiguration | null = null;
  if (isObject(s.houseRules)) {
    const rules = s.houseRules as unknown as ScoringConfiguration;
    if (validateConfig(rules).some((i) => i.severity === 'error')) {
      return { ok: false, errors: [err('BACKUP_RULES', 'The house rules in this backup are invalid.')] };
    }
    houseRules = rules;
  }
  return {
    ok: true,
    value: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      app: 'Mahjong Tally',
      settings: {
        theme,
        houseRules,
        houseRulesConfirmedAt: houseRules && typeof s.houseRulesConfirmedAt === 'string' ? s.houseRulesConfirmedAt : null,
        lastPlayerNames: Array.isArray(s.lastPlayerNames) ? s.lastPlayerNames.filter((n): n is string => typeof n === 'string') : [],
      },
      games,
    },
  };
}
