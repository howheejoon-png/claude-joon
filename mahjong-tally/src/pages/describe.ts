import type { Player, PlayerId, Round, RoundInput } from '../models/types';

export interface RoundDescription {
  title: string;
  subtitle: string;
  method: string;
  winnerId?: PlayerId;
}

export function methodLabel(method: 'self_draw' | 'discard'): string {
  return method === 'self_draw' ? 'Self Draw 自摸' : 'Discard Win 放炮';
}

export function describeInput(input: RoundInput, byId: Map<PlayerId, Player>, effectiveTai?: number): RoundDescription {
  const o = input.outcome;
  if (o.type === 'draw') {
    const extras = input.bonuses.length + input.manualAdjustments.length;
    return { title: 'Drawn round', subtitle: extras ? `${extras} adjustment${extras > 1 ? 's' : ''}` : 'No winner', method: 'Draw 流局' };
  }
  const winner = byId.get(o.winnerId)?.name ?? 'Unknown';
  const taiText = effectiveTai !== undefined && effectiveTai !== o.tai ? `${o.tai}→${effectiveTai} tai` : `${o.tai} tai`;
  const via =
    o.method === 'discard'
      ? `${byId.get(o.discarderId ?? '')?.name ?? '?'} discarded`
      : o.liablePlayerId
        ? `${byId.get(o.liablePlayerId)?.name ?? '?'} liable (包)`
        : 'Self draw';
  return {
    title: `${winner} — ${o.method === 'self_draw' ? 'Self Draw' : 'Discard Win'}`,
    subtitle: `${taiText} · ${via}`,
    method: methodLabel(o.method),
    winnerId: o.winnerId,
  };
}

export function describeRound(round: Round, byId: Map<PlayerId, Player>): RoundDescription {
  return describeInput(round.input, byId, round.effectiveTai);
}
