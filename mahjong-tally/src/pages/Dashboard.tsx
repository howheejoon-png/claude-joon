import { useEffect, useState } from 'react';
import { Clock, Crown, Hash, LayoutGrid, Plus, Trophy } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, BalanceIndicator, PageHeader, SeatBadge, playerMap } from '../components/domain';
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle, cx } from '../components/ui';
import { activeRounds, gameBalances, gameStats, roundNet, roundNumbers, suggestNextDealer } from '../engine/game';
import { formatCents } from '../utils/money';
import { formatDuration, formatTime } from '../utils/time';
import { describeRound } from './describe';

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
  const { activeGame: game } = useStore();
  const now = useNow(30_000);
  if (!game) return <NoGame />;

  const balances = gameBalances(game);
  const byId = playerMap(game.players);
  const stats = gameStats(game);
  const rounds = activeRounds(game);
  const numbers = roundNumbers(game);
  const total = balances.reduce((a, b) => a + b.netCents, 0);
  const nextDealer = suggestNextDealer(game);
  const lastRound = rounds[rounds.length - 1];
  const endTime = game.status === 'finished' && game.finishedAt ? Date.parse(game.finishedAt) : now;
  const recent = [...rounds].reverse().slice(0, 4);

  return (
    <div>
      <PageHeader
        title={game.name}
        subtitle={`${game.config.stakeLabel} · ${game.status === 'finished' ? 'Finished' : 'In progress'}`}
        right={
          <IconButton label="All games" onClick={() => navigate('/')}>
            <LayoutGrid size={20} />
          </IconButton>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <BalanceIndicator game={game} />
        <span className="text-[13px] text-ink-3">
          Total <span className={cx('num font-semibold', total === 0 ? 'text-ink-2' : 'text-negative')} data-testid="total-balance">{formatCents(total)}</span>
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-3" aria-label="Scoreboard">
        {game.players.map((p, i) => {
          const b = balances.find((x) => x.playerId === p.id)!;
          const tone = b.netCents > 0 ? 'positive' : b.netCents < 0 ? 'negative' : 'zero';
          return (
            <li
              key={p.id}
              data-testid={`score-card-${p.seat}`}
              className={cx(
                'grain relative overflow-hidden rounded-3xl border p-4 elev-1 animate-rise-in',
                tone === 'positive' && 'border-emerald/25 bg-[linear-gradient(160deg,var(--emerald-soft),transparent_60%),var(--surface)]',
                tone === 'negative' && 'border-negative/20 bg-[linear-gradient(160deg,var(--negative-soft),transparent_60%),var(--surface)]',
                tone === 'zero' && 'border-line bg-surface',
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <SeatBadge seat={p.seat} dealer={nextDealer === p.id} />
                {b.wins > 0 && b.netCents === Math.max(...balances.map((x) => x.netCents)) && b.netCents > 0 ? (
                  <Crown size={16} className="text-gold" aria-label="Leader" />
                ) : null}
              </div>
              <div className="mt-3 truncate text-[15px] font-semibold text-ink">{p.name}</div>
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
      {lastRound && game.status !== 'finished' ? (
        <p className="mt-3 px-1 text-[12px] text-ink-3">
          {nextDealer ? `Suggested dealer next round: ${byId.get(nextDealer)?.name}.` : 'No dealer tracked.'} Changes save automatically.
        </p>
      ) : null}
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
