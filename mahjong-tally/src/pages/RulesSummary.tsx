import { Card } from '../components/ui';
import type { ScoringConfiguration } from '../models/types';
import { formatCents } from '../utils/money';

/** Compact read-only description of a rules configuration. */
export function RulesSummary({ config, compact }: { config: ScoringConfiguration; compact?: boolean }) {
  const lo = config.payoutTable.find((r) => r.tai === config.minTai);
  const hi = config.payoutTable.find((r) => r.tai === config.maxTai);
  const enabledRules = config.bonusRules.filter((r) => r.enabled);
  const rows: [string, string][] = [
    ['Stake', config.stakeLabel],
    ['Tai', `${config.minTai} – ${config.maxTai} tai`],
    ['Discard win', config.discardLiability === 'shared' ? 'Discarder + others share' : 'Discarder only pays'],
    ['Self-draw', config.selfDrawPayers === 'all_opponents_or_liable' ? 'All three pay · 包 allowed' : 'All three pay'],
  ];
  if (lo && hi) {
    rows.push([
      `${config.minTai} tai`,
      `${formatCents(lo.discarderPays)}${config.discardLiability === 'shared' ? ` / ${formatCents(lo.othersPay)}` : ''} · self-draw ${formatCents(lo.selfDrawEachPays)} each`,
    ]);
    rows.push([
      `${config.maxTai} tai`,
      `${formatCents(hi.discarderPays)}${config.discardLiability === 'shared' ? ` / ${formatCents(hi.othersPay)}` : ''} · self-draw ${formatCents(hi.selfDrawEachPays)} each`,
    ]);
  }
  if (!compact) {
    rows.push(['Cap', config.payoutCap.mode === 'none' ? 'None' : `${formatCents(config.payoutCap.amountCents)} ${config.payoutCap.mode === 'per_payment' ? 'per payer' : 'per hand'}`]);
    rows.push(['Rounding', config.rounding.mode === 'exact' ? 'Exact' : `${config.rounding.mode} to ${formatCents(config.rounding.incrementCents)}`]);
    rows.push(['Dealer', config.dealer.enabled ? 'Bonuses on' : 'No dealer bonus']);
    rows.push(['Adjustments', enabledRules.length ? enabledRules.map((r) => r.name).join(', ') : 'None enabled']);
  }
  return (
    <Card className="p-4">
      <div className="mb-2 text-[15px] font-semibold text-ink">{config.name || 'Untitled rules'}</div>
      <dl className="space-y-1.5 text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="shrink-0 text-ink-3">{k}</dt>
            <dd className="num text-right text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
