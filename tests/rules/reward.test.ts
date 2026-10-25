// BRIEF section 7: the bonus plan applied to KPI deltas.
import { describe, expect, it } from 'vitest';
import { addDeltas, emptyDeltas, rewardFor } from '../../src/world/reward.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import { round1, spec } from '../helpers.ts';

describe('reward', () => {
  it('starts every KPI at 0 and adds deltas key by key', () => {
    const z = emptyDeltas();
    for (const k of KPI_KEYS) expect(z[k]).toBe(0);
    const sum = addDeltas({ ...z, profit: 100, incidents: 1 }, { ...z, profit: -40, overRatio: 2 });
    expect(sum).toEqual({ ...z, profit: 60, incidents: 1, overRatio: 2 });
  });

  it('pays 10 points per $100 of profit under Round 1', () => {
    expect(rewardFor({ ...emptyDeltas(), profit: 500 }, round1)).toBe(50);
    expect(rewardFor({ ...emptyDeltas(), profit: -65 }, round1)).toBeCloseTo(-6.5, 10);
  });

  it('ignores KPIs that are off, even with a weight', () => {
    const s = round1;
    s.kpis.incidents = { on: false, weight: -10 };
    expect(rewardFor({ ...emptyDeltas(), profit: 500, incidents: 3 }, s)).toBe(50);
  });

  it('sums the KPIs that are on, each in its unit', () => {
    const s = spec({ profit: 10, incidents: -5, dogsServed: 2, reputation: 1, fatigue: -3, overRatio: -4 });
    const d = { profit: 500, dogsServed: 20, incidents: 2, reputation: -4, fatigue: 1, overRatio: 1 };
    expect(rewardFor(d, s)).toBe(50 - 10 + 40 - 4 - 3 - 4);
  });

  it('clamps weights to −10..+10 and rounds them to integers', () => {
    expect(rewardFor({ ...emptyDeltas(), profit: 100 }, spec({ profit: 12 }))).toBe(10);
    expect(rewardFor({ ...emptyDeltas(), incidents: 1 }, spec({ incidents: -15 }))).toBe(-10);
    expect(rewardFor({ ...emptyDeltas(), dogsServed: 1 }, spec({ dogsServed: 2.6 }))).toBe(3);
  });
});
