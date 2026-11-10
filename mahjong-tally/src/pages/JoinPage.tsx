import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { TileLogo } from '../components/domain';
import { IdentityPicker } from '../components/Share';
import { Button, Card } from '../components/ui';
import type { GameSession } from '../models/types';

/** Opened from a shared game link: download the game, then ask who this phone belongs to. */
export function JoinPage({ code }: { code: string }) {
  const store = useStore();
  const [state, setState] = useState<{ phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'pick'; game: GameSession }>({
    phase: 'loading',
  });
  const started = useRef(false);

  const join = async () => {
    setState({ phase: 'loading' });
    const r = await store.joinSharedGame(code);
    if (!r.ok) {
      setState({ phase: 'error', message: r.errors[0]?.message ?? 'Could not open this game.' });
      return;
    }
    if (store.settings.identities?.[r.value.id]) navigate('/home', { replace: true });
    else setState({ phase: 'pick', game: r.value });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-5 pb-10 pt-[max(env(safe-area-inset-top),32px)]">
      <div className="flex flex-col items-center text-center">
        <TileLogo size={56} />
        <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.02em]">Join game</h1>
      </div>

      {state.phase === 'loading' ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-ink-2" aria-busy="true">
          <Loader2 size={28} className="animate-spin text-emerald" />
          <p className="text-[15px]">Loading the shared game…</p>
        </div>
      ) : state.phase === 'error' ? (
        <Card className="mt-8 space-y-4 p-5">
          <div className="flex gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-negative" />
            <p className="text-[15px] leading-relaxed text-ink-2" role="alert">
              {state.message}
            </p>
          </div>
          <Button block variant="primary" icon={<RefreshCw size={16} />} onClick={() => void join()}>
            Try again
          </Button>
          <Button block variant="ghost" onClick={() => navigate('/')}>
            Go to start
          </Button>
        </Card>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="text-center">
            <div className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gold">{state.game.name}</div>
            <h2 className="mt-1 text-[22px] font-semibold">Which player are you?</h2>
            <p className="mt-1 text-[14px] text-ink-3">Your balance will be shown first on this phone. You can change it later.</p>
          </div>
          <IdentityPicker
            game={state.game}
            value={null}
            testPrefix="join-me"
            onChange={(id) => {
              store.setIdentity(state.game.id, id);
              navigate('/home', { replace: true });
            }}
          />
          <Button block variant="ghost" onClick={() => navigate('/home', { replace: true })}>
            Just watching
          </Button>
        </div>
      )}
    </main>
  );
}
