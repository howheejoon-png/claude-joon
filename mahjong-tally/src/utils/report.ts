import { activeRounds, gameBalances, roundNet, roundNumbers } from '../engine/game';
import { computeSettlement } from '../engine/settlement';
import type { GameSession } from '../models/types';
import { formatCents } from './money';
import { formatDate, formatDateTime } from './time';
import { describeRound } from '../pages/describe';

/** Plain-text summary for copying or sharing (WhatsApp etc.). */
export function settlementText(game: GameSession): string {
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const balances = [...gameBalances(game)].sort((a, b) => b.netCents - a.netCents);
  const settlement = computeSettlement(balances);
  const rounds = activeRounds(game).length;
  const lines: string[] = [];
  lines.push(`🀄 Mahjong Tally — ${game.name}`);
  lines.push(`${formatDate(game.createdAt)} · ${game.config.stakeLabel} · ${rounds} round${rounds === 1 ? '' : 's'}`);
  lines.push('');
  lines.push('Results');
  for (const b of balances) {
    lines.push(`• ${byId.get(b.playerId)?.name ?? '?'}: ${formatCents(b.netCents, { signed: true })}`);
  }
  const total = balances.reduce((a, b) => a + b.netCents, 0);
  lines.push(`Total: ${formatCents(total)} ${total === 0 ? '✅ balanced' : '⚠️ NOT balanced'}`);
  lines.push('');
  if (settlement.ok) {
    if (settlement.plan.transfers.length === 0) {
      lines.push('Settlement: nobody owes anything.');
    } else {
      lines.push('Settlement');
      for (const t of settlement.plan.transfers) {
        lines.push(`• ${byId.get(t.fromPlayerId)?.name ?? '?'} pays ${byId.get(t.toPlayerId)?.name ?? '?'} ${formatCents(t.amountCents)}`);
      }
      lines.push('After these payments everyone is square.');
    }
  } else {
    lines.push(`Settlement unavailable: ${settlement.error}`);
  }
  return lines.join('\n');
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Round-by-round CSV: one row per round with each player's net in dollars. */
export function roundsCsv(game: GameSession): string {
  const byId = new Map(game.players.map((p) => [p.id, p]));
  const numbers = roundNumbers(game);
  const header = ['Round', 'Recorded', 'Result', 'Details', ...game.players.map((p) => p.name), 'Round net'];
  const rows: (string | number)[][] = [header];
  for (const r of activeRounds(game)) {
    const net = roundNet(game, r);
    const d = describeRound(r, byId);
    const values = game.players.map((p) => net[p.id] ?? 0);
    rows.push([
      numbers.get(r.id) ?? '',
      formatDateTime(r.createdAt),
      d.title,
      d.subtitle,
      ...values.map((v) => formatCents(v, { symbol: '' })),
      formatCents(
        values.reduce((a, b) => a + b, 0),
        { symbol: '' },
      ),
    ]);
  }
  const totals = gameBalances(game);
  rows.push([
    'Total',
    '',
    '',
    '',
    ...game.players.map((p) => formatCents(totals.find((b) => b.playerId === p.id)?.netCents ?? 0, { symbol: '' })),
    formatCents(
      totals.reduce((a, b) => a + b.netCents, 0),
      { symbol: '' },
    ),
  ]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileSafe(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'mahjong-tally';
}
