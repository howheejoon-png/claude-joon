import { ArrowRight, CheckCircle2, Copy, FileDown, Flag, MessageCircle, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../app/store';
import { Amount, BalanceIndicator, PageHeader, SeatBadge, playerMap } from '../components/domain';
import { ConfirmDialog, useToast } from '../components/overlay';
import { Button, Card, SectionTitle, cx } from '../components/ui';
import { activeRounds, gameBalances } from '../engine/game';
import { computeSettlement } from '../engine/settlement';
import { formatCents } from '../utils/money';
import { downloadFile, fileSafe, roundsCsv, settlementText } from '../utils/report';
import { NoGame } from './Dashboard';

export function Settlement() {
  const store = useStore();
  const toast = useToast();
  const game = store.activeGame;
  const [finishOpen, setFinishOpen] = useState(false);
  if (!game) return <NoGame />;

  const byId = playerMap(game.players);
  const balances = [...gameBalances(game)].sort((a, b) => b.netCents - a.netCents);
  const totalWon = balances.filter((b) => b.netCents > 0).reduce((a, b) => a + b.netCents, 0);
  const totalLost = balances.filter((b) => b.netCents < 0).reduce((a, b) => a - b.netCents, 0);
  const net = balances.reduce((a, b) => a + b.netCents, 0);
  const result = computeSettlement(balances);
  const rounds = activeRounds(game).length;
  const verified = result.ok && net === 0 && totalWon === totalLost;
  const name = (id: string) => byId.get(id)?.name ?? 'Unknown';

  const copy = async () => {
    const text = settlementText(game);
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: 'Settlement copied to clipboard.', tone: 'success' });
    } catch {
      toast({ message: 'Copy is blocked by this browser. Use Export instead.', tone: 'error' });
    }
  };

  const share = async () => {
    const text = settlementText(game);
    // Prefer the native share sheet (lets the user pick WhatsApp); otherwise open a WhatsApp
    // share link. Either way the user reviews and sends the message themselves.
    if (navigator.share) {
      try {
        await navigator.share({ title: game.name, text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const exportResults = () => {
    const base = fileSafe(game.name);
    downloadFile(`${base}-settlement.txt`, settlementText(game), 'text/plain;charset=utf-8');
    downloadFile(`${base}-rounds.csv`, roundsCsv(game), 'text/csv;charset=utf-8');
    toast({ message: 'Exported settlement (.txt) and rounds (.csv).', tone: 'success' });
  };

  return (
    <div>
      <PageHeader title="Settlement" subtitle={`${game.name} · ${rounds} round${rounds === 1 ? '' : 's'}`} right={<BalanceIndicator game={game} compact />} />

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Total winnings</div>
          <Amount cents={totalWon} className="mt-1 block text-[22px] font-bold" />
        </Card>
        <Card className="p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Total losses</div>
          <Amount cents={-totalLost} className="mt-1 block text-[22px] font-bold" />
        </Card>
      </div>

      <SectionTitle>Net balances</SectionTitle>
      <Card as="div" className="divide-y divide-line p-0">
        {balances.map((b) => {
          const p = byId.get(b.playerId)!;
          return (
            <div key={b.playerId} className="flex items-center gap-3 px-4 py-3" data-testid={`net-${p.seat}`}>
              <SeatBadge seat={p.seat} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.name}</span>
              <span className="text-[12px] text-ink-3">
                {b.wins}W · {b.losses}L
              </span>
              <Amount cents={b.netCents} className="w-24 text-right text-[16px] font-bold" />
            </div>
          );
        })}
        <div className="flex items-center justify-between px-4 py-3 text-[14px]">
          <span className="text-ink-3">Rounds played</span>
          <span className="num font-semibold">{rounds}</span>
        </div>
      </Card>

      <div
        className={cx(
          'mt-3 flex items-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-semibold',
          verified ? 'border-emerald/30 bg-emerald-soft text-positive' : 'border-negative/40 bg-negative-soft text-negative',
        )}
        data-testid="settlement-verification"
      >
        {verified ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
        {verified ? 'Settlement verified: winnings equal losses, net $0.00' : `Settlement check failed: net ${formatCents(net)}`}
      </div>

      <SectionTitle>Who pays whom</SectionTitle>
      {!result.ok ? (
        <Card className="p-4 text-[14px] text-negative">{result.error}</Card>
      ) : result.plan.transfers.length === 0 ? (
        <Card className="p-5 text-center text-[15px] text-ink-2">Everyone is square. No payments needed.</Card>
      ) : (
        <>
          <Card as="div" className="divide-y divide-line p-0" aria-label="Suggested settlement">
            {result.plan.transfers.map((t, i) => (
              <div
                key={i}
                className={cx('flex items-center gap-2 px-4 py-3.5', store.me && (t.fromPlayerId === store.me.id || t.toPlayerId === store.me.id) && 'bg-gold-soft')}
                data-testid="settlement-transfer"
              >
                <span className="min-w-0 flex-1 text-[15px]">
                  <span className="font-semibold text-negative">{t.fromPlayerId === store.me?.id ? 'You' : name(t.fromPlayerId)}</span>
                  <ArrowRight size={14} className="mx-1.5 inline text-ink-3" aria-label="pays" />
                  <span className="font-semibold text-positive">{t.toPlayerId === store.me?.id ? 'You' : name(t.toPlayerId)}</span>
                </span>
                <span className="num text-[17px] font-bold">{formatCents(t.amountCents)}</span>
              </div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink-3">
            {result.plan.transfers.length} payment{result.plan.transfers.length > 1 ? 's' : ''}
            {result.plan.isMinimal ? ' — the fewest possible for these balances.' : '.'} Nobody both pays and receives, and every balance ends at exactly $0.00.
          </p>
        </>
      )}

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Button icon={<Copy size={16} />} onClick={copy} className="flex-col gap-1 py-3 text-[12px]" size="md">
          Copy
        </Button>
        <Button icon={<MessageCircle size={16} />} onClick={share} className="flex-col gap-1 py-3 text-[12px]" size="md">
          WhatsApp
        </Button>
        <Button icon={<FileDown size={16} />} onClick={exportResults} className="flex-col gap-1 py-3 text-[12px]" size="md">
          Export
        </Button>
      </div>
      <p className="mt-2 px-1 text-center text-[12px] text-ink-3">Sharing opens your share sheet or WhatsApp with the summary. Nothing is sent automatically.</p>

      <div className="mt-6">
        {game.status === 'active' ? (
          <Button block variant="gold" icon={<Flag size={16} />} onClick={() => setFinishOpen(true)}>
            Finish game
          </Button>
        ) : (
          <Button block onClick={() => store.reopenGame()}>
            Reopen game
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={finishOpen}
        title="Finish this game?"
        tone="primary"
        confirmLabel="Finish game"
        body="The game is marked finished and the scoresheet is locked. You can reopen it later from Settlement or Settings."
        onCancel={() => setFinishOpen(false)}
        onConfirm={() => {
          store.finishGame();
          setFinishOpen(false);
          toast({ message: 'Game finished.', tone: 'success' });
        }}
      />
    </div>
  );
}
