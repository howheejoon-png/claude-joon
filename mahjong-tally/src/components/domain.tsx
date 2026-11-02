import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, History, Home, PlusCircle, Settings, ShieldAlert, Wallet } from 'lucide-react';
import { SEAT_GLYPH, SEAT_LABEL } from '../config/defaults';
import { checkGameHealth, type GameHealth } from '../engine/audit';
import type { Cents, GameSession, LedgerTransaction, Player, PlayerId, Seat } from '../models/types';
import { formatCents } from '../utils/money';
import { navigate } from '../app/router';
import { Sheet } from './overlay';
import { IconButton, cx } from './ui';

export function Amount({
  cents,
  signed = true,
  className,
  neutral,
}: {
  cents: Cents;
  signed?: boolean;
  className?: string;
  /** Render without positive/negative colouring. */
  neutral?: boolean;
}) {
  const tone = neutral ? 'text-ink' : cents > 0 ? 'text-positive' : cents < 0 ? 'text-negative' : 'text-ink-2';
  return <span className={cx('num', tone, className)}>{formatCents(cents, { signed })}</span>;
}

export function SeatBadge({ seat, size = 'md', dealer }: { seat: Seat; size?: 'sm' | 'md'; dealer?: boolean }) {
  return (
    <span className="relative inline-flex">
      <span
        aria-label={`${SEAT_LABEL[seat]} seat`}
        title={`${SEAT_LABEL[seat]} seat`}
        className={cx(
          'inline-flex items-center justify-center rounded-[8px] border border-black/10 bg-tile font-display font-semibold text-tile-ink shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]',
          size === 'md' ? 'h-8 w-7 text-[16px]' : 'h-6 w-5 text-[12px]',
        )}
      >
        {SEAT_GLYPH[seat]}
      </span>
      {dealer ? (
        <span
          aria-label="Dealer"
          title="Dealer"
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-black"
        >
          D
        </span>
      ) : null}
    </span>
  );
}

export function TileLogo({ size = 64 }: { size?: number }) {
  return (
    <img
      src="./logo-tile.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="drop-shadow-[0_16px_28px_rgba(0,0,0,0.4)]"
      draggable={false}
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  back?: string;
}) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pb-4 pt-4">
      <div className="min-w-0">
        {back ? (
          <button
            type="button"
            onClick={() => navigate(back)}
            className="pressable -ml-2 mb-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[15px] font-medium text-emerald hover:bg-emerald-soft"
          >
            <ArrowLeft size={18} /> Back
          </button>
        ) : null}
        <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 truncate text-[14px] text-ink-3">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
    </header>
  );
}

const TABS = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/record', label: 'Record', icon: PlusCircle },
  { path: '/history', label: 'History', icon: History },
  { path: '/settlement', label: 'Settle', icon: Wallet },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

export function TabBar({ path }: { path: string }) {
  return (
    <nav aria-label="Main" className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-safe">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {TABS.map((t) => {
          const active = path === t.path || (t.path === '/settings' && (path.startsWith('/rules') || path === '/games'));
          const Icon = t.icon;
          const isRecord = t.path === '/record';
          return (
            <li key={t.path} className="flex-1">
              <a
                href={`#${t.path}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'pressable flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold',
                  active ? 'text-emerald' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                <span
                  className={cx(
                    'flex items-center justify-center rounded-full',
                    isRecord ? 'h-8 w-12' : 'h-7 w-7',
                    isRecord && (active ? 'bg-emerald text-emerald-ink' : 'bg-emerald-soft text-emerald'),
                  )}
                >
                  <Icon size={isRecord ? 22 : 22} strokeWidth={active ? 2.4 : 2} />
                </span>
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function useGameHealth(game: GameSession | null): GameHealth | null {
  return useMemo(() => (game ? checkGameHealth(game) : null), [game]);
}

/** Persistent ledger-validation indicator with a details sheet. */
export function BalanceIndicator({ game, compact }: { game: GameSession; compact?: boolean }) {
  const health = useGameHealth(game);
  const [open, setOpen] = useState(false);
  if (!health) return null;
  const ok = health.ok;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="balance-indicator"
        data-status={ok ? 'ok' : 'error'}
        className={cx(
          'pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold',
          ok ? 'border-emerald/30 bg-emerald-soft text-positive' : 'border-negative/40 bg-negative-soft text-negative',
        )}
      >
        {ok ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
        {compact ? (ok ? 'Tallied' : 'Error') : ok ? 'All Balances Tallied' : 'Balance Error Detected'}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={ok ? 'All Balances Tallied' : 'Balance Error Detected'}>
        {ok ? (
          <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
            <p>Every check passed for this game:</p>
            <ul className="space-y-2">
              {[
                'Every payment has a valid payer and receiver, and nobody pays themselves.',
                'Every amount is a positive whole number of cents.',
                'Each payment has a matching debit and credit entry.',
                'Every round nets to exactly $0.00.',
                'All player balances add up to exactly $0.00.',
                'Each round re-calculates to exactly the saved payments.',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-positive" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-ink-2">
              The ledger failed validation. Nothing has been changed automatically. Review the affected rounds in History, or restore from a backup.
            </p>
            <ul className="space-y-2">
              {health.issues
                .filter((i) => i.severity === 'error')
                .map((i, idx) => (
                  <li key={`${i.code}-${idx}`} className="rounded-xl border border-negative/30 bg-negative-soft px-3 py-2 text-[14px] text-negative">
                    <span className="font-mono text-[11px] opacity-70">{i.code}</span>
                    <div>{i.message}</div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
}

export function playerMap(players: readonly Player[]): Map<PlayerId, Player> {
  return new Map(players.map((p) => [p.id, p]));
}

/** Per-player net lines for one round: "Player B pays $4.00". */
export function RoundNetLines({
  players,
  net,
  winnerId,
}: {
  players: readonly Player[];
  net: Record<PlayerId, Cents>;
  winnerId?: PlayerId | undefined;
}) {
  return (
    <ul className="divide-y divide-line">
      {players.map((p) => {
        const v = net[p.id] ?? 0;
        return (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <SeatBadge seat={p.seat} size="sm" />
              <span className="truncate text-[15px] font-medium text-ink">{p.name}</span>
              {p.id === winnerId ? <span className="text-[12px] font-semibold text-gold">Winner</span> : null}
            </span>
            <span className="shrink-0 text-right text-[15px]" data-testid={`net-line-${p.seat}`} data-cents={v}>
              <span className="mr-2 text-[13px] text-ink-3">{v > 0 ? 'receives' : v < 0 ? 'pays' : 'no change'}</span>
              <span className={cx('num font-semibold', v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-ink-2')}>
                {formatCents(Math.abs(v))}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Itemised transfers with their calculation components. */
export function TransactionList({ transactions, players }: { transactions: readonly LedgerTransaction[]; players: readonly Player[] }) {
  const byId = playerMap(players);
  if (!transactions.length) return <p className="py-2 text-[14px] text-ink-3">No payments in this round.</p>;
  return (
    <ul className="space-y-2">
      {transactions.map((t) => (
        <li key={t.id} className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[14px]">
            <span className="flex min-w-0 items-center gap-1.5 text-ink">
              <span className="truncate font-medium">{byId.get(t.payerId)?.name ?? 'Unknown'}</span>
              <ChevronRight size={14} className="shrink-0 text-ink-3" aria-label="pays" />
              <span className="truncate font-medium">{byId.get(t.receiverId)?.name ?? 'Unknown'}</span>
            </span>
            <span className="num shrink-0 font-semibold text-ink">{formatCents(t.amountCents)}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">{t.description}</div>
          {t.components && t.components.length > 1 ? (
            <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-[12px] text-ink-2">
              {t.components.map((c, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{c.label}</span>
                  <span className="num">{formatCents(c.amountCents, { signed: i > 0 })}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function BackButton({ to, label = 'Back' }: { to: string; label?: string }) {
  return (
    <IconButton label={label} onClick={() => navigate(to)}>
      <ArrowLeft size={20} />
    </IconButton>
  );
}
