import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import {
  EXAMPLE_TABLE_OPTIONS,
  TAI_LIMITS,
  generatePayoutTable,
  resizePayoutTable,
  stakeLabelFor,
  DEFAULT_ROTATION,
  INSTANT_RULE_PROMPTS,
  applyInstantPayoutTemplates,
  instantTemplateStatus,
  type TableGeneratorOptions,
} from '../config/defaults';
import { INSTANT_BONUS_KINDS, validateConfig } from '../engine/validation';
import { isKongRule } from '../engine/table';
import type { BonusKind, BonusRule, PayoutRow, ScoringConfiguration, ValidationIssue } from '../models/types';
import { formatCents } from '../utils/money';
import { newId } from '../utils/id';
import { ConfirmDialog, Sheet } from './overlay';
import { Badge, Button, Card, Field, IconButton, MoneyInput, SectionTitle, Segmented, Stepper, TextInput, Toggle, cx, inputClass } from './ui';

const BONUS_KIND_LABEL: Record<BonusKind, { label: string; unit: 'tai' | 'cents' | 'percent'; help: string }> = {
  extra_tai: { label: 'Adds tai to the hand', unit: 'tai', help: 'Winning hands only. Capped at the maximum tai.' },
  winner_bonus_per_payer: {
    label: 'Each payer pays the winner extra',
    unit: 'cents',
    help: 'Winning hands only. Added to every paying player’s payment.',
  },
  payout_multiplier: {
    label: 'Multiplies the hand payout',
    unit: 'percent',
    help: 'Winning hands only. 200% = double. Fractions of a cent follow the rounding rule.',
  },
  collect_from_each: {
    label: 'Everyone else pays one player',
    unit: 'cents',
    help: 'Paid during the hand, any round. E.g. a self-drawn kong, or drawing your own animal: the other three each pay this.',
  },
  collect_from_one: {
    label: 'One player pays another',
    unit: 'cents',
    help: 'Paid during the hand, any round. E.g. a kong from a discard (the discarder pays) or a flower bite (the flowers’ owner pays).',
  },
  penalty_pay_each: {
    label: 'One player pays everyone else',
    unit: 'cents',
    help: 'Any round, e.g. a false-win penalty.',
  },
};

const INCREMENTS = [1, 5, 10, 50, 100];

function issuesAt(issues: ValidationIssue[], path: string) {
  return issues.filter((i) => i.path === path || i.path?.startsWith(`${path}.`));
}
function errorAt(issues: ValidationIssue[], path: string): string | undefined {
  return issues.find((i) => i.path === path && i.severity === 'error')?.message;
}

export function RulesEditor({
  value,
  onChange,
}: {
  value: ScoringConfiguration;
  onChange: (next: ScoringConfiguration) => void;
}) {
  const issues = useMemo(() => validateConfig(value), [value]);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const set = <K extends keyof ScoringConfiguration>(key: K, v: ScoringConfiguration[K]) => onChange({ ...value, [key]: v });

  const setTaiRange = (minTai: number, maxTai: number) => {
    onChange({ ...value, minTai, maxTai, payoutTable: resizePayoutTable(value.payoutTable, minTai, maxTai) });
  };
  const setRow = (index: number, patch: Partial<PayoutRow>) => {
    set(
      'payoutTable',
      value.payoutTable.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };
  const setRule = (index: number, patch: Partial<BonusRule>) => {
    set(
      'bonusRules',
      value.bonusRules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const shared = value.discardLiability === 'shared';
  const rotation = value.rotation ?? DEFAULT_ROTATION;
  const templateStatus = instantTemplateStatus(value.bonusRules);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const installTemplates = () => set('bonusRules', applyInstantPayoutTemplates(value.bonusRules, value.baseUnitCents).rules);

  return (
    <div className="space-y-1">
      {errors.length || warnings.length ? (
        <div className="space-y-2" aria-live="polite">
          {errors.length ? (
            <div role="alert" className="rounded-2xl border border-negative/30 bg-negative-soft p-4 text-[14px] text-negative">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} /> {errors.length} problem{errors.length > 1 ? 's' : ''} to fix before saving
              </div>
              <ul className="space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i}>• {e.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {warnings.length ? (
            <div className="rounded-2xl border border-gold/30 bg-gold-soft p-4 text-[14px] text-gold">
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>• {w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <SectionTitle>Game rate</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Rules name" htmlFor="rules-name" error={errorAt(issues, 'name')}>
          <TextInput id="rules-name" value={value.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Friday table rules" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base unit" htmlFor="rules-base" hint="Used to fill the table">
            <MoneyInput
              id="rules-base"
              label="Base unit"
              allowZero={false}
              valueCents={value.baseUnitCents}
              onChange={(c) => onChange({ ...value, baseUnitCents: c, stakeLabel: stakeLabelFor(c) })}
            />
          </Field>
          <Field label="Stake label" htmlFor="rules-stake" hint="Shown on games">
            <TextInput id="rules-stake" value={value.stakeLabel} onChange={(e) => set('stakeLabel', e.target.value)} />
          </Field>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-3">
          The stake label is informational. What each player actually pays is defined by the payout table below.
        </p>
      </Card>

      <SectionTitle>Tai range</SectionTitle>
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">Minimum tai to win</div>
            <div className="text-[13px] text-ink-3">Lowest tai button shown</div>
          </div>
          <Stepper label="minimum tai" value={value.minTai} min={TAI_LIMITS.min} max={value.maxTai} onChange={(v) => setTaiRange(v, value.maxTai)} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium">Maximum tai</div>
            <div className="text-[13px] text-ink-3">Hands above this are paid at the max</div>
          </div>
          <Stepper label="maximum tai" value={value.maxTai} min={value.minTai} max={TAI_LIMITS.max} onChange={(v) => setTaiRange(value.minTai, v)} />
        </div>
      </Card>

      <SectionTitle
        action={
          <Button size="sm" variant="gold" icon={<Wand2 size={14} />} onClick={() => setGeneratorOpen(true)}>
            Fill from rate
          </Button>
        }
      >
        Payout table
      </SectionTitle>
      <Card className="overflow-hidden p-0">
        <table className="w-full table-fixed text-left" aria-label="Payout table">
          <thead className="bg-surface-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            <tr>
              <th scope="col" className="w-14 px-3 py-2.5">
                Tai
              </th>
              <th scope="col" className="px-1.5 py-2.5">
                Discarder
              </th>
              {shared ? (
                <th scope="col" className="px-1.5 py-2.5">
                  Others each
                </th>
              ) : null}
              <th scope="col" className="px-1.5 py-2.5 pr-3">
                Self-draw each
              </th>
            </tr>
          </thead>
          <tbody>
            {value.payoutTable.map((row, i) => (
              <tr key={row.tai} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-[15px] font-semibold">
                  <span className="num">{row.tai}</span>
                </th>
                <td className="px-1.5 py-2">
                  <MoneyInput compact label={`${row.tai} tai discarder pays`} valueCents={row.discarderPays} onChange={(c) => setRow(i, { discarderPays: c })} />
                </td>
                {shared ? (
                  <td className="px-1.5 py-2">
                    <MoneyInput compact label={`${row.tai} tai others each pay`} valueCents={row.othersPay} onChange={(c) => setRow(i, { othersPay: c })} />
                  </td>
                ) : null}
                <td className="px-1.5 py-2 pr-3">
                  <MoneyInput
                    compact
                    label={`${row.tai} tai self-draw each pays`}
                    valueCents={row.selfDrawEachPays}
                    onChange={(c) => setRow(i, { selfDrawEachPays: c })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {issuesAt(issues, 'payoutTable').filter((i) => i.severity === 'error').length ? (
          <div className="border-t border-line px-4 py-3 text-[13px] text-negative">
            {issuesAt(issues, 'payoutTable')
              .filter((i) => i.severity === 'error')
              .map((i, idx) => (
                <div key={idx}>{i.message}</div>
              ))}
          </div>
        ) : null}
      </Card>

      <SectionTitle>Discard win (放炮)</SectionTitle>
      <Card className="space-y-3 p-4">
        <Segmented
          label="Who pays on a discard win"
          value={value.discardLiability}
          onChange={(v) => set('discardLiability', v)}
          options={[
            { value: 'discarder_only', label: 'Discarder only' },
            { value: 'shared', label: 'Shared' },
          ]}
        />
        <p className="text-[13px] leading-relaxed text-ink-3">
          {shared
            ? 'The discarder pays the “Discarder” amount and the other two players each pay the “Others each” amount.'
            : 'Only the discarder pays, using the “Discarder” amount. If your group has the shooter cover everyone, enter that full amount in the Discarder column.'}
        </p>
      </Card>

      <SectionTitle>Self-draw (自摸)</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-[14px] leading-relaxed text-ink-2">All three opponents pay the “Self-draw each” amount.</p>
        <Toggle
          label="Allow a liable player (包)"
          description="When chosen for a self-draw, that player pays every opponent’s share alone."
          checked={value.selfDrawPayers === 'all_opponents_or_liable'}
          onChange={(v) => set('selfDrawPayers', v ? 'all_opponents_or_liable' : 'all_opponents')}
        />
      </Card>

      <SectionTitle>Payout cap</SectionTitle>
      <Card className="space-y-3 p-4">
        <Segmented
          label="Payout cap"
          value={value.payoutCap.mode}
          onChange={(mode) => set('payoutCap', { ...value.payoutCap, mode })}
          options={[
            { value: 'none', label: 'No cap' },
            { value: 'per_payment', label: 'Per payer' },
            { value: 'per_round', label: 'Per hand' },
          ]}
        />
        {value.payoutCap.mode !== 'none' ? (
          <Field label={value.payoutCap.mode === 'per_payment' ? 'Most any one player pays for a hand' : 'Most a winner collects for a hand'} htmlFor="cap" error={errorAt(issues, 'payoutCap.amountCents')}>
            <MoneyInput id="cap" label="Cap amount" allowZero={false} valueCents={value.payoutCap.amountCents} onChange={(c) => set('payoutCap', { ...value.payoutCap, amountCents: c })} />
          </Field>
        ) : null}
        <p className="text-[13px] leading-relaxed text-ink-3">
          Caps apply to hand payments only, not to instant bonuses or penalties. A per-hand cap is shared between payers in proportion, to the exact cent.
        </p>
      </Card>

      <SectionTitle>Rounding</SectionTitle>
      <Card className="space-y-3 p-4">
        <Segmented
          label="Rounding rule"
          size="sm"
          value={value.rounding.mode}
          onChange={(mode) => set('rounding', { ...value.rounding, mode })}
          options={[
            { value: 'exact', label: 'Exact' },
            { value: 'nearest', label: 'Nearest' },
            { value: 'up', label: 'Up' },
            { value: 'down', label: 'Down' },
          ]}
        />
        {value.rounding.mode !== 'exact' ? (
          <div role="radiogroup" aria-label="Rounding increment" className="flex flex-wrap gap-2">
            {INCREMENTS.map((inc) => (
              <button
                key={inc}
                type="button"
                role="radio"
                aria-checked={value.rounding.incrementCents === inc}
                onClick={() => set('rounding', { ...value.rounding, incrementCents: inc })}
                className={cx(
                  'pressable min-h-10 rounded-xl border px-3.5 text-[14px] font-semibold',
                  value.rounding.incrementCents === inc ? 'border-emerald bg-emerald-soft text-positive' : 'border-line bg-surface-2 text-ink-2 hover:border-line-strong',
                )}
              >
                {formatCents(inc)}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-[13px] leading-relaxed text-ink-3">
          {value.rounding.mode === 'exact'
            ? 'No rounding. If a multiplier ever produces a fraction of a cent, the round is rejected with an explanation instead of being rounded silently.'
            : `Each hand payment is rounded ${value.rounding.mode === 'nearest' ? 'to the nearest' : value.rounding.mode} ${formatCents(value.rounding.incrementCents)}. The payer and receiver always see the same rounded amount, so totals still balance.`}
        </p>
      </Card>

      <SectionTitle>Dealer (莊家)</SectionTitle>
      <Card className="space-y-4 p-4">
        <div className="space-y-3 border-b border-line pb-4">
          <Toggle
            label="Dealer keeps the deal after winning"
            checked={rotation.dealerKeepsOnWin}
            onChange={(dealerKeepsOnWin) => set('rotation', { ...rotation, dealerKeepsOnWin })}
          />
          <div>
            <div className="mb-2 text-[15px] font-medium text-ink">After a drawn hand</div>
            <Segmented
              label="After a drawn hand"
              size="sm"
              value={rotation.onDraw}
              onChange={(onDraw) => set('rotation', { ...rotation, onDraw })}
              options={[
                { value: 'keeps', label: 'Dealer keeps' },
                { value: 'keeps_unless_kong', label: 'Keeps unless kong' },
                { value: 'passes', label: 'Deal passes' },
              ]}
            />
          </div>
          <p className="text-[13px] leading-relaxed text-ink-3">
            Used by the table tracker to move the deal and round wind on. It doesn’t change any payment.
          </p>
        </div>
        <Toggle
          label="Dealer bonuses apply"
          description="Off by default. When on, the values below are applied when the round’s dealer wins or pays."
          checked={value.dealer.enabled}
          onChange={(enabled) => set('dealer', { ...value.dealer, enabled })}
        />
        {value.dealer.enabled ? (
          <div className="space-y-4 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[15px] font-medium">Extra tai when dealer wins</div>
              <Stepper label="dealer extra tai" value={value.dealer.extraTaiWhenDealerWins} min={0} max={TAI_LIMITS.max} onChange={(v) => set('dealer', { ...value.dealer, extraTaiWhenDealerWins: v })} />
            </div>
            <Field label="Extra from each payer when dealer wins" htmlFor="dealer-win" error={errorAt(issues, 'dealer.extraCentsPerPayerWhenDealerWins')}>
              <MoneyInput id="dealer-win" label="Dealer win extra per payer" valueCents={value.dealer.extraCentsPerPayerWhenDealerWins} onChange={(c) => set('dealer', { ...value.dealer, extraCentsPerPayerWhenDealerWins: c })} />
            </Field>
            <Field label="Extra the dealer pays when paying" htmlFor="dealer-pay" error={errorAt(issues, 'dealer.extraCentsWhenDealerPays')}>
              <MoneyInput id="dealer-pay" label="Dealer surcharge" valueCents={value.dealer.extraCentsWhenDealerPays} onChange={(c) => set('dealer', { ...value.dealer, extraCentsWhenDealerPays: c })} />
            </Field>
          </div>
        ) : null}
      </Card>

      <SectionTitle
        action={
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus size={14} />}
            onClick={() =>
              set('bonusRules', [
                ...value.bonusRules,
                { id: newId(), name: 'New adjustment', kind: 'collect_from_each', value: 0, enabled: false },
              ])
            }
          >
            Add
          </Button>
        }
      >
        Kongs, flowers, animals & extras
      </SectionTitle>
      <p className="mb-2 px-1 text-[13px] leading-relaxed text-ink-3">
        Money only moves when a rule is switched on here <em>and</em> recorded in a round. Amounts marked “Example” are suggestions: change them to match your table.
      </p>
      {templateStatus !== 'current' ? (
        <Button
          className="mb-3"
          block
          variant="gold"
          icon={<Sparkles size={16} />}
          data-testid="add-instant-templates"
          onClick={() => (templateStatus === 'missing' ? installTemplates() : setReplaceOpen(true))}
        >
          {templateStatus === 'missing' ? 'Add kong, flower & animal payouts' : 'Update kong, flower & animal payouts'}
        </Button>
      ) : null}
      <ConfirmDialog
        open={replaceOpen}
        title="Update kong, flower & animal payouts?"
        tone="primary"
        confirmLabel="Update payouts"
        body={
          <div className="space-y-2">
            <p>These older rules will be replaced:</p>
            <ul className="text-[14px] text-ink-3">
              {applyInstantPayoutTemplates(value.bonusRules, value.baseUnitCents).removed.map((r) => (
                <li key={r.id}>• {r.name}</li>
              ))}
            </ul>
            <p>With:</p>
            <ul className="num text-[14px] text-ink-3">
              {applyInstantPayoutTemplates(value.bonusRules, value.baseUnitCents).added.map((r) => (
                <li key={r.id}>
                  • {r.name}: {formatCents(r.value)} {r.kind === 'collect_from_one' ? (INSTANT_RULE_PROMPTS[r.id]?.payerShort ?? 'from one player') : 'from each player'}
                </li>
              ))}
            </ul>
            <p className="text-[13px]">Rounds already recorded keep the rules they were scored with. Your other rules stay as they are.</p>
          </div>
        }
        onCancel={() => setReplaceOpen(false)}
        onConfirm={() => {
          installTemplates();
          setReplaceOpen(false);
        }}
      />
      <div className="space-y-3">
        {value.bonusRules.length === 0 ? (
          <Card className="p-4 text-[14px] text-ink-3">No adjustments configured.</Card>
        ) : null}
        {value.bonusRules.map((rule, i) => {
          const meta = BONUS_KIND_LABEL[rule.kind];
          return (
            <Card key={rule.id} className={cx('space-y-3 p-4', !rule.enabled && 'opacity-80')}>
              <div className="flex items-center gap-2">
                <TextInput aria-label="Adjustment name" value={rule.name} onChange={(e) => setRule(i, { name: e.target.value })} className="min-h-11 flex-1" />
                <IconButton label={`Remove ${rule.name}`} onClick={() => set('bonusRules', value.bonusRules.filter((_, j) => j !== i))}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
              {rule.isExample ? (
                <Badge tone="gold">
                  <Sparkles size={11} /> Suggested amount — edit to match your table
                </Badge>
              ) : null}
              <label className="block">
                <span className="sr-only">Adjustment type</span>
                <select className={cx(inputClass, 'min-h-11 appearance-none')} value={rule.kind} onChange={(e) => setRule(i, { kind: e.target.value as BonusKind, value: 0 })}>
                  {(Object.keys(BONUS_KIND_LABEL) as BonusKind[]).map((k) => (
                    <option key={k} value={k}>
                      {BONUS_KIND_LABEL[k].label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] leading-snug text-ink-3">{meta.help}</div>
                {meta.unit === 'cents' ? (
                  <MoneyInput compact className="w-28 shrink-0" label={`${rule.name} amount`} valueCents={rule.value} onChange={(c) => setRule(i, { value: c })} />
                ) : meta.unit === 'tai' ? (
                  <Stepper label={`${rule.name} tai`} value={rule.value} min={0} max={TAI_LIMITS.max} suffix="tai" onChange={(v) => setRule(i, { value: v })} />
                ) : (
                  <label className="flex shrink-0 items-center gap-1">
                    <span className="sr-only">{rule.name} percent</span>
                    <input
                      inputMode="numeric"
                      className={cx(inputClass, 'num min-h-10 w-24 text-right')}
                      value={rule.value}
                      onChange={(e) => {
                        const n = Number.parseInt(e.target.value.replace(/\D/g, '') || '0', 10);
                        setRule(i, { value: n });
                      }}
                    />
                    <span className="text-ink-3">%</span>
                  </label>
                )}
              </div>
              {INSTANT_BONUS_KINDS.includes(rule.kind) ? (
                <Toggle
                  label="Counts as a kong"
                  description="A drawn hand with this payout passes the deal on."
                  checked={isKongRule(rule)}
                  onChange={(countsAsKong) => setRule(i, { countsAsKong })}
                />
              ) : null}
              <Toggle label="Enabled" checked={rule.enabled} onChange={(enabled) => setRule(i, { enabled })} />
              {issuesAt(issues, `bonusRules.${i}`).map((iss, k) => (
                <p key={k} className={cx('text-[13px]', iss.severity === 'error' ? 'text-negative' : 'text-gold')}>
                  {iss.message}
                </p>
              ))}
            </Card>
          );
        })}
      </div>

      <TableGenerator
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        config={value}
        onApply={(opts) => {
          onChange({
            ...value,
            baseUnitCents: opts.baseUnitCents,
            stakeLabel: stakeLabelFor(opts.baseUnitCents),
            payoutTable: generatePayoutTable(opts),
          });
          setGeneratorOpen(false);
        }}
      />
    </div>
  );
}

function TableGenerator({
  open,
  onClose,
  config,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  config: ScoringConfiguration;
  onApply: (opts: TableGeneratorOptions) => void;
}) {
  const [opts, setOpts] = useState<TableGeneratorOptions>({
    ...EXAMPLE_TABLE_OPTIONS,
    baseUnitCents: config.baseUnitCents,
    minTai: config.minTai,
    maxTai: config.maxTai,
  });
  const [confirm, setConfirm] = useState(false);
  const preview = generatePayoutTable({ ...opts, minTai: config.minTai, maxTai: config.maxTai });
  const unitRow = (label: string, key: 'discarderUnits' | 'othersUnits' | 'selfDrawUnits') => (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[14px] font-medium">{label}</div>
      <Stepper label={label} value={opts[key]} min={0} max={8} suffix="×" onChange={(v) => setOpts({ ...opts, [key]: v })} />
    </div>
  );
  return (
    <>
      <Sheet
        open={open && !confirm}
        onClose={onClose}
        title="Fill table from rate"
        labelledBy="generator-title"
        footer={
          <Button variant="primary" block onClick={() => setConfirm(true)}>
            Use these values
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-[14px] leading-relaxed text-ink-3">
            A helper to pre-fill the table. Every value can still be edited afterwards. Check the result against your group’s actual rules.
          </p>
          <Field label="Base unit (lowest tai)" htmlFor="gen-base">
            <MoneyInput id="gen-base" label="Base unit" allowZero={false} valueCents={opts.baseUnitCents} onChange={(c) => setOpts({ ...opts, baseUnitCents: c })} />
          </Field>
          <Segmented
            label="Progression"
            value={opts.progression}
            onChange={(progression) => setOpts({ ...opts, progression })}
            options={[
              { value: 'doubling', label: 'Doubles each tai' },
              { value: 'linear', label: 'Adds one unit' },
            ]}
          />
          {unitRow('Discarder pays (units)', 'discarderUnits')}
          {config.discardLiability === 'shared' ? unitRow('Others each pay (units)', 'othersUnits') : null}
          {unitRow('Self-draw each pays (units)', 'selfDrawUnits')}
          <div className="rounded-2xl border border-line bg-surface-2 p-3 text-[13px]">
            <div className="mb-1 font-semibold text-ink-2">Preview</div>
            {preview.map((r) => (
              <div key={r.tai} className="num flex justify-between gap-2 text-ink-2">
                <span>{r.tai} tai</span>
                <span>
                  {formatCents(r.discarderPays)}
                  {config.discardLiability === 'shared' ? ` · ${formatCents(r.othersPay)}` : ''} · {formatCents(r.selfDrawEachPays)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Replace payout table?"
        body="This overwrites every amount in the payout table with the generated values."
        confirmLabel="Replace table"
        tone="primary"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onApply({ ...opts, minTai: config.minTai, maxTai: config.maxTai });
        }}
      />
    </>
  );
}
