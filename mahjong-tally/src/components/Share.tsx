import { useMemo, useState } from 'react';
import { encode } from 'uqr';
import { Check, CloudOff, Copy, Loader2, MessageCircle, Radio, RefreshCw, Users } from 'lucide-react';
import { useStore, type SyncInfo } from '../app/store';
import type { GameSession, Player } from '../models/types';
import { formatTime } from '../utils/time';
import { SeatBadge } from './domain';
import { Sheet, useToast } from './overlay';
import { Button, cx } from './ui';

/** QR code drawn as an SVG in the app's colours (light modules on a white tile for reliable scanning). */
export function QrCode({ text, size = 220 }: { text: string; size?: number }) {
  const qr = useMemo(() => encode(text, { ecc: 'M', border: 2 }), [text]);
  const n = qr.size;
  const path = useMemo(() => {
    let d = '';
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return d;
  }, [qr]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      role="img"
      aria-label="QR code for the game link"
      className="rounded-2xl bg-white p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
      shapeRendering="crispEdges"
    >
      <path d={path} fill="#0b3d2b" />
    </svg>
  );
}

const STATUS_TEXT: Record<SyncInfo['status'], string> = {
  syncing: 'Syncing…',
  synced: 'Live',
  offline: 'Offline',
  unavailable: 'Not syncing',
};

/** Small live-sync indicator for a shared game. */
export function SyncChip({ onClick }: { onClick?: () => void }) {
  const store = useStore();
  const share = store.activeShare;
  if (!share) return null;
  const info = store.sync?.gameId === share.gameId ? store.sync : null;
  const waiting = share.pending.length;
  const status: SyncInfo['status'] = info?.status ?? (waiting ? 'syncing' : 'synced');
  const ok = status === 'synced';
  const label = status === 'offline' || status === 'unavailable' ? `${STATUS_TEXT[status]}${waiting ? ` · ${waiting} waiting` : ''}` : STATUS_TEXT[status];
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="sync-chip"
      data-status={status}
      className={cx(
        'pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold',
        ok && 'border-emerald/30 bg-emerald-soft text-positive',
        status === 'syncing' && 'border-line bg-surface-2 text-ink-2',
        (status === 'offline' || status === 'unavailable') && 'border-gold/40 bg-gold-soft text-gold',
      )}
    >
      {status === 'syncing' ? (
        <Loader2 size={14} className="animate-spin" />
      ) : ok ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
        </span>
      ) : (
        <CloudOff size={14} />
      )}
      {label}
    </button>
  );
}

/** "Who are you?" — pick which player uses this phone. */
export function IdentityPicker({
  game,
  value,
  onChange,
  testPrefix = 'me',
}: {
  game: GameSession;
  value: string | null;
  onChange: (playerId: string) => void;
  testPrefix?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Which player are you?" className="grid grid-cols-2 gap-2.5">
      {game.players.map((p: Player) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          data-testid={`${testPrefix}-${p.seat}`}
          onClick={() => onChange(p.id)}
          className={cx(
            'pressable flex min-h-[72px] flex-col items-start justify-between rounded-2xl border p-3 text-left',
            value === p.id ? 'border-gold bg-gold-soft elev-gold' : 'border-line bg-surface-2 hover:border-line-strong',
          )}
        >
          <SeatBadge seat={p.seat} size="sm" />
          <span className="mt-1.5 w-full truncate text-[15px] font-semibold text-ink">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Share sheet: start sharing, then show the link/QR and who this phone belongs to. */
export function SharePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const game = store.activeGame;
  const share = store.activeShare;
  const [busy, setBusy] = useState(false);
  if (!game) return null;
  const link = share ? store.shareLink(share.code) : '';
  const info = share && store.sync?.gameId === share.gameId ? store.sync : null;
  const uploaded = Boolean(share?.confirmed);

  const start = async () => {
    setBusy(true);
    const r = await store.shareActiveGame();
    setBusy(false);
    if (!r.ok) toast({ message: r.errors[0]?.message ?? 'Could not share the game.', tone: 'error' });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ message: 'Link copied.', tone: 'success' });
    } catch {
      toast({ message: 'Copy is blocked here. Long-press the link to copy it.', tone: 'error' });
    }
  };
  const sendWhatsApp = async () => {
    const text = `Join our Mahjong Tally game “${game.name}”: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: game.name, text, url: link });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Sheet open={open} onClose={onClose} title={share ? 'Live game link' : 'Share this game live'} labelledBy="share-title">
      {!share ? (
        <div className="space-y-4 text-[15px] leading-relaxed text-ink-2">
          <div className="flex gap-3">
            <Users size={22} className="mt-0.5 shrink-0 text-gold" />
            <p>
              Everyone opens the same link on their own phone, taps their name, and sees their own balance. Anyone at the table can record rounds. Every phone updates within a
              few seconds.
            </p>
          </div>
          <ul className="space-y-1.5 text-[13px] text-ink-3">
            <li>• The game (names, rounds and amounts) is stored in your private Mahjong Tally database so the phones can share it.</li>
            <li>• Only people with the link can see or change it. Share it with your table only.</li>
            <li>• Each phone keeps working without internet and catches up when it’s back online.</li>
          </ul>
          <Button variant="primary" size="lg" block onClick={start} disabled={busy} data-testid="start-sharing" icon={busy ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}>
            {busy ? 'Starting…' : 'Share live'}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <QrCode text={link} />
            <p className="text-center text-[14px] text-ink-2">Other players scan this with their camera, or open the link you send them.</p>
            {!uploaded ? (
              <p className="rounded-xl border border-gold/30 bg-gold-soft px-3 py-2 text-center text-[13px] text-gold">
                Still uploading the game. The link works as soon as this phone is online.
              </p>
            ) : null}
          </div>
          <div className="break-all rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-[12px] text-ink-2" data-testid="share-link">
            {link}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button icon={<Copy size={16} />} onClick={copy}>
              Copy link
            </Button>
            <Button icon={<MessageCircle size={16} />} onClick={sendWhatsApp}>
              WhatsApp
            </Button>
          </div>

          <div>
            <div className="mb-2 text-[15px] font-semibold text-ink">Who’s using this phone?</div>
            <IdentityPicker game={game} value={store.me?.id ?? null} onChange={(id) => store.setIdentity(game.id, id)} />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-ink-3">
            <span className="flex items-center gap-1.5">
              {info?.status === 'synced' ? <Check size={14} className="text-positive" /> : null}
              {info?.status === 'offline'
                ? 'Offline. Changes are saved here and sent when you’re back online.'
                : info?.status === 'unavailable'
                  ? (info.message ?? 'The sharing server is unavailable.')
                  : info?.lastOkAt
                    ? `Up to date · ${formatTime(info.lastOkAt)}`
                    : 'Connecting…'}
            </span>
            <button type="button" onClick={() => store.syncNow()} className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-emerald hover:bg-emerald-soft">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
