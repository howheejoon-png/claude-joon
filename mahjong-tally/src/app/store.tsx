/**
 * Application store: holds loaded games and settings, and persists every
 * change to IndexedDB immediately (ordered write queue).
 *
 * Every change to a game is expressed as a GameOp and applied with the pure
 * `applyOp` reducer. Local games just apply it. Shared games also queue it
 * for the sharing server; a sync loop pushes queued ops, pulls everyone
 * else's, and replays the shared log so all phones show the same ledger.
 * UI components never compute money themselves.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as ops from '../engine/game';
import type { GameSession, Player, Result, Round, RoundId, RoundInput, ScoringConfiguration, Seat } from '../models/types';
import { TallyStorage, requestPersistentStorage } from '../storage/db';
import { DEFAULT_SETTINGS, type AppSettings, type BackupFile, type ThemePreference } from '../storage/schema';
import { applyOp, type GameOp, type GameOpBody } from '../sync/ops';
import { isShareCode, newShareCode, supabaseTransport, type SyncTransport } from '../sync/remote';
import { joinShare, shownGame, startShare, syncShare, type ShareState } from '../sync/share';
import { newId } from '../utils/id';

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'unavailable';

export interface SyncInfo {
  gameId: string;
  status: SyncStatus;
  message?: string;
  lastOkAt?: string;
}

export interface StoreNotice {
  id: number;
  message: string;
  tone: 'error' | 'info' | 'success';
}

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
  prevailingWind: Seat;
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
  /** Sync state of games shared live, by game id. */
  shares: Record<string, ShareState>;
  sync: SyncInfo | null;
  notice: StoreNotice | null;
}

export interface Store extends StoreState {
  activeGame: GameSession | null;
  /** Live-share state of the active game, if it is shared. */
  activeShare: ShareState | null;
  /** The player using this phone in the active game, if chosen. */
  me: Player | null;
  shareLink(code: string): string;
  shareActiveGame(): Promise<Result<{ code: string; link: string }>>;
  joinSharedGame(code: string): Promise<Result<GameSession>>;
  setIdentity(gameId: string, playerId: string | null): void;
  setNextHand(next: { dealerId: string; prevailingWind: Seat; firstDealerId?: string }): Result<GameSession>;
  syncNow(): void;
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

const POLL_MS = 3000;

const noGame = <T,>(): Result<T> => ({
  ok: false,
  errors: [{ code: 'NO_GAME', message: 'No game is open. Start or continue a game first.', severity: 'error' }],
});

export function StoreProvider({
  children,
  storage,
  transport,
}: {
  children: ReactNode;
  storage?: TallyStorage;
  transport?: SyncTransport;
}) {
  const db = useMemo(() => storage ?? new TallyStorage(), [storage]);
  const remote = useMemo(() => transport ?? supabaseTransport(), [transport]);
  const [state, setState] = useState<StoreState>({
    status: 'loading',
    settings: DEFAULT_SETTINGS,
    games: [],
    unreadable: [],
    loadError: null,
    saveError: null,
    draft: null,
    shares: {},
    sync: null,
    notice: null,
  });
  const stateRef = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const syncBusy = useRef(false);
  const syncAgain = useRef(false);
  const noticeId = useRef(0);

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
      const [loadedSettings, loaded, shareList] = await Promise.all([db.loadSettings(), db.loadGames(), db.loadShares()]);
      let settings = loadedSettings;
      if (!settings.deviceId) settings = await db.saveSettings({ deviceId: newId() });
      update((s) => ({
        ...s,
        status: 'ready',
        settings,
        games: loaded.games,
        unreadable: loaded.unreadable,
        loadError: null,
        shares: Object.fromEntries(shareList.map((sh) => [sh.gameId, sh])),
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
    const st = stateRef.current;
    return st.games.find((g) => g.id === st.settings.activeGameId) ?? null;
  }, []);

  const notify = useCallback(
    (message: string, tone: StoreNotice['tone'] = 'info') => {
      noticeId.current += 1;
      const id = noticeId.current;
      update((st) => ({ ...st, notice: { id, message, tone } }));
    },
    [update],
  );

  /** Store a shared game's sync state and the game it shows, in memory and on disk. */
  const commitShare = useCallback(
    (share: ShareState, shown: GameSession | null) => {
      update((st) => {
        const games = shown
          ? (st.games.some((g) => g.id === shown.id) ? st.games.map((g) => (g.id === shown.id ? shown : g)) : [shown, ...st.games]).sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            )
          : st.games;
        return { ...st, games, shares: { ...st.shares, [share.gameId]: share } };
      });
      void persist(() => db.saveShare(share, shown));
    },
    [db, persist, update],
  );

  const setSync = useCallback(
    (info: SyncInfo) => update((st) => ({ ...st, sync: info })),
    [update],
  );

  /** Push this phone's queued changes for a shared game and pull everyone else's. */
  const syncGame = useCallback(
    async (gameId: string) => {
      if (syncBusy.current) {
        syncAgain.current = true;
        return;
      }
      syncBusy.current = true;
      try {
        do {
          syncAgain.current = false;
          const start = stateRef.current.shares[gameId];
          const deviceId = stateRef.current.settings.deviceId;
          if (!start || !deviceId) return;
          const prev = stateRef.current.sync;
          setSync({ gameId, status: 'syncing', ...(prev?.gameId === gameId && prev.lastOkAt ? { lastOkAt: prev.lastOkAt } : {}) });
          const outcome = await syncShare(start, remote, deviceId);
          // Keep any changes made on this phone while the sync was in flight.
          const current = stateRef.current.shares[gameId];
          if (!current) return;
          const startedIds = new Set(start.pending.map((o) => o.opId));
          const added = current.pending.filter((o) => !startedIds.has(o.opId));
          const merged: ShareState = { ...outcome.share, pending: [...outcome.share.pending, ...added] };
          if (added.length) syncAgain.current = true;
          const changed = merged.lastSeq !== current.lastSeq || merged.pending.length !== current.pending.length;
          if (changed) commitShare(merged, shownGame(merged));
          for (const r of outcome.rejectedMine) notify(`A change from this phone couldn’t be applied: ${r.message}`, 'error');
          if (outcome.error) {
            setSync({
              gameId,
              status: outcome.error.kind === 'offline' ? 'offline' : 'unavailable',
              message: outcome.error.message,
              ...(prev?.lastOkAt ? { lastOkAt: prev.lastOkAt } : {}),
            });
            break;
          }
          setSync({ gameId, status: merged.pending.length ? 'syncing' : 'synced', lastOkAt: new Date().toISOString() });
        } while (syncAgain.current);
      } finally {
        syncBusy.current = false;
      }
    },
    [commitShare, notify, remote, setSync],
  );

  const makeOp = useCallback((gameId: string, body: GameOpBody): GameOp => {
    const st = stateRef.current;
    const game = st.games.find((g) => g.id === gameId);
    const meId = st.settings.identities?.[gameId];
    const author = meId ? game?.players.find((p) => p.id === meId)?.name : undefined;
    return {
      v: 1,
      opId: newId(),
      deviceId: st.settings.deviceId ?? 'unknown-device',
      ...(author ? { author } : {}),
      at: new Date().toISOString(),
      body,
    };
  }, []);

  /** Apply a change to a game: locally, and (for shared games) queued for everyone. */
  const runOp = useCallback(
    (gameId: string, body: GameOpBody): Result<GameSession> => {
      const st = stateRef.current;
      const game = st.games.find((g) => g.id === gameId);
      if (!game) return noGame<GameSession>();
      const op = makeOp(gameId, body);
      const result = applyOp(game, op);
      if (!result.ok) return result;
      const share = st.shares[gameId];
      if (share) {
        commitShare({ ...share, pending: [...share.pending, op] }, result.value);
        void syncGame(gameId);
      } else {
        putGame(result.value);
      }
      return result;
    },
    [commitShare, makeOp, putGame, syncGame],
  );

  const runActive = useCallback(
    (body: GameOpBody): Result<GameSession> => {
      const game = getActive();
      return game ? runOp(game.id, body) : noGame<GameSession>();
    },
    [getActive, runOp],
  );

  const withRound = (r: Result<GameSession>, roundId: RoundId): Result<{ game: GameSession; round: Round }> => {
    if (!r.ok) return r;
    const round = r.value.rounds.find((x) => x.id === roundId);
    return round ? { ok: true, value: { game: r.value, round } } : noGame();
  };

  // Keep the open shared game live: sync now, every few seconds while visible, and on reconnect.
  const activeId = state.settings.activeGameId;
  const activeShared = Boolean(activeId && state.shares[activeId]);
  useEffect(() => {
    if (!activeId || !activeShared) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void syncGame(activeId);
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener('online', tick);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', tick);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [activeId, activeShared, syncGame]);

  const store: Store = useMemo(() => {
    const activeGame = state.games.find((g) => g.id === state.settings.activeGameId) ?? null;
    const activeShare = activeGame ? (state.shares[activeGame.id] ?? null) : null;
    const meId = activeGame ? state.settings.identities?.[activeGame.id] : undefined;
    const me = (meId && activeGame?.players.find((p) => p.id === meId)) || null;
    const clearDraft = () => update((st) => ({ ...st, draft: null }));
    const shareLink = (code: string) => `${window.location.origin}${window.location.pathname}#/join/${code}`;
    return {
      ...state,
      activeGame,
      activeShare,
      me,
      shareLink,
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
          clearDraft();
        }
        return result;
      },
      openGame: (id) => {
        saveSettings({ activeGameId: id });
        clearDraft();
      },
      closeGame: () => {
        saveSettings({ activeGameId: null });
        clearDraft();
      },
      renameGame: (id, name) => runOp(id, { type: 'rename', name }),
      deleteGame: async (id) => {
        update((st) => {
          const { [id]: _gone, ...shares } = st.shares;
          return {
            ...st,
            shares,
            games: st.games.filter((g) => g.id !== id),
            settings: st.settings.activeGameId === id ? { ...st.settings, activeGameId: null } : st.settings,
          };
        });
        await persist(() => db.deleteGame(id));
      },
      recordRound: (input) => {
        const roundId = newId();
        const r = withRound(runActive({ type: 'record', roundId, input }), roundId);
        if (r.ok) clearDraft();
        return r;
      },
      editRound: (roundId, input, options) => {
        const r = withRound(runActive({ type: 'edit', roundId, input, rules: options?.rules ?? 'snapshot' }), roundId);
        if (r.ok) clearDraft();
        return r;
      },
      deleteRound: (roundId) => runActive({ type: 'delete', roundId }),
      restoreRound: (roundId) => runActive({ type: 'restore', roundId }),
      undoLastRound: () => {
        const game = getActive();
        if (!game) return noGame();
        const rounds = ops.activeRounds(game);
        const last = rounds[rounds.length - 1];
        if (!last) return { ok: false, errors: [{ code: 'NOTHING_TO_UNDO', message: 'There are no rounds to undo.', severity: 'error' }] };
        const r = runActive({ type: 'delete', roundId: last.id });
        return r.ok ? { ok: true, value: { game: r.value, round: last } } : r;
      },
      resetGame: () => runActive({ type: 'reset' }),
      purgeDeleted: () => runActive({ type: 'purge' }),
      updatePlayers: (players) => runActive({ type: 'players', players }),
      updateGameConfig: (config) => runActive({ type: 'config', config }),
      applyRescore: (config) => runActive({ type: 'rescore', config }),
      finishGame: () => runActive({ type: 'finish' }),
      reopenGame: () => runActive({ type: 'reopen' }),
      setNextHand: (next) => runActive({ type: 'table', ...next }),
      shareActiveGame: async () => {
        const game = getActive();
        if (!game) return noGame();
        const existing = stateRef.current.shares[game.id];
        if (existing) return { ok: true, value: { code: existing.code, link: shareLink(existing.code) } };
        const code = newShareCode();
        const op = makeOp(game.id, { type: 'snapshot', game });
        const share = startShare(game, code, op, new Date().toISOString());
        commitShare(share, game);
        await syncGame(game.id);
        return { ok: true, value: { code, link: shareLink(code) } };
      },
      joinSharedGame: async (code) => {
        if (!isShareCode(code)) {
          return { ok: false, errors: [{ code: 'LINK', message: 'This game link is incomplete. Ask for the link again.', severity: 'error' }] };
        }
        const known = Object.values(stateRef.current.shares).find((sh) => sh.code === code);
        if (known) {
          const game = stateRef.current.games.find((g) => g.id === known.gameId) ?? shownGame(known);
          if (game) {
            saveSettings({ activeGameId: game.id });
            void syncGame(game.id);
            return { ok: true, value: game };
          }
        }
        const deviceId = stateRef.current.settings.deviceId ?? newId();
        const joined = await joinShare(code, remote, deviceId, new Date().toISOString());
        if (!joined.ok) return { ok: false, errors: [{ code: joined.reason.toUpperCase(), message: joined.message, severity: 'error' }] };
        commitShare(joined.share, joined.game);
        saveSettings({ activeGameId: joined.game.id });
        clearDraft();
        return { ok: true, value: joined.game };
      },
      setIdentity: (gameId, playerId) => {
        const identities = { ...(stateRef.current.settings.identities ?? {}) };
        if (playerId) identities[gameId] = playerId;
        else delete identities[gameId];
        saveSettings({ identities });
      },
      syncNow: () => {
        const game = getActive();
        if (game && stateRef.current.shares[game.id]) void syncGame(game.id);
      },
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
      setDraft: (draft) => update((st) => ({ ...st, draft })),
      dismissSaveError: () => update((st) => ({ ...st, saveError: null })),
    };
  }, [state, saveSettings, putGame, runOp, runActive, update, persist, db, reload, getActive, makeOp, commitShare, syncGame, remote]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
