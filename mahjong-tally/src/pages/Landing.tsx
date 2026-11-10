import { useState } from 'react';
import { ArrowRight, Download, Play, Plus, Trophy } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, TileLogo } from '../components/domain';
import { InstallGuide } from '../components/InstallGuide';
import { Button, Card } from '../components/ui';
import { activeRounds, gameBalances } from '../engine/game';
import { formatDateTime } from '../utils/time';

export function Landing() {
  const store = useStore();
  const [installOpen, setInstallOpen] = useState(false);
  const continueGame = store.activeGame ?? store.games.find((g) => g.status === 'active') ?? null;

  const start = () => navigate(store.settings.houseRules ? '/new' : '/rules?target=setup');
  const resume = () => {
    if (!continueGame) return;
    if (store.settings.activeGameId !== continueGame.id) store.openGame(continueGame.id);
    navigate('/home');
  };

  const leader = continueGame
    ? gameBalances(continueGame).reduce((best, b) => (b.netCents > best.netCents ? b : best))
    : null;
  const leaderName = leader ? continueGame?.players.find((p) => p.id === leader.playerId)?.name : undefined;

  return (
    <main className="relative mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[max(env(safe-area-inset-top),24px)]">
      <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <div className="animate-rise-in">
          <TileLogo size={84} />
        </div>
        <h1
          className="mt-8 font-display text-[40px] font-semibold leading-none tracking-[-0.03em] text-ink animate-rise-in"
          style={{ animationDelay: '60ms' }}
        >
          MAHJONG TALLY
        </h1>
        <p className="mt-3 text-[17px] text-ink-2 animate-rise-in" style={{ animationDelay: '120ms' }}>
          Every point accounted for.
        </p>
        <div className="mx-auto mt-5 h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" aria-hidden="true" />
      </div>

      <div className="space-y-3 animate-rise-in" style={{ animationDelay: '180ms' }}>
        {continueGame ? (
          <Card className="elev-gold grain relative overflow-hidden p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gold">In progress</div>
                <div className="mt-0.5 truncate text-[17px] font-semibold">{continueGame.name}</div>
                <div className="text-[13px] text-ink-3">
                  {activeRounds(continueGame).length} rounds · updated {formatDateTime(continueGame.updatedAt)}
                </div>
              </div>
              {leader && leader.netCents > 0 && leaderName ? (
                <div className="shrink-0 text-right">
                  <div className="text-[12px] text-ink-3">{leaderName}</div>
                  <Amount cents={leader.netCents} className="text-[15px] font-semibold" />
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Button variant="primary" size="lg" block icon={<Plus size={20} />} onClick={start} data-testid="start-new-game">
          Start New Game
        </Button>
        <Button
          size="lg"
          block
          icon={<Play size={18} />}
          onClick={resume}
          disabled={!continueGame}
          data-testid="continue-game"
          aria-describedby={continueGame ? undefined : 'no-game-hint'}
        >
          Continue Game
        </Button>
        {!continueGame ? (
          <p id="no-game-hint" className="text-center text-[13px] text-ink-3">
            No game in progress yet.
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-2 pt-2">
          {store.games.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/games')} icon={<ArrowRight size={14} />}>
              Saved games ({store.games.length})
            </Button>
          ) : null}
          {store.games.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/season')} icon={<Trophy size={14} />} data-testid="open-season">
              Season
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => setInstallOpen(true)} icon={<Download size={14} />}>
            Install app
          </Button>
        </div>
      </div>
      <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
    </main>
  );
}
