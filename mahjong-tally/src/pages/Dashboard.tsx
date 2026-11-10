import { useEffect, useState } from 'react';
import { ArrowRight, Clock, Crown, Hash, LayoutGrid, Plus, Trophy, UserRound, Users } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, BalanceIndicator, PageHeader, SeatBadge, playerMap } from '../components/domain';
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle, cx } from '../components/ui';
import { activeRounds, gameBalances, gameStats, roundNet, roundNumbers } from '../engine/game';
import { tableState, type TableState } from '../engine/table';
import { PlayerTraits, TableStrip } from '../components/Table';
import { FLOWERS, SEAT_LABEL } from '../config/defaults';
import { formatCents } from '../utils/money';
import { formatDuration, formatTime } from '../utils/time';
import { describeRound } from './describe';
import { IdentityPicker, SharePanel, SyncChip } from '../components/Share';
import { computeSettlement } from '../engine/settlement';
import type { GameSession, Player } from '../models/types';

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function NoGame() {
  return (
    <EmptyState
      icon={<LayoutGrid size={28} />}
      title="No game open"
      body="Start a new game or continue a saved one to see the scoreboard."
      action={
        <Button variant="primary" block onClick={() => navigate('/')}>
          Go to start
        </Button>
      }
    />
  );
}

export function Dashboard() {
  const store = useStore();
  const { activeGame: game, me, activeShare } = store;
  const now = useNow(30_000);
  const [shareOpen, setShareOpen] = useState(false);
  if (!game) return <NoGame />;

  const balances = gameBalances(game);
  const byId = playerMap(game.players);
  const stats = gameStats(game);
  const rounds = activeRounds(game);
  const numbers = roundNumbers(game);
  const total = balances.reduce((a, b) => a + b.netCents, 0);
  const table = tableState(game);
  const nextDealer = table.dealerId;
  const lastRound = rounds[rounds.length - 1];
  const endTime = game.status === 'finished' && game.finishedAt ? Date.parse(game.finishedAt) : now;
  const recent = [...rounds].reverse().slice(0, 4);

  return (
    <div>
      <PageHeader
        title={game.name}
        subtitle={`${game.config.stakeLabel} · ${game.status === 'finished' ? 'Finished' : 'In progress'}`}
        right={
          <>
            <IconButton label={activeShare ? 'Live game link' : 'Share this game live'} onClick={() => setShareOpen(true)} data-testid="open-share">
              <Users size={20} className={activeShare ? 'text-emerald' : undefined} />
            </IconButton>
            <IconButton label="All games" onClick={() => navigate('/')}>
              <LayoutGrid size={20} />
            </IconButton>
          </>
        }
      />
      <SharePanel open={shareOpen} onClose={() => setShareOpen(false)} />

      {activeShare && !me ? (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRound size={18} className="text-gold" />
            <div className="text-[15px] font-semibold">Which player are you?</div>
          </div>
          <IdentityPicker game={game} value={null} testPrefix="prompt-me" onChange={(id) => store.setIdentity(game.id, id)} />
        </Card>
      ) : null}
      {me ? <YouCard game={game} me={me} table={table} /> : null}
      {game.status === 'active' ? <TableStrip game={game} state={table} /> : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="flex flex-wrap items-center gap-2">
          <BalanceIndicator game={game} compact={Boolean(activeShare)} />
          <SyncChip onClick={() => setShareOpen(true)} />
        </span>
        <span className="text-[13px] text-ink-3">
          Total <span className={cx('num font-semibold', total === 0 ? 'text-ink-2' : 'text-negative')} data-testid="total-balance">{formatCents(total)}</span>
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3" aria-label="Scoreboard">
        {game.players.map((p, i) => {
          const b = balances.find((x) => x.playerId === p.id)!;
          const tone = b.netCents > 0 ? 'positive' : b.netCents < 0 ? 'negative' : 'zero';
          const isMe = me?.id === p.id;
          return (
            <li
              key={p.id}
              data-testid={`score-card-${p.seat}`}
              className={cx(
                'grain relative overflow-hidden rounded-3xl border p-4 elev-1 animate-rise-in',
                tone === 'positive' && 'border-emerald/25 bg-[linear-gradient(160deg,var(--emerald-soft),transparent_60%),var(--surface)]',
                tone === 'negative' && 'border-negative/20 bg-[linear-gradient(160deg,var(--negative-soft),transparent_60%),var(--surface)]',
                tone === 'zero' && 'border-line bg-surface',
                isMe && 'ring-2 ring-gold/70',
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <SeatBadge seat={table.winds[p.id] ?? p.seat} dealer={nextDealer === p.id} />
                {b.wins > 0 && b.netCents === Math.max(...balances.map((x) => x.netCents)) && b.netCents > 0 ? (
                  <Crown size={16} className="text-gold" aria-label="Leader" />
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-1.5 truncate text-[15px] font-semibold text-ink">
                <span className="truncate">{p.name}</span>
                {isMe ? <Badge tone="gold">You</Badge> : null}
              </div>
              <PlayerTraits player={p} wind={table.dealerId ? table.winds[p.id] : undefined} className="mt-0.5" />
              <Amount cents={b.netCents} className="mt-0.5 block text-[26px] font-bold leading-tight tracking-[-0.02em]" />
              <div className="mt-2 flex gap-3 text-[12px] text-ink-3">
                <span>
                  <span className="num font-semibold text-ink-2">{b.wins}</span> won
                </span>
                <span>
                  <span className="num font-semibold text-ink-2">{b.losses}</span> lost
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <Button variant="primary" size="lg" block icon={<Plus size={20} />} onClick={() => navigate('/record')} disabled={game.status === 'finished'} data-testid="dashboard-record">
          {game.status === 'finished' ? 'Game finished' : 'Record Round'}
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Stat icon={<Hash size={15} />} label="Round" value={game.status === 'finished' ? `${rounds.length}` : `${rounds.length + 1}`} sub={game.status === 'finished' ? 'played' : 'next up'} />
        <Stat icon={<Clock size={15} />} label="Duration" value={formatDuration(endTime - Date.parse(game.createdAt))} />
        <Stat
          icon={<Trophy size={15} />}
          label="Biggest win"
          value={stats.biggestWin ? formatCents(stats.biggestWin.amountCents) : '—'}
          sub={stats.biggestWin ? `${byId.get(stats.biggestWin.winnerId)?.name ?? ''} · #${numbers.get(stats.biggestWin.roundId)}` : undefined}
        />
      </div>

      <SectionTitle
        action={
          rounds.length ? (
            <Button size="sm" variant="ghost" onClick={() => navigate('/history')}>
              See all
            </Button>
          ) : undefined
        }
      >
        Recent rounds
      </SectionTitle>
      {recent.length === 0 ? (
        <Card className="p-5 text-center text-[14px] text-ink-3">No rounds yet. Tap Record Round after the first hand.</Card>
      ) : (
        <Card as="div" className="divide-y divide-line p-0">
          {recent.map((r) => {
            const net = roundNet(game, r);
            const d = describeRound(r, byId);
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => navigate(`/history?open=${r.id}`)}
                className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <span className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-[13px] font-bold text-ink-2">
                  {numbers.get(r.id)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{d.title}</span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {d.subtitle} · {formatTime(r.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {d.winnerId ? <Amount cents={net[d.winnerId] ?? 0} className="text-[15px] font-semibold" /> : <Badge>Draw</Badge>}
                </span>
              </button>
            );
          })}
        </Card>
      )}
      {lastRound && game.status !== 'finished' ? <p className="mt-3 px-1 text-[12px] text-ink-3">Changes save automatically.</p> : null}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string | undefined }) {
  return (
    <Card as="div" className="p-3">
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        <span className="text-gold">{icon}</span>
        {label}
      </div>
      <div className="num mt-1 truncate text-[17px] font-bold text-ink">{value}</div>
      {sub ? <div className="truncate text-[11px] text-ink-3">{sub}</div> : null}
    </Card>
  );
}

/** This phone's player: their balance, and what they'd pay or receive if the game ended now. */
function YouCard({ game, me, table }: { game: GameSession; me: Player; table: TableState }) {
  const balances = gameBalances(game);
  const mine = balances.find((b) => b.playerId === me.id);
  if (!mine) return null;
  const plan = computeSettlement(balances);
  const byId = playerMap(game.players);
  const myTransfers = plan.ok ? plan.plan.transfers.filter((t) => t.fromPlayerId === me.id || t.toPlayerId === me.id) : [];
  return (
    <section
      data-testid="you-card"
      aria-label={`Your balance, ${me.name}`}
      className="grain elev-gold relative mb-4 overflow-hidden rounded-3xl border border-gold/30 bg-[radial-gradient(120%_90%_at_100%_0%,var(--gold-soft),transparent_60%),var(--surface)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SeatBadge seat={table.winds[me.id] ?? me.seat} dealer={table.dealerId === me.id} />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gold">You</div>
            <div className="truncate text-[17px] font-semibold text-ink">{me.name}</div>
          </div>
        </div>
        <div className="text-right text-[12px] text-ink-3">
          <span className="num font-semibold text-ink-2">{mine.wins}</span> won · <span className="num font-semibold text-ink-2">{mine.losses}</span> lost
        </div>
      </div>
      <Amount cents={mine.netCents} className="mt-3 block text-[40px] font-bold leading-none tracking-[-0.03em]" />
      {table.dealerId || me.animal ? (
        <p className="mt-2 text-[13px] text-ink-2" data-testid="you-hand">
          {table.dealerId ? (
            <>
              This hand you’re <span className="font-semibold text-ink">{SEAT_LABEL[table.winds[me.id]!]}</span>
              {table.dealerId === me.id ? ' (dealer)' : ''} · your flowers {FLOWERS[table.winds[me.id]!].number}{' '}
              <span className="font-display">{FLOWERS[table.winds[me.id]!].glyphs}</span>
            </>
          ) : null}
          {me.animal ? <PlayerTraits player={{ ...me }} className="mt-0.5 inline-flex" /> : null}
        </p>
      ) : null}
      <div className="mt-3 space-y-1 text-[14px]">
        {myTransfers.length === 0 ? (
          <p className="text-ink-3">{mine.netCents === 0 ? 'You’re square right now.' : 'Settling up…'}</p>
        ) : (
          myTransfers.map((t, i) => (
            <p key={i} className="flex items-center gap-1.5 text-ink-2">
              {t.fromPlayerId === me.id ? (
                <>
                  You’d pay <span className="font-semibold text-ink">{byId.get(t.toPlayerId)?.name}</span>
                  <ArrowRight size={13} className="text-ink-3" />
                  <span className="num font-semibold text-negative">{formatCents(t.amountCents)}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-ink">{byId.get(t.fromPlayerId)?.name}</span> would pay you
                  <ArrowRight size={13} className="text-ink-3" />
                  <span className="num font-semibold text-positive">{formatCents(t.amountCents)}</span>
                </>
              )}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
