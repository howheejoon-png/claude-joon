import { describe, expect, it } from 'vitest';
import {
  applyInstantPayoutTemplates,
  exampleConfiguration,
  instantPayoutTemplates,
  instantTemplateStatus,
} from '../config/defaults';
import { INSTANT_BONUS_KINDS, hasErrors, validateConfig } from '../engine/validation';
import type { BonusRule } from '../models/types';

const byId = (rules: BonusRule[]) => Object.fromEntries(rules.map((r) => [r.id, { kind: r.kind, value: r.value }]));

describe('kong, flower and animal payouts', () => {
  it('match the table rules at a $3 / $6 game', () => {
    expect(byId(instantPayoutTemplates(300))).toEqual({
      'sg-kong-discard': { kind: 'collect_from_one', value: 600 }, // discarder pays $6
      'sg-kong-self': { kind: 'collect_from_each', value: 200 }, // everyone pays $2
      'sg-flower-own': { kind: 'collect_from_each', value: 200 },
      'sg-flower-other': { kind: 'collect_from_one', value: 200 }, // flower's owner pays $2
      'sg-animal-own': { kind: 'collect_from_each', value: 200 },
      'sg-animal-cat-mouse': { kind: 'collect_from_each', value: 200 },
      'sg-animal-chicken-centipede': { kind: 'collect_from_each', value: 200 },
    });
  });

  it('scale with the stake in whole cents', () => {
    const at30 = byId(instantPayoutTemplates(30));
    expect(at30['sg-kong-discard']?.value).toBe(60);
    expect(at30['sg-kong-self']?.value).toBe(20);
    // 2/3 of 50c = 33.33c rounds to the nearest whole cent.
    expect(byId(instantPayoutTemplates(50))['sg-flower-own']?.value).toBe(33);
    const all = instantPayoutTemplates(300);
    expect(all.every((r) => r.enabled && r.isExample && INSTANT_BONUS_KINDS.includes(r.kind))).toBe(true);
    expect(all.every((r) => Number.isSafeInteger(r.value) && r.value > 0)).toBe(true);
  });

  it('are part of the example rules for new groups', () => {
    expect(instantTemplateStatus(exampleConfiguration().bonusRules)).toBe('current');
  });

  it('replace older versions while keeping the group’s other rules', () => {
    const mine: BonusRule = { id: 'mine', name: 'Our special', kind: 'extra_tai', value: 1, enabled: true };
    const legacy: BonusRule[] = [
      { id: 'example-kong', name: 'Kong payment', kind: 'collect_from_each', value: 30, enabled: false },
      { id: 'sg-flower-bite', name: 'Flower bite', kind: 'collect_from_one', value: 300, enabled: true },
      mine,
    ];
    expect(instantTemplateStatus(legacy)).toBe('outdated');
    expect(instantTemplateStatus([mine])).toBe('missing');

    const { rules, removed, added } = applyInstantPayoutTemplates(legacy, 300);
    expect(removed.map((r) => r.id)).toEqual(['example-kong', 'sg-flower-bite']);
    expect(added).toHaveLength(7);
    expect(rules[0]).toEqual(mine);
    expect(instantTemplateStatus(rules)).toBe('current');
    // Applying again changes nothing.
    expect(applyInstantPayoutTemplates(rules, 300).rules).toEqual(rules);
    expect(hasErrors(validateConfig({ ...exampleConfiguration(), bonusRules: rules }))).toBe(false);
  });
});
