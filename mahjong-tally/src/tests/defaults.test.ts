import { describe, expect, it } from 'vitest';
import { exampleConfiguration, instantPayoutTemplates, withInstantPayoutTemplates } from '../config/defaults';
import { INSTANT_BONUS_KINDS, hasErrors, validateConfig } from '../engine/validation';

describe('kong, flower and animal templates', () => {
  it('are instant payouts, labelled as examples, priced from the base unit', () => {
    const t = instantPayoutTemplates(50);
    expect(t.map((r) => r.id)).toEqual([
      'sg-kong-discard',
      'sg-kong-pong',
      'sg-kong-concealed',
      'sg-flower-bite',
      'sg-flower-set',
      'sg-animal',
      'sg-animal-pair',
    ]);
    expect(t.every((r) => r.isExample && r.enabled && INSTANT_BONUS_KINDS.includes(r.kind))).toBe(true);
    expect(t.find((r) => r.id === 'sg-kong-discard')).toMatchObject({ kind: 'collect_from_one', value: 50 });
    expect(t.find((r) => r.id === 'sg-flower-bite')).toMatchObject({ kind: 'collect_from_one', value: 50 });
    expect(t.find((r) => r.id === 'sg-kong-concealed')).toMatchObject({ kind: 'collect_from_each', value: 100 });
    expect(t.find((r) => r.id === 'sg-animal')).toMatchObject({ kind: 'collect_from_each', value: 50 });
  });

  it('adds only missing templates to existing rules, keeping the group’s own edits', () => {
    const old = [
      { id: 'example-kong', name: 'Kong payment', kind: 'collect_from_each' as const, value: 30, enabled: false },
      { id: 'sg-animal', name: 'My animal rule', kind: 'collect_from_each' as const, value: 20, enabled: true },
    ];
    const { rules, added } = withInstantPayoutTemplates(old, 30);
    expect(added).toBe(6);
    expect(rules.slice(0, 2)).toEqual(old);
    expect(rules.find((r) => r.id === 'sg-animal')?.value).toBe(20);
    // Idempotent.
    expect(withInstantPayoutTemplates(rules, 30).added).toBe(0);
    const cfg = { ...exampleConfiguration(), bonusRules: rules };
    expect(hasErrors(validateConfig(cfg))).toBe(false);
  });
});
