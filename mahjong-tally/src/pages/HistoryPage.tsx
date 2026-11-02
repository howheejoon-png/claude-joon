import { useState } from 'react';
import { ChevronDown, History, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, BalanceIndicator, PageHeader, RoundNetLines, TransactionList, playerMap } from '../components/domain';
import { ConfirmDialog, useToast } from '../components/overlay';
import { Badge, Button, Card, EmptyState, SectionTitle, cx } from '../components/ui';
import { activeRounds, deletedRounds, roundNet, roundNumbers } from '../engine/game';
import type { Round } from '../models/types';
import { formatCents } from '../utils/money';
import { formatDateTime } from '../utils/time';
import { NoGame } from './Dashboard';
import { describeRound } from './describe';

type Pending = { type: 'delete'; round: Round } | { type: 'undo'; round: Round } | { type: 'purge' } | null;

export function HistoryPage({ openId }: { openId?: string | undefined }) {
  const store = useStore();
  const toast = useToast();
  const game = store.activeGame;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(openId ? [openId] : []));
  const [pending, setPending] = useState<Pending>(null);
  if (!game) return <NoGame />;

  const rounds = [...activeRounds(game)].reverse();
  const deleted = deletedRounds(game);
  const numbers = roundNumbers(game);
  const byId = playerMap(game.players);
  const last = rounds[0];

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runPending = () => {
    if (!pending) return;
    if (pending.type === 'purge') {
      store.purgeDeleted();
      toast({ message: 'Deleted rounds cleared.', tone: 'info' });
    } else {
      const n = numbers.get(pending.round.id);
      const id = pending.round.id;
      const r = pending.type === 'undo' ? store.undoLastRound() : store.deleteRound(id);
      if (r.ok) {
        toast({
          message: `Round ${n} ${pending.type === 'undo' ? 'undone' : 'deleted'}. Balances recalculated.`,
          tone: 'info',
          action: { label: 'Restore', run: () => store.restoreRound(id) },
        });
      } else toast({ message: r.errors[0]?.message ?? 'Could not delete round.', tone: 'error' });
    }
    setPending(null);
  };

  return (
    <div>
      <PageHeader title="History" subtitle={`${rounds.length} round${rounds.length === 1 ? '' : 's'} · ${game.name}`} right={<BalanceIndicator game={game} compact />} />

      {rounds.length > 0 ? (
        <Button
          block
          icon={<Undo2 size={18} />}
          onClick={() => last && setPending({ type: 'undo', round: last })}
          disabled={!last || game.status === 'finished'}
          data-testid="undo-last"
        >
          Undo last round
        </Button>
      ) : null}

      {rounds.length === 0 ? (
        <EmptyState
          icon={<History size={28} />}
          title="No rounds yet"
          body="Every recorded round appears here with a full breakdown of who paid whom."
          action={
            game.status === 'active' ? (
              <Button variant="primary" block onClick={() => navigate('/record')}>
                Record first round
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ol className="mt-4 space-y-3" aria-label="Rounds">
          {rounds.map((r) => {
            const d = describeRound(r, byId);
            const net = roundNet(game, r);
            const open = expanded.has(r.id);
            const totalWon = d.winnerId ? (net[d.winnerId] ?? 0) : 0;
            const adjustments = r.transactions.filter((t) => t.kind !== 'hand');
            return (
              <Card as="li" key={r.id} className="overflow-hidden p-0" data-testid={`round-${numbers.get(r.id)}`}>
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  aria-expanded={open}
                  className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                >
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-surface-3 py-1">
                    <span className="text-[10px] font-semibold uppercase text-ink-3">Round</span>
                    <span className="num text-[17px] font-bold leading-tight">{numbers.get(r.id)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{d.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {d.subtitle} · {formatDateTime(r.createdAt)}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {adjustments.length ? <Badge tone="gold">{adjustments.length} adjustment{adjustments.length > 1 ? 's' : ''}</Badge> : null}
                      {r.revisions.some((x) => x.action === 'edited' || x.action === 'rescored') ? <Badge>Edited</Badge> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {d.winnerId ? <Amount cents={totalWon} className="text-[16px] font-bold" /> : <Badge>Draw</Badge>}
                    <ChevronDown size={18} className={cx('text-ink-3 transition-transform', open && 'rotate-180')} />
                  </span>
                </button>
                {open ? (
                  <div className="space-y-4 border-t border-line px-4 pb-4 pt-3 animate-fade-in">
                    <RoundNetLines players={game.players} net={net} winnerId={d.winnerId} />
                    {r.notes.length ? (
                      <ul className="space-y-0.5 text-[12px] text-ink-3">
                        {r.notes.map((n, i) => (
                          <li key={i}>• {n}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div>
                      <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">Transactions</div>
                      <TransactionList transactions={r.transactions} players={game.players} />
                    </div>
                    <div className="text-[12px] text-ink-3">
                      Scored with “{r.configSnapshot.name}” ({r.configSnapshot.stakeLabel}).{' '}
                      {r.revisions.length > 1
                        ? `History: ${r.revisions.map((x) => `${x.action} ${formatDateTime(x.at)}`).join(' · ')}`
                        : ''}
                    </div>
                    {game.status === 'active' ? (
                      <div className="flex gap-2">
                        <Button block size="sm" icon={<Pencil size={14} />} onClick={() => navigate(`/record?edit=${r.id}`)} data-testid={`edit-round-${numbers.get(r.id)}`}>
                          Edit
                        </Button>
                        <Button block size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setPending({ type: 'delete', round: r })} data-testid={`delete-round-${numbers.get(r.id)}`}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </ol>
      )}

      {deleted.length ? (
        <>
          <SectionTitle
            action={
              <Button size="sm" variant="ghost" onClick={() => setPending({ type: 'purge' })}>
                Clear
              </Button>
            }
          >
            Recently deleted
          </SectionTitle>
          <Card as="div" className="divide-y divide-line p-0">
            {deleted.slice(0, 10).map((r) => {
              const d = describeRound(r, byId);
              const total = r.transactions.reduce((a, t) => a + t.amountCents, 0);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink-2 line-through decoration-ink-3/50">{d.title}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {d.subtitle} · {formatCents(total)} moved · deleted {formatDateTime(r.deletedAt!)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="gold"
                    icon={<RotateCcw size={14} />}
                    onClick={() => {
                      const res = store.restoreRound(r.id);
                      if (res.ok) toast({ message: 'Round restored. Balances recalculated.', tone: 'success' });
                      else toast({ message: res.errors[0]?.message ?? 'Could not restore.', tone: 'error' });
                    }}
                  >
                    Restore
                  </Button>
                </div>
              );
            })}
          </Card>
        </>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.type === 'purge' ? 'Clear deleted rounds?' : pending?.type === 'undo' ? 'Undo last round?' : 'Delete this round?'}
        confirmLabel={pending?.type === 'purge' ? 'Clear permanently' : pending?.type === 'undo' ? 'Undo round' : 'Delete round'}
        body={
          pending?.type === 'purge' ? (
            'Deleted rounds will be removed permanently and can no longer be restored. Balances are not affected.'
          ) : pending ? (
            <>
              Round {numbers.get(pending.round.id)} — {describeRound(pending.round, byId).title} will be removed from the ledger and every balance recalculated. You can restore it from
              “Recently deleted”.
            </>
          ) : null
        }
        onCancel={() => setPending(null)}
        onConfirm={runPending}
      />
    </div>
  );
}
