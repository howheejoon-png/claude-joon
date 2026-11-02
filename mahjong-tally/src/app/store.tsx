/**
 * Application store: holds loaded games and settings, applies pure engine
 * operations, and persists every change to IndexedDB immediately (ordered
 * write queue). UI components never compute money themselves — they call
 * these actions and read balances derived from the ledger.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as ops from '../engine/game';
import type { GameSession, Player, Result, Round, RoundId, RoundInput, ScoringConfiguration } from '../models/types';
import { TallyStorage, requestPersistentStorage } from '../storage/db';
import { DEFAULT_SETTINGS, type AppSettings, type BackupFile, type ThemePreference } from '../storage/schema';
import { newId } from '../utils/id';

export interface RoundDraft {
  /** Round being edited, if any. */
  editingRoundId?: RoundId;
  input: Partial<RoundInputDraft>;
}

/** Loosely-typed in-progress round entry (fields are filled step by step). */
export interface RoundInputDraft {
  kind: 'win' | 'draw';
  winnerId: string;
  method: 'self_draw' | 'discard';
  discarderId: string;
  liablePlayerId: string;
  tai: number;
  dealerId: string;
  bonuses: RoundInput['bonuses'];
  manualAdjustments: RoundInput['manualAdjustments'];
  useCurrentRules: boolean;
}

interface StoreState {
  status: 'loading' | 'ready' | 'error';
  settings: AppSettings;
  games: GameSession[];
  unreadable: { id: string; reason: string }[];
  loadError: string | null;
  saveError: string | null;
  draft: RoundDraft | null;
}

export interface Store extends StoreState {
  activeGame: GameSession | null;
  setTheme(theme: ThemePreference): void;
  saveHouseRules(config: ScoringConfiguration): Promise<void>;
  startGame(params: ops.CreateGameParams): Result<GameSession>;
  openGame(id: string): void;
  closeGame(): void;
  renameGame(id: string, name: string): Result<GameSession>;
  deleteGame(id: string): Promise<void>;
  recordRound(input: RoundInput): Result<{ game: GameSession; round: Round }>;
  editRound(roundId: RoundId, input: RoundInput, options?: ops.EditOptions): Result<{ game: GameSession; round: Round }>;
  deleteRound(roundId: RoundId): Result<GameSession>;
  restoreRound(roundId: RoundId): Result<GameSession>;
  undoLastRound(): Result<{ game: GameSession; round: Round }>;
  resetGame(): Result<GameSession>;
  purgeDeleted(): Result<GameSession>;
  updatePlayers(players: Player[]): Result<GameSession>;
  updateGameConfig(config: ScoringConfiguration): Result<GameSession>;
  applyRescore(config: ScoringConfiguration): Result<GameSession>;
  finishGame(): Result<GameSession>;
  reopenGame(): Result<GameSession>;
  exportBackup(): Promise<BackupFile>;
  importBackup(backup: BackupFile, mode: 'merge' | 'replace'): Promise<number>;
  setDraft(draft: RoundDraft | null): void;
  dismissSaveError(): void;
}

const StoreContext = createContext<Store | null>(null);

const opContext = (): ops.OpContext => ({ now: new Date().toISOString(), newId });

const noGame = <T,>(): Result<T> => ({
  ok: false,
  errors: [{ code: 'NO_GAME', message: 'No game is open. Start or continue a game first.', severity: 'error' }],
});

export function StoreProvider({ children, storage }: { children: ReactNode; storage?: TallyStorage }) {
  const db = useMemo(() => storage ?? new TallyStorage(), [storage]);
  const [state, setState] = useState<StoreState>({
    status: 'loading',
    settings: DEFAULT_SETTINGS,
    games: [],
    unreadable: [],
    loadError: null,
    saveError: null,
    draft: null,
  });
  const stateRef = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback((fn: (s: StoreState) => StoreState) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  }, []);

  /** Serialise writes so they land in order; surface failures instead of hiding them. */
  const persist = useCallback(
    (task: () => Promise<unknown>) => {
      queue.current = queue.current
        .then(task)
        .then(() => undefined)
        .catch((e: unknown) => {
          update((s) => ({
            ...s,
            saveError: `Could not save to this device: ${e instanceof Error ? e.message : String(e)}`,
          }));
        });
      return queue.current;
    },
    [update],
  );

  const reload = useCallback(async () => {
    try {
      const [settings, loaded] = await Promise.all([db.loadSettings(), db.loadGames()]);
      update((s) => ({
        ...s,
        status: 'ready',
        settings,
        games: loaded.games,
        unreadable: loaded.unreadable,
        loadError: null,
      }));
    } catch (e) {
      update((s) => ({
        ...s,
        status: 'error',
        loadError: e instanceof Error ? e.message : String(e),
      }));
    }
  }, [db, update]);

  useEffect(() => {
    void reload();
    void requestPersistentStorage();
  }, [reload]);

  const saveSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      void persist(() => db.saveSettings(patch));
    },
    [db, persist, update],
  );

  const putGame = useCallback(
    (game: GameSession) => {
      update((s) => {
        const exists = s.games.some((g) => g.id === game.id);
        const games = exists ? s.games.map((g) => (g.id === game.id ? game : g)) : [game, ...s.games];
        return { ...s, games: [...games].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
      });
      void persist(() => db.saveGame(game));
    },
    [db, persist, update],
  );

  const getActive = useCallback((): GameSession | null => {
    const s = stateRef.current;
    return s.games.find((g) => g.id === s.settings.activeGameId) ?? null;
  }, []);

  /** Apply a pure operation to the active game; persist on success. */
  const withActive = useCallback(
    <T,>(run: (game: GameSession, ctx: ops.OpContext) => Result<T>, pick: (value: T) => GameSession): Result<T> => {
      const game = getActive();
      if (!game) return noGame<T>();
      const result = run(game, opContext());
      if (result.ok) putGame(pick(result.value));
      return result;
    },
    [getActive, putGame],
  );

  const store: Store = useMemo(() => {
    const activeGame = state.games.find((g) => g.id === state.settings.activeGameId) ?? null;
    const asGame = (g: GameSession) => g;
    const asPair = (v: { game: GameSession }) => v.game;
    return {
      ...state,
      activeGame,
      setTheme: (theme) => saveSettings({ theme }),
      saveHouseRules: async (config) => {
        saveSettings({ houseRules: config, houseRulesConfirmedAt: new Date().toISOString() });
        await queue.current;
      },
      startGame: (params) => {
        const result = ops.createGame(params, opContext());
        if (result.ok) {
          putGame(result.value);
          saveSettings({ activeGameId: result.value.id, lastPlayerNames: params.players.map((p) => p.name.trim()) });
          update((s) => ({ ...s, draft: null }));
        }
        return result;
      },
      openGame: (id) => {
        saveSettings({ activeGameId: id });
        update((s) => ({ ...s, draft: null }));
      },
      closeGame: () => {
        saveSettings({ activeGameId: null });
        update((s) => ({ ...s, draft: null }));
      },
      renameGame: (id, name) => {
        const game = stateRef.current.games.find((g) => g.id === id);
        const trimmed = name.trim();
        if (!game) return { ok: false, errors: [{ code: 'NO_GAME', message: 'That game no longer exists.', severity: 'error' }] };
        if (!trimmed) return { ok: false, errors: [{ code: 'NAME', message: 'Game name cannot be empty.', severity: 'error' }] };
        const next = { ...game, name: trimmed, updatedAt: new Date().toISOString() };
        putGame(next);
        return { ok: true, value: next };
      },
      deleteGame: async (id) => {
        update((s) => ({
          ...s,
          games: s.games.filter((g) => g.id !== id),
          settings: s.settings.activeGameId === id ? { ...s.settings, activeGameId: null } : s.settings,
        }));
        await persist(() => db.deleteGame(id));
      },
      recordRound: (input) => {
        const r = withActive((g, ctx) => ops.recordRound(g, input, ctx), asPair);
        if (r.ok) update((s) => ({ ...s, draft: null }));
        return r;
      },
      editRound: (roundId, input, options) => {
        const r = withActive((g, ctx) => ops.editRound(g, roundId, input, ctx, options), asPair);
        if (r.ok) update((s) => ({ ...s, draft: null }));
        return r;
      },
      deleteRound: (roundId) => withActive((g, ctx) => ops.deleteRound(g, roundId, ctx), asGame),
      restoreRound: (roundId) => withActive((g, ctx) => ops.restoreRound(g, roundId, ctx), asGame),
      undoLastRound: () => withActive((g, ctx) => ops.undoLastRound(g, ctx), asPair),
      resetGame: () => withActive((g, ctx) => ops.resetGame(g, ctx), asGame),
      purgeDeleted: () => withActive((g, ctx) => ({ ok: true, value: ops.purgeDeletedRounds(g, ctx) }), asGame),
      updatePlayers: (players) => withActive((g, ctx) => ops.updatePlayers(g, players, ctx), asGame),
      updateGameConfig: (config) => withActive((g, ctx) => ops.updateGameConfig(g, config, ctx), asGame),
      applyRescore: (config) => withActive((g, ctx) => ops.applyRescore(g, config, ctx), asGame),
      finishGame: () => withActive((g, ctx) => ({ ok: true, value: ops.finishGame(g, ctx) }), asGame),
      reopenGame: () => withActive((g, ctx) => ({ ok: true, value: ops.reopenGame(g, ctx) }), asGame),
      exportBackup: async () => {
        await queue.current;
        return db.exportBackup(new Date().toISOString());
      },
      importBackup: async (backup, mode) => {
        await queue.current;
        const count = await db.importBackup(backup, mode);
        await reload();
        return count;
      },
      setDraft: (draft) => update((s) => ({ ...s, draft })),
      dismissSaveError: () => update((s) => ({ ...s, saveError: null })),
    };
  }, [state, saveSettings, putGame, withActive, update, persist, db, reload]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
