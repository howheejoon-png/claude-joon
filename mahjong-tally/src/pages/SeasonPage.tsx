import { useMemo, useState } from 'react';
import { Crown, Flame, MessageCircle, Sparkles, Trophy, Zap } from 'lucide-react';
import { useStore } from '../app/store';
import { Amount, PageHeader } from '../components/domain';
import { useToast } from '../components/overlay';
import { Badge, Button, Card, EmptyState, SectionTitle, Segmented, Toggle, cx } from '../components/ui';
import { computeSeason, type SeasonSummary } from '../engine/season';
import { formatCents } from '../utils/money';
import { formatDate } from '../utils/time';

type Period = 'all' | 'year';

function seasonText(s: SeasonSummary, label: string): string {
  const lines = [`🀄 Mahjong Tally — season (${label})`, `${s.nights} night${s.nights === 1 ? '' : 's'} · ${s.hands} hands`, ''];
  s.players.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name}: ${formatCents(p.totalCents, { signed: true })} (${p.nights} nights)`);
  });
  if (s.biggestHand) lines.push('', `Biggest hand: ${s.biggestHand.name} ${formatCents(s.biggestHand.cents)}`);
  if (s.kongKing) lines.push(`Kong king: ${s.kongKing.name} (${s.kongKing.kongs})`);
  if (s.longestStreak) lines.push(`Longest winning streak: ${s.longestStreak.name} (${s.longestStreak.streak} nights)`);
  return lines.join('\n');
}

export function SeasonPage() {
  const store = useStore();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('all');
  const [includeActive, setIncludeActive] = useState(true);
  const from = period === 'year' ? `${new Date().getFullYear()}-01-01T00:00:00.000Z` : undefined;
  const season = useMemo(
    () => computeSeason(store.games, { includeActive, ...(from ? { from } : {}) }),
    [store.games, includeActive, from],
  );
  const label = period === 'year' ? `${new Date().getFullYear()}` : 'all time';

  const share = async () => {
    const text = seasonText(season, label);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mahjong season', text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: 'Season summary copied.', tone: 'success' });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-safe">
      <PageHeader title="Season" subtitle="Every night on this phone" back={store.activeGame ? '/home' : '/'} />

      <div className="space-y-3">
        <Segmented<Period>
          label="Period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'year', label: `This year` },
          ]}
        />
        <Card className="px-4 py-2">
          <Toggle label="Include games in progress" checked={includeActive} onChange={setIncludeActive} />
        </Card>
      </div>

      {season.nights === 0 ? (
        <EmptyState
          icon={<Trophy size={28} />}
          title="No nights yet"
          body={includeActive ? 'Play a game with at least one round and it will show up here.' : 'Finish a game (Settle → Finish game) or include games in progress.'}
        />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2.5" data-testid="season-summary">
            {[
              ['Nights', String(season.nights)],
              ['Hands', String(season.hands)],
              ['Money moved', formatCents(season.movedCents)],
            ].map(([k, v]) => (
              <Card key={k} as="div" className="p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{k}</div>
                <div className="num mt-1 truncate text-[17px] font-bold">{v}</div>
              </Card>
            ))}
          </div>

          <SectionTitle>Leaderboard</SectionTitle>
          <ol className="space-y-2.5" aria-label="Season leaderboard">
            {season.players.map((p, i) => (
              <Card
                as="li"
                key={p.key}
                data-testid={`season-row-${i + 1}`}
                className={cx('flex items-center gap-3 p-4', i === 0 && p.totalCents > 0 && 'elev-gold border-gold/30')}
              >
                <span
                  className={cx(
                    'num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold',
                    i === 0 && p.totalCents > 0 ? 'bg-gold text-black' : 'bg-surface-3 text-ink-2',
                  )}
                >
                  {i === 0 && p.totalCents > 0 ? <Crown size={18} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[16px] font-semibold">{p.name}</span>
                    {p.currentStreak >= 2 ? (
                      <Badge tone="gold">
                        <Flame size={11} /> {p.currentStreak}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">
                    {p.nights} night{p.nights === 1 ? '' : 's'} · avg {formatCents(p.averageCents, { signed: true })} · {p.nightsUp} up / {p.nightsDown} down
                    {p.bestNight && p.bestNight.cents > 0 ? ` · best ${formatCents(p.bestNight.cents)}` : ''}
                  </span>
                </span>
                <Amount cents={p.totalCents} className="shrink-0 text-[18px] font-bold" />
              </Card>
            ))}
          </ol>
          <p className="mt-2 px-1 text-[12px] text-ink-3">
            Totals across {season.nights} night{season.nights === 1 ? '' : 's'} add up to {formatCents(season.balanceCheckCents)}. Players are matched by name.
          </p>

          <SectionTitle>Highlights</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {season.biggestHand ? (
              <Highlight icon={<Trophy size={16} />} label="Biggest hand" value={formatCents(season.biggestHand.cents)} sub={`${season.biggestHand.name} · ${formatDate(season.biggestHand.date)}`} />
            ) : null}
            {season.kongKing ? <Highlight icon={<Sparkles size={16} />} label="Kong king" value={season.kongKing.name} sub={`${season.kongKing.kongs} kong${season.kongKing.kongs === 1 ? '' : 's'}`} /> : null}
            {season.selfDrawKing ? (
              <Highlight icon={<Zap size={16} />} label="Self-draw specialist" value={season.selfDrawKing.name} sub={`${season.selfDrawKing.selfDraws} self-draw${season.selfDrawKing.selfDraws === 1 ? '' : 's'}`} />
            ) : null}
            {season.longestStreak ? (
              <Highlight icon={<Flame size={16} />} label="Longest streak" value={season.longestStreak.name} sub={`${season.longestStreak.streak} winning night${season.longestStreak.streak === 1 ? '' : 's'} in a row`} />
            ) : null}
          </div>

          <Button className="mt-6" block icon={<MessageCircle size={16} />} onClick={share}>
            Share season
          </Button>
          <p className="mt-3 px-1 text-center text-[12px] text-ink-3">Includes games saved on this phone, including shared games you joined.</p>
        </>
      )}
    </main>
  );
}

function Highlight({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card as="div" className="p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
        <span className="text-gold">{icon}</span>
        {label}
      </div>
      <div className="num mt-1 truncate text-[17px] font-bold">{value}</div>
      <div className="truncate text-[12px] text-ink-3">{sub}</div>
    </Card>
  );
}
