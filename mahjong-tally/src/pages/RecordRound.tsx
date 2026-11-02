import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleSlash, Hand, Plus, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react';
import { navigate } from '../app/router';
import { useStore, type RoundInputDraft } from '../app/store';
import { Amount, PageHeader, RoundNetLines, SeatBadge, TransactionList, playerMap } from '../components/domain';
import { Sheet, useToast } from '../components/overlay';
import { Badge, Button, Card, ErrorList, IconButton, MoneyInput, Segmented, Stepper, TextInput, Toggle, cx } from '../components/ui';
import { previewEdit, previewRound, roundNet, roundNumbers, suggestNextDealer } from '../engine/game';
import { PLAYER_BONUS_KINDS, WIN_ONLY_BONUS_KINDS } from '../engine/validation';
import type { AppliedBonus, GameSession, Player, PlayerId, RoundInput, ScoringConfiguration } from '../models/types';
import { formatCents } from '../utils/money';
import { newId } from '../utils/id';
import { NoGame } from './Dashboard';
import { describeInput, methodLabel } from './describe';

type Draft = Partial<RoundInputDraft>;

function draftFromInput(input: RoundInput): Draft {
  const o = input.outcome;
  return {
    kind: o.type,
    ...(o.type === 'win'
      ? {
          winnerId: o.winnerId,
          method: o.method,
          ...(o.discarderId ? { discarderId: o.discarderId } : {}),
          ...(o.liablePlayerId ? { liablePlayerId: o.liablePlayerId } : {}),
          tai: o.tai,
        }
      : {}),
    ...(input.dealerId ? { dealerId: input.dealerId } : { dealerId: '' }),
    bonuses: input.bonuses.map((b) => ({ ...b })),
    manualAdjustments: input.manualAdjustments.map((m) => ({ ...m })),
  };
}

/** Convert the step-by-step draft into a complete RoundInput, or list what is missing. */
function buildInput(d: Draft, config: ScoringConfiguration): { input?: RoundInput; missing: string[] } {
  const missing: string[] = [];
  const kind = d.kind ?? 'win';
  const bonusKinds = new Map(config.bonusRules.map((r) => [r.id, r.kind]));
  const bonuses = (d.bonuses ?? []).filter((b) => kind === 'win' || !WIN_ONLY_BONUS_KINDS.includes(bonusKinds.get(b.ruleId) ?? 'extra_tai'));
  const base = {
    ...(d.dealerId ? { dealerId: d.dealerId } : {}),
    bonuses,
    manualAdjustments: d.manualAdjustments ?? [],
  };
  if (kind === 'draw') return { input: { outcome: { type: 'draw' }, ...base }, missing };
  if (!d.winnerId) missing.push('Select the winner');
  if (!d.method) missing.push('Choose Self Draw or Discard Win');
  if (d.method === 'discard' && !d.discarderId) missing.push('Select who discarded');
  if (d.tai === undefined) missing.push('Select the tai');
  if (missing.length) return { missing };
  return {
    input: {
      outcome: {
        type: 'win',
        winnerId: d.winnerId!,
        method: d.method!,
        ...(d.method === 'discard' ? { discarderId: d.discarderId! } : {}),
        ...(d.method === 'self_draw' && d.liablePlayerId ? { liablePlayerId: d.liablePlayerId } : {}),
        tai: d.tai!,
      },
      ...base,
    },
    missing,
  };
}

export function RecordRound({ editId }: { editId?: string | undefined }) {
  const store = useStore();
  const game = store.activeGame;
  if (!game) return <NoGame />;
  if (game.status === 'finished' && !editId) {
    return (
      <div className="pt-6">
        <PageHeader title="Record round" />
        <Card className="p-5 text-[15px] text-ink-2">
          This game is finished. Reopen it from Settings to record more rounds.
          <Button className="mt-4" block onClick={() => store.reopenGame()}>
            Reopen game
          </Button>
        </Card>
      </div>
    );
  }
  return <RecordRoundForm key={editId ?? 'new'} game={game} editId={editId} />;
}

function RecordRoundForm({ game, editId }: { game: GameSession; editId?: string | undefined }) {
  const store = useStore();
  const toast = useToast();
  const editing = editId ? game.rounds.find((r) => r.id === editId && !r.deletedAt) : undefined;
  const byId = playerMap(game.players);
  const numbers = roundNumbers(game);

  // Draft lives in the store so switching tabs never loses a half-entered round.
  const storeDraft = store.draft;
  const draftMatches = storeDraft && (storeDraft.editingRoundId ?? undefined) === (editing?.id ?? undefined);
  const [draft, setDraftState] = useState<Draft>(() => {
    if (draftMatches) return storeDraft.input;
    if (editing) return draftFromInput(editing.input);
    return { kind: 'win', dealerId: suggestNextDealer(game) ?? '', bonuses: [], manualAdjustments: [] };
  });
  const setDraft = (patch: Draft) => setDraftState((d) => ({ ...d, ...patch }));
  useEffect(() => {
    store.setDraft({ ...(editing ? { editingRoundId: editing.id } : {}), input: draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const useCurrentRules = Boolean(draft.useCurrentRules);
  const config = editing && !useCurrentRules ? editing.configSnapshot : game.config;
  const { input, missing } = buildInput(draft, config);
  const preview = useMemo(() => {
    if (!input) return null;
    return editing ? previewEdit(game, editing.id, input, { rules: useCurrentRules ? 'current' : 'snapshot' }) : previewRound(game, input);
  }, [game, editing, input && JSON.stringify(input), useCurrentRules]); // eslint-disable-line react-hooks/exhaustive-deps

  const [reviewOpen, setReviewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => Boolean((draft.bonuses?.length ?? 0) + (draft.manualAdjustments?.length ?? 0)));
  const [submitErrors, setSubmitErrors] = useState<{ message: string }[]>([]);

  const kind = draft.kind ?? 'win';
  const winner = draft.winnerId ? byId.get(draft.winnerId) : undefined;
  const opponents = game.players.filter((p) => p.id !== draft.winnerId);
  const taiValues: number[] = [];
  for (let t = config.minTai; t <= config.maxTai; t += 1) taiValues.push(t);
  const liableAllowed = config.selfDrawPayers === 'all_opponents_or_liable';

  const confirm = () => {
    if (!input) return;
    const result = editing
      ? store.editRound(editing.id, input, { rules: useCurrentRules ? 'current' : 'snapshot' })
      : store.recordRound(input);
    if (!result.ok) {
      setSubmitErrors(result.errors);
      return;
    }
    setReviewOpen(false);
    const n = roundNumbers(result.value.game).get(result.value.round.id);
    if (editing) {
      toast({ message: `Round ${n} updated. Balances recalculated.`, tone: 'success' });
      navigate('/history');
    } else {
      const roundId = result.value.round.id;
      toast({
        message: `Round ${n} recorded.`,
        tone: 'success',
        action: { label: 'Undo', run: () => store.deleteRound(roundId) },
      });
      navigate('/home');
    }
  };

  const cancel = () => {
    store.setDraft(null);
    navigate(editing ? '/history' : '/home');
  };

  const winnerTotal = preview?.ok && draft.winnerId ? (preview.value.net[draft.winnerId] ?? 0) : null;
  const previewOk = Boolean(preview?.ok);

  return (
    <div className="pb-44">
      <PageHeader
        title={editing ? `Edit round ${numbers.get(editing.id) ?? ''}` : 'Record round'}
        subtitle={editing ? 'Balances recalculate when you save' : `Round ${numbers.size + 1} · ${config.stakeLabel}`}
        right={
          editing || draft.winnerId || draft.kind === 'draw' ? (
            <IconButton label={editing ? 'Cancel edit' : 'Clear'} onClick={cancel}>
              <X size={20} />
            </IconButton>
          ) : undefined
        }
      />

      {editing ? (
        <Card className="mb-4 p-4">
          <Toggle
            label="Score with current rules"
            description={
              useCurrentRules
                ? 'This round will be re-scored with the game’s current rules.'
                : 'Uses the rules this round was originally scored with.'
            }
            checked={useCurrentRules}
            onChange={(v) => setDraft({ useCurrentRules: v })}
          />
        </Card>
      ) : null}

      <Segmented
        label="Round result"
        value={kind}
        onChange={(v) => setDraft({ kind: v })}
        options={[
          { value: 'win', label: 'Someone won' },
          { value: 'draw', label: 'Draw 流局' },
        ]}
      />

      {kind === 'win' ? (
        <>
          <StepTitle n={1} done={Boolean(draft.winnerId)}>
            Who won?
          </StepTitle>
          <div role="radiogroup" aria-label="Winner" className="grid grid-cols-2 gap-3">
            {game.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                selected={draft.winnerId === p.id}
                testId={`winner-${p.seat}`}
                onSelect={() =>
                  setDraft({
                    winnerId: p.id,
                    ...(draft.discarderId === p.id ? { discarderId: '' } : {}),
                    ...(draft.liablePlayerId === p.id ? { liablePlayerId: '' } : {}),
                  })
                }
              />
            ))}
          </div>

          <StepTitle n={2} done={Boolean(draft.method && (draft.method === 'self_draw' || draft.discarderId))}>
            How did {winner?.name ?? 'they'} win?
          </StepTitle>
          <div role="radiogroup" aria-label="Winning method" className="grid grid-cols-2 gap-3">
            <MethodButton
              selected={draft.method === 'self_draw'}
              glyph="自摸"
              label="Self Draw"
              hint="All three pay"
              testId="method-self-draw"
              onSelect={() => setDraft({ method: 'self_draw', discarderId: '' })}
            />
            <MethodButton
              selected={draft.method === 'discard'}
              glyph="放炮"
              label="Discard Win"
              hint={config.discardLiability === 'shared' ? 'Discarder + others' : 'Discarder pays'}
              testId="method-discard"
              onSelect={() => setDraft({ method: 'discard', liablePlayerId: '' })}
            />
          </div>

          {draft.method === 'discard' ? (
            <div className="mt-3 animate-fade-in">
              <div className="mb-2 px-1 text-[14px] font-medium text-ink-2">Who discarded the winning tile?</div>
              <ChipRow
                label="Discarder"
                players={opponents}
                value={draft.discarderId ?? ''}
                onChange={(id) => setDraft({ discarderId: id })}
                testPrefix="discarder"
                tone="negative"
              />
            </div>
          ) : null}
          {draft.method === 'self_draw' && liableAllowed ? (
            <div className="mt-3 animate-fade-in">
              <div className="mb-2 px-1 text-[14px] font-medium text-ink-2">Liable player (包)? Optional</div>
              <ChipRow
                label="Liable player"
                players={opponents}
                value={draft.liablePlayerId ?? ''}
                onChange={(id) => setDraft({ liablePlayerId: id })}
                allowNone="No one"
                testPrefix="liable"
                tone="negative"
              />
            </div>
          ) : null}

          <StepTitle n={3} done={draft.tai !== undefined}>
            How many tai?
          </StepTitle>
          <div role="radiogroup" aria-label="Tai" className="grid grid-cols-5 gap-2">
            {taiValues.map((t) => {
              const row = config.payoutTable.find((r) => r.tai === t);
              const hint = row
                ? draft.method === 'self_draw'
                  ? formatCents(row.selfDrawEachPays)
                  : draft.method === 'discard'
                    ? formatCents(row.discarderPays)
                    : ''
                : '';
              const active = draft.tai === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`tai-${t}`}
                  onClick={() => setDraft({ tai: t })}
                  className={cx(
                    'pressable flex min-h-16 flex-col items-center justify-center rounded-2xl border px-0.5',
                    active ? 'border-emerald bg-emerald text-emerald-ink elev-1' : 'border-line bg-surface text-ink hover:border-line-strong',
                  )}
                >
                  <span className="num text-[20px] font-bold leading-none">{t}</span>
                  <span className={cx('num mt-1 text-[10.5px] font-medium tracking-tight', active ? 'opacity-80' : 'text-ink-3')}>{hint || 'tai'}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <Card className="mt-4 flex items-center gap-3 p-4 text-[14px] text-ink-2">
          <CircleSlash size={20} className="shrink-0 text-ink-3" />
          No one won this hand. No hand payment is made. You can still record instant bonuses or penalties below.
        </Card>
      )}

      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        aria-expanded={moreOpen}
        className="pressable mt-6 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-left"
      >
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {kind === 'win' ? '4 · ' : ''}Additional conditions
        </span>
        <span className="flex items-center gap-2 text-[13px] text-ink-3">
          {(draft.bonuses?.length ?? 0) + (draft.manualAdjustments?.length ?? 0) > 0 ? (
            <Badge tone="gold">{(draft.bonuses?.length ?? 0) + (draft.manualAdjustments?.length ?? 0)} applied</Badge>
          ) : null}
          <ChevronDown size={18} className={cx('transition-transform', moreOpen && 'rotate-180')} />
        </span>
      </button>
      {moreOpen ? (
        <AdditionalConditions game={game} config={config} draft={draft} kind={kind} setDraft={setDraft} />
      ) : null}

      {/* Sticky action bar with live preview */}
      <div className="glass fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 border-t border-line px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            {preview && !preview.ok ? (
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-negative">
                <ShieldAlert size={16} className="shrink-0" />
                <span className="line-clamp-2">{preview.errors[0]?.message}</span>
              </div>
            ) : kind === 'win' && winnerTotal !== null && winner ? (
              <div>
                <div className="truncate text-[12px] text-ink-3">{winner.name} receives</div>
                <Amount cents={winnerTotal} className="text-[22px] font-bold leading-tight" />
              </div>
            ) : kind === 'draw' && previewOk ? (
              <div className="text-[14px] font-medium text-ink-2">Drawn round</div>
            ) : (
              <div className="text-[13px] text-ink-3">{missing[0] ?? 'Complete the steps above'}</div>
            )}
          </div>
          <Button variant="primary" size="lg" disabled={!previewOk} onClick={() => setReviewOpen(true)} data-testid="review-round">
            Review
          </Button>
        </div>
      </div>

      {preview?.ok && input ? (
        <Sheet
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          title={editing ? 'Confirm changes' : 'Payment preview'}
          labelledBy="review-title"
          footer={
            <div className="space-y-3">
              <ErrorList errors={submitErrors} />
              <div className="flex gap-3">
                <Button block size="lg" onClick={() => setReviewOpen(false)}>
                  Cancel
                </Button>
                <Button block size="lg" variant="primary" onClick={confirm} data-testid="confirm-round">
                  {editing ? 'Save changes' : 'Confirm Round'}
                </Button>
              </div>
            </div>
          }
        >
          <ReviewContent game={game} input={input} preview={preview.value} editingNet={editing ? roundNet(game, editing) : undefined} />
        </Sheet>
      ) : null}
    </div>
  );
}

function ReviewContent({
  game,
  input,
  preview,
  editingNet,
}: {
  game: GameSession;
  input: RoundInput;
  preview: NonNullable<ReturnType<typeof previewRound> & { ok: true }>['value'];
  editingNet?: Record<PlayerId, number> | undefined;
}) {
  const byId = playerMap(game.players);
  const d = describeInput(input, byId, preview.scored.effectiveTai);
  const o = input.outcome;
  const total = Object.values(preview.net).reduce((a, b) => a + b, 0);
  const passed = preview.validation.ok && total === 0;
  const [showDetail, setShowDetail] = useState(false);
  return (
    <div className="space-y-4" data-testid="payment-preview">
      <dl className="grid grid-cols-2 gap-2 text-[14px]">
        <div className="rounded-2xl bg-surface-2 p-3">
          <dt className="text-[12px] text-ink-3">{o.type === 'win' ? 'Winner' : 'Result'}</dt>
          <dd className="truncate font-semibold">{o.type === 'win' ? byId.get(o.winnerId)?.name : 'Draw 流局'}</dd>
        </div>
        <div className="rounded-2xl bg-surface-2 p-3">
          <dt className="text-[12px] text-ink-3">Winning method</dt>
          <dd className="truncate font-semibold">{o.type === 'win' ? methodLabel(o.method) : '—'}</dd>
        </div>
        {o.type === 'win' ? (
          <div className="col-span-2 rounded-2xl bg-surface-2 p-3">
            <dt className="text-[12px] text-ink-3">Hand</dt>
            <dd className="font-semibold">{d.subtitle}</dd>
          </div>
        ) : null}
      </dl>

      <div>
        <div className="mb-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">Payments</div>
        <RoundNetLines players={game.players} net={preview.net} winnerId={o.type === 'win' ? o.winnerId : undefined} />
      </div>

      {editingNet ? (
        <div className="rounded-2xl border border-gold/30 bg-gold-soft p-3 text-[13px]">
          <div className="mb-1 font-semibold text-gold">Change from saved round</div>
          {game.players.map((p) => {
            const before = editingNet[p.id] ?? 0;
            const after = preview.net[p.id] ?? 0;
            return (
              <div key={p.id} className="num flex justify-between gap-2 text-ink-2">
                <span>{p.name}</span>
                <span>
                  {formatCents(before, { signed: true })} → <span className="font-semibold text-ink">{formatCents(after, { signed: true })}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        className={cx(
          'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[14px] font-semibold',
          passed ? 'border-emerald/30 bg-emerald-soft text-positive' : 'border-negative/40 bg-negative-soft text-negative',
        )}
        data-testid="balance-verification"
      >
        {passed ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
        Balance verification: {passed ? 'PASSED' : 'FAILED'}
        <span className="num ml-auto font-normal opacity-80">Net {formatCents(total)}</span>
      </div>

      {preview.scored.notes.length ? (
        <ul className="space-y-1 text-[13px] text-ink-3">
          {preview.scored.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDetail((v) => !v)}
        aria-expanded={showDetail}
        className="pressable flex w-full items-center justify-between rounded-xl px-1 py-1 text-[14px] font-medium text-emerald"
      >
        How this was calculated
        <ChevronDown size={18} className={cx('transition-transform', showDetail && 'rotate-180')} />
      </button>
      {showDetail ? <TransactionList transactions={preview.transactions} players={game.players} /> : null}
    </div>
  );
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center gap-2 px-1">
      <span
        className={cx(
          'num flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold',
          done ? 'bg-emerald text-emerald-ink' : 'bg-surface-3 text-ink-3',
        )}
        aria-hidden="true"
      >
        {done ? '✓' : n}
      </span>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
    </div>
  );
}

function PlayerCard({ player, selected, onSelect, testId }: { player: Player; selected: boolean; onSelect: () => void; testId: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cx(
        'pressable relative flex min-h-[84px] flex-col items-start justify-between rounded-3xl border p-3.5 text-left',
        selected ? 'border-gold bg-gold-soft elev-gold' : 'border-line bg-surface hover:border-line-strong elev-1',
      )}
    >
      <SeatBadge seat={player.seat} size="sm" />
      <span className="mt-2 w-full truncate text-[16px] font-semibold text-ink">{player.name}</span>
      {selected ? <Hand size={18} className="absolute right-3 top-3 text-gold" aria-hidden="true" /> : null}
    </button>
  );
}

function MethodButton({
  selected,
  glyph,
  label,
  hint,
  onSelect,
  testId,
}: {
  selected: boolean;
  glyph: string;
  label: string;
  hint: string;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cx(
        'pressable flex min-h-[104px] flex-col items-center justify-center rounded-3xl border px-3 text-center',
        selected ? 'border-emerald bg-emerald text-emerald-ink elev-1' : 'border-line bg-surface text-ink hover:border-line-strong elev-1',
      )}
    >
      <span className="font-display text-[28px] font-semibold leading-none">{glyph}</span>
      <span className="mt-1.5 text-[15px] font-semibold">{label}</span>
      <span className={cx('text-[12px]', selected ? 'opacity-80' : 'text-ink-3')}>{hint}</span>
    </button>
  );
}

function ChipRow({
  label,
  players,
  value,
  onChange,
  allowNone,
  testPrefix,
  tone = 'gold',
}: {
  label: string;
  players: Player[];
  value: string;
  onChange: (id: string) => void;
  allowNone?: string;
  testPrefix: string;
  tone?: 'gold' | 'negative';
}) {
  const activeCls = tone === 'negative' ? 'border-negative/60 bg-negative-soft text-negative' : 'border-gold bg-gold-soft text-gold';
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {allowNone ? (
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          onClick={() => onChange('')}
          className={cx('pressable min-h-11 rounded-xl border px-4 text-[14px] font-semibold', !value ? 'border-line-strong bg-surface-3 text-ink' : 'border-line bg-surface text-ink-3')}
        >
          {allowNone}
        </button>
      ) : null}
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          data-testid={`${testPrefix}-${p.seat}`}
          onClick={() => onChange(p.id)}
          className={cx(
            'pressable inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-[14px] font-semibold',
            value === p.id ? activeCls : 'border-line bg-surface text-ink-2 hover:border-line-strong',
          )}
        >
          <SeatBadge seat={p.seat} size="sm" />
          {p.name}
        </button>
      ))}
    </div>
  );
}

function AdditionalConditions({
  game,
  config,
  draft,
  kind,
  setDraft,
}: {
  game: GameSession;
  config: ScoringConfiguration;
  draft: Draft;
  kind: 'win' | 'draw';
  setDraft: (patch: Draft) => void;
}) {
  const bonuses = draft.bonuses ?? [];
  const manual = draft.manualAdjustments ?? [];
  const enabledRules = config.bonusRules.filter((r) => r.enabled && (kind === 'win' || !WIN_ONLY_BONUS_KINDS.includes(r.kind)));
  const [adding, setAdding] = useState(false);

  const countFor = (ruleId: string, playerId?: string) =>
    bonuses.find((b) => b.ruleId === ruleId && (playerId === undefined || b.playerId === playerId))?.count ?? 0;
  const setCount = (ruleId: string, count: number, playerId?: string) => {
    const others = bonuses.filter((b) => !(b.ruleId === ruleId && (playerId === undefined || b.playerId === playerId)));
    const next: AppliedBonus[] = count > 0 ? [...others, { ruleId, count, ...(playerId ? { playerId } : {}) }] : others;
    setDraft({ bonuses: next });
  };

  return (
    <div className="space-y-3 animate-fade-in">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[15px] font-medium">Dealer this round</div>
          {config.dealer.enabled ? <Badge tone="gold">Dealer bonus on</Badge> : <Badge>No dealer bonus</Badge>}
        </div>
        <ChipRow label="Dealer" players={game.players} value={draft.dealerId ?? ''} onChange={(id) => setDraft({ dealerId: id })} allowNone="None" testPrefix="dealer" />
        <p className="mt-2 text-[12px] text-ink-3">
          {config.dealer.enabled
            ? 'Dealer values from your house rules apply automatically when the dealer wins or pays.'
            : 'Recorded for reference only. Turn on dealer bonuses in the rules if your group uses them.'}
        </p>
      </Card>

      {enabledRules.length === 0 ? (
        <Card className="p-4 text-[14px] text-ink-3">
          No special hands, flower or penalty rules are switched on. Configure them in Settings → Scoring rules.
        </Card>
      ) : (
        enabledRules.map((rule) => {
          const playerScoped = PLAYER_BONUS_KINDS.includes(rule.kind);
          const valueText =
            rule.kind === 'extra_tai' ? `+${rule.value} tai` : rule.kind === 'payout_multiplier' ? `${rule.value}%` : formatCents(rule.value);
          return (
            <Card key={rule.id} className="p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Sparkles size={16} className="shrink-0 text-gold" />
                  <span className="truncate text-[15px] font-medium">{rule.name}</span>
                </div>
                <span className="num text-[13px] text-ink-3">
                  {valueText}
                  {rule.kind === 'collect_from_each' ? ' from each' : rule.kind === 'penalty_pay_each' ? ' to each' : rule.kind === 'winner_bonus_per_payer' ? ' per payer' : ''}
                </span>
              </div>
              {playerScoped ? (
                <div className="space-y-2">
                  {game.players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-[14px]">
                        <SeatBadge seat={p.seat} size="sm" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <Stepper label={`${rule.name} for ${p.name}`} value={countFor(rule.id, p.id)} min={0} max={99} onChange={(v) => setCount(rule.id, v, p.id)} />
                    </div>
                  ))}
                </div>
              ) : rule.kind === 'payout_multiplier' ? (
                <Toggle label="Apply to this hand" checked={countFor(rule.id) > 0} onChange={(v) => setCount(rule.id, v ? 1 : 0)} />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-ink-2">Times applied</span>
                  <Stepper label={`${rule.name} count`} value={countFor(rule.id)} min={0} max={99} onChange={(v) => setCount(rule.id, v)} />
                </div>
              )}
            </Card>
          );
        })
      )}

      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[15px] font-medium">Manual adjustments</div>
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add
          </Button>
        </div>
        {manual.length === 0 && !adding ? <p className="text-[13px] text-ink-3">For one-off penalties or agreed corrections.</p> : null}
        <ul className="space-y-2">
          {manual.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[14px]">
              <span className="min-w-0">
                <span className="block truncate">
                  {game.players.find((p) => p.id === m.payerId)?.name} → {game.players.find((p) => p.id === m.receiverId)?.name}
                </span>
                <span className="block truncate text-[12px] text-ink-3">{m.note || 'Manual adjustment'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="num font-semibold">{formatCents(m.amountCents)}</span>
                <IconButton label="Remove adjustment" className="h-9 w-9" onClick={() => setDraft({ manualAdjustments: manual.filter((x) => x.id !== m.id) })}>
                  <Trash2 size={16} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
        {adding ? (
          <ManualForm
            players={game.players}
            onCancel={() => setAdding(false)}
            onAdd={(m) => {
              setDraft({ manualAdjustments: [...manual, m] });
              setAdding(false);
            }}
          />
        ) : null}
      </Card>
    </div>
  );
}

function ManualForm({
  players,
  onAdd,
  onCancel,
}: {
  players: Player[];
  onAdd: (m: RoundInput['manualAdjustments'][number]) => void;
  onCancel: () => void;
}) {
  const [payerId, setPayer] = useState('');
  const [receiverId, setReceiver] = useState('');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const valid = payerId && receiverId && payerId !== receiverId && amount > 0;
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div className="text-[13px] font-medium text-ink-2">Who pays?</div>
      <ChipRow label="Payer" players={players} value={payerId} onChange={setPayer} testPrefix="manual-payer" tone="negative" />
      <div className="text-[13px] font-medium text-ink-2">Who receives?</div>
      <ChipRow label="Receiver" players={players.filter((p) => p.id !== payerId)} value={receiverId} onChange={setReceiver} testPrefix="manual-receiver" />
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <MoneyInput label="Adjustment amount" valueCents={amount} onChange={setAmount} />
        <TextInput aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} />
      </div>
      <div className="flex gap-2">
        <Button block size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          block
          size="sm"
          variant="primary"
          disabled={!valid}
          onClick={() => onAdd({ id: newId(), payerId, receiverId, amountCents: amount, note: note.trim() })}
        >
          Add adjustment
        </Button>
      </div>
    </div>
  );
}
