import { useEffect, useMemo, useState } from 'react';
import { Pencil, Users } from 'lucide-react';
import { DEFAULT_PLAYER_NAMES, SEAT_LABEL, cloneConfig } from '../config/defaults';
import { navigate } from '../app/router';
import { useStore } from '../app/store';
import { PageHeader, SeatBadge } from '../components/domain';
import { Sheet } from '../components/overlay';
import { RulesEditor } from '../components/RulesEditor';
import { AnimalPicker } from '../components/Table';
import { Button, Card, ErrorList, Field, SectionTitle, TextInput, cx } from '../components/ui';
import { hasErrors, validateConfig, validatePlayers } from '../engine/validation';
import { SEATS, type Player, type ScoringConfiguration, type Seat, type ValidationIssue } from '../models/types';
import { newId } from '../utils/id';
import { defaultGameName } from '../utils/time';
import { RulesSummary } from './RulesSummary';

export function NewGame() {
  const store = useStore();
  const houseRules = store.settings.houseRules;
  useEffect(() => {
    if (store.status === 'ready' && !houseRules) navigate('/rules?target=setup', { replace: true });
  }, [store.status, houseRules]);

  const [name, setName] = useState(() => defaultGameName(new Date()));
  const [players, setPlayers] = useState<Player[]>(() =>
    SEATS.map((seat, i) => ({
      id: newId(),
      seat,
      name: store.settings.lastPlayerNames[i] ?? DEFAULT_PLAYER_NAMES[i]!,
    })),
  );
  // The first dealer is East by default; the app then moves the deal on after each hand.
  const [dealerId, setDealerId] = useState<string | undefined>(() => players.find((p) => p.seat === 'east')?.id);
  const [config, setConfig] = useState<ScoringConfiguration | null>(houseRules ? cloneConfig(houseRules) : null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<ScoringConfiguration | null>(null);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);

  const playerIssues = useMemo(() => validatePlayers(players), [players]);

  const setSeat = (index: number, seat: Seat) => {
    setPlayers((list) => {
      const other = list.findIndex((p) => p.seat === seat);
      const current = list[index]!.seat;
      return list.map((p, i) => (i === index ? { ...p, seat } : i === other ? { ...p, seat: current } : p));
    });
  };

  const start = () => {
    if (!config) return;
    const result = store.startGame({ name, players, config, ...(dealerId ? { initialDealerId: dealerId } : {}) });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    navigate('/home');
  };

  if (!config) return null;
  const sorted = [...players].sort((a, b) => SEATS.indexOf(a.seat) - SEATS.indexOf(b.seat));

  return (
    <main className="mx-auto max-w-lg px-4 pb-32 pt-safe">
      <PageHeader title="New game" subtitle="Four players, one table." back="/" />

      <Card className="p-4">
        <Field label="Game name" htmlFor="game-name">
          <TextInput id="game-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </Card>

      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} /> Players & seats
        </span>
      </SectionTitle>
      <Card className="divide-y divide-line p-0">
        {players.map((p, i) => {
          const nameErr = playerIssues.find((x) => x.path === `players.${i}.name`)?.message;
          return (
            <div key={p.id} className="flex items-start gap-3 p-3.5">
              <div className="pt-2">
                <SeatBadge seat={p.seat} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <label className="block">
                  <span className="sr-only">Player {i + 1} name</span>
                  <TextInput
                    value={p.name}
                    aria-invalid={Boolean(nameErr)}
                    data-testid={`player-name-${i}`}
                    onChange={(e) => setPlayers((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    onFocus={(e) => e.target.select()}
                    maxLength={24}
                  />
                </label>
                {nameErr ? <p className="px-1 text-[12px] text-negative">{nameErr}</p> : null}
                <div role="radiogroup" aria-label={`Seat for ${p.name || `player ${i + 1}`}`} className="flex gap-1.5">
                  {SEATS.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      role="radio"
                      aria-checked={p.seat === seat}
                      onClick={() => setSeat(i, seat)}
                      className={cx(
                        'pressable min-h-9 flex-1 rounded-lg border text-[12px] font-semibold',
                        p.seat === seat ? 'border-emerald bg-emerald-soft text-positive' : 'border-line bg-surface-2 text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {SEAT_LABEL[seat]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
      <p className="mt-2 px-1 text-[12px] text-ink-3">Picking a seat that is taken swaps the two players.</p>

      <SectionTitle>Spirit animals (optional)</SectionTitle>
      <Card className="p-4">
        <AnimalPicker players={players} onChange={setPlayers} />
        <p className="mt-3 text-[12px] text-ink-3">Each player gets one animal. Drawing your own animal is paid by everyone. Picking an animal someone else has swaps them.</p>
      </Card>

      <SectionTitle>First dealer</SectionTitle>
      <p className="-mt-1 mb-2 px-1 text-[12px] text-ink-3">Deals the first hand as East. The app moves the deal and the round wind on after each hand. Choose None to not track them.</p>
      <div role="radiogroup" aria-label="Starting dealer" className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          role="radio"
          aria-checked={!dealerId}
          onClick={() => setDealerId(undefined)}
          className={cx(
            'pressable min-h-12 rounded-xl border px-1 text-[12px] font-semibold',
            !dealerId ? 'border-gold bg-gold-soft text-gold' : 'border-line bg-surface text-ink-3',
          )}
        >
          None
        </button>
        {sorted.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={dealerId === p.id}
            onClick={() => setDealerId(p.id)}
            className={cx(
              'pressable min-h-12 truncate rounded-xl border px-1 text-[12px] font-semibold',
              dealerId === p.id ? 'border-gold bg-gold-soft text-gold' : 'border-line bg-surface text-ink-2',
            )}
          >
            {p.name || '—'}
          </button>
        ))}
      </div>

      <SectionTitle
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil size={14} />}
            onClick={() => {
              setDraftRules(cloneConfig(config));
              setRulesOpen(true);
            }}
          >
            Customise
          </Button>
        }
      >
        House rules for this game
      </SectionTitle>
      <RulesSummary config={config} />

      <div className="mt-6 space-y-3">
        <ErrorList errors={errors} />
        <Button variant="primary" size="lg" block disabled={hasErrors(playerIssues)} onClick={start} data-testid="start-game">
          Start Game
        </Button>
      </div>

      <Sheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="Rules for this game"
        labelledBy="game-rules-title"
        footer={
          <Button
            variant="primary"
            block
            disabled={!draftRules || hasErrors(validateConfig(draftRules))}
            onClick={() => {
              if (draftRules) setConfig(draftRules);
              setRulesOpen(false);
            }}
          >
            Use for this game
          </Button>
        }
      >
        {draftRules ? <RulesEditor value={draftRules} onChange={setDraftRules} /> : null}
      </Sheet>
    </main>
  );
}
