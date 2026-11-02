import { useMemo, useState } from 'react';
import { History, Info, ShieldCheck } from 'lucide-react';
import { cloneConfig, exampleConfiguration } from '../config/defaults';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { Amount, PageHeader } from '../components/domain';
import { ConfirmDialog, Sheet, useToast } from '../components/overlay';
import { RulesEditor } from '../components/RulesEditor';
import { Button, Card, ErrorList, cx } from '../components/ui';
import { previewRescore, roundNumbers } from '../engine/game';
import { hasErrors, validateConfig } from '../engine/validation';
import type { ScoringConfiguration, ValidationIssue } from '../models/types';

type Target = 'setup' | 'house' | 'game';

export function RulesPage({ target }: { target: Target }) {
  const store = useStore();
  const toast = useToast();
  const game = store.activeGame;
  const initial = useMemo<ScoringConfiguration>(() => {
    if (target === 'game' && game) return cloneConfig(game.config);
    if (store.settings.houseRules) return cloneConfig(store.settings.houseRules);
    return exampleConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, game?.id]);
  const [config, setConfig] = useState<ScoringConfiguration>(initial);
  const [confirmed, setConfirmed] = useState(target !== 'setup');
  const [alsoDefault, setAlsoDefault] = useState(false);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [rescoreOpen, setRescoreOpen] = useState(false);
  const [rescoreConfirm, setRescoreConfirm] = useState(false);
  const invalid = hasErrors(validateConfig(config));
  const dirty = JSON.stringify(config) !== JSON.stringify(initial);

  if (target === 'game' && !game) return null; // App redirects to Settings

  const back = target === 'setup' ? '/' : '/settings';
  const title = target === 'setup' ? 'Confirm house rules' : target === 'house' ? 'Default house rules' : 'This game’s rules';

  const save = async () => {
    if (invalid) return;
    if (target === 'game') {
      const r = store.updateGameConfig(config);
      if (!r.ok) return setErrors(r.errors);
      if (alsoDefault) await store.saveHouseRules(config);
      toast({ message: alsoDefault ? 'Saved for new rounds and as your default rules.' : 'Rules saved for new rounds.', tone: 'success' });
      navigate('/settings');
      return;
    }
    await store.saveHouseRules(config);
    toast({ message: 'House rules saved.', tone: 'success' });
    navigate(target === 'setup' ? '/new' : '/settings');
  };

  const rescore = game ? previewRescore(game, config) : null;
  const numbers = game ? roundNumbers(game) : new Map<string, number>();

  return (
    <main className="mx-auto max-w-lg px-4 pb-40 pt-safe">
      <PageHeader title={title} subtitle={target === 'game' ? game?.name : 'Saved for every new game'} back={back} />

      {target === 'setup' ? (
        <Card className="mb-2 border-gold/30 p-4">
          <div className="flex gap-3">
            <Info size={20} className="mt-0.5 shrink-0 text-gold" />
            <div className="space-y-2 text-[14px] leading-relaxed text-ink-2">
              <p className="font-semibold text-ink">Every group plays differently.</p>
              <p>
                The values below are an <strong className="text-gold">example</strong> of a common $0.30 / $0.60 doubling table. They are not official Singapore Mahjong rules. Edit
                them to match exactly how your table pays, then confirm.
              </p>
            </div>
          </div>
        </Card>
      ) : null}
      {target === 'game' ? (
        <Card className="mb-2 p-4">
          <div className="flex gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald" />
            <p className="text-[14px] leading-relaxed text-ink-2">
              Changes apply to <strong className="text-ink">new rounds only</strong>. Rounds already recorded keep the rules they were scored with, so history stays auditable. To
              re-score past rounds, use “Apply to past rounds” below.
            </p>
          </div>
        </Card>
      ) : null}

      <RulesEditor value={config} onChange={setConfig} />

      {target === 'game' && game ? (
        <Card className="mt-6 p-4">
          <div className="flex items-start gap-3">
            <History size={20} className="mt-0.5 shrink-0 text-gold" />
            <div className="flex-1">
              <div className="text-[15px] font-semibold">Apply to past rounds</div>
              <p className="text-[13px] leading-relaxed text-ink-3">Re-score every recorded round with these rules. You’ll see exactly what changes before anything is saved.</p>
              <Button className="mt-3" size="sm" variant="gold" disabled={invalid} onClick={() => setRescoreOpen(true)}>
                Preview re-score
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <div className="mx-auto max-w-lg space-y-3">
          <ErrorList errors={errors} />
          {target === 'game' ? (
            <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-ink-2">
              <input
                type="checkbox"
                checked={alsoDefault}
                onChange={(e) => setAlsoDefault(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--emerald)]"
                data-testid="also-default"
              />
              Also make these my default rules for new games
            </label>
          ) : null}
          {target === 'setup' ? (
            <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-ink-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--emerald)]"
                data-testid="confirm-rules"
              />
              These are the payout rules my group plays with.
            </label>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            block
            disabled={invalid || !confirmed || (target !== 'setup' && !dirty)}
            onClick={save}
            data-testid="save-rules"
          >
            {target === 'setup' ? 'Confirm & continue' : invalid ? 'Fix problems to save' : dirty ? 'Save rules' : 'No changes'}
          </Button>
        </div>
      </div>

      {game ? (
        <>
          <Sheet
            open={rescoreOpen}
            onClose={() => setRescoreOpen(false)}
            title="Re-score preview"
            labelledBy="rescore-title"
            footer={
              rescore?.ok ? (
                <Button variant="primary" block disabled={rescore.value.changedCount === 0} onClick={() => setRescoreConfirm(true)}>
                  {rescore.value.changedCount === 0 ? 'Nothing would change' : `Re-score ${rescore.value.changedCount} round${rescore.value.changedCount > 1 ? 's' : ''}`}
                </Button>
              ) : null
            }
          >
            {!rescore ? null : !rescore.ok ? (
              <ErrorList errors={rescore.errors} />
            ) : (
              <div className="space-y-4">
                <table className="w-full text-[14px]">
                  <thead className="text-[12px] uppercase tracking-wide text-ink-3">
                    <tr>
                      <th className="py-1 text-left font-semibold">Player</th>
                      <th className="py-1 text-right font-semibold">Now</th>
                      <th className="py-1 text-right font-semibold">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {game.players.map((p) => {
                      const before = rescore.value.balancesBefore[p.id] ?? 0;
                      const after = rescore.value.balancesAfter[p.id] ?? 0;
                      return (
                        <tr key={p.id} className="border-t border-line">
                          <td className="py-2">{p.name}</td>
                          <td className="py-2 text-right">
                            <Amount cents={before} />
                          </td>
                          <td className={cx('py-2 text-right', before !== after && 'font-semibold')}>
                            <Amount cents={after} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-[13px] text-ink-3">
                  {rescore.value.changedCount} of {rescore.value.rounds.length} rounds change:{' '}
                  {rescore.value.rounds
                    .filter((r) => r.changed)
                    .map((r) => `#${numbers.get(r.roundId)}`)
                    .join(', ') || 'none'}
                  .
                </div>
              </div>
            )}
          </Sheet>
          <ConfirmDialog
            open={rescoreConfirm}
            title="Re-score past rounds?"
            tone="primary"
            confirmLabel="Re-score"
            body="Every recorded round will be recalculated with these rules and the new rules will be used for future rounds. Each round keeps an audit note of its previous result."
            onCancel={() => setRescoreConfirm(false)}
            onConfirm={() => {
              const r = store.applyRescore(config);
              setRescoreConfirm(false);
              setRescoreOpen(false);
              if (!r.ok) setErrors(r.errors);
              else {
                toast({ message: 'All rounds re-scored.', tone: 'success' });
                navigate('/history');
              }
            }}
          />
        </>
      ) : null}
    </main>
  );
}
