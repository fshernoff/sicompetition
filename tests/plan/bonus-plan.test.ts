// BRIEF section 7: the plan in plain words and the editor's catalogue of measures. A pure function over a RewardSpec.
import { describe, expect, it } from 'vitest';
import { describeBonusPlan, kpiInfo, signedNote } from '../../src/world/bonusPlan.ts';
import { loadPreset } from '../../src/world/config.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import { config, spec, withConfig } from '../helpers.ts';

describe('kpiInfo', () => {
  it('lists the six measures in section 7 order with their names on the page', () => {
    const info = kpiInfo(config);
    expect(info.map((k) => k.key)).toEqual([...KPI_KEYS]);
    expect(info.map((k) => k.name)).toEqual([
      'Profit today ($)',
      'Dogs served',
      'Incidents',
      'Reputation change',
      'Staff fatigue above 70%',
      'Blocks over the legal ratio',
    ]);
    expect(info.map((k) => k.per)).toEqual(['per $100', 'per dog', 'per incident', 'per point', 'per block', 'per block']);
  });

  it('takes the fatigue threshold from the config', () => {
    const c = withConfig((w) => {
      w.fatigue.kpiThreshold = 60;
    });
    expect(kpiInfo(c)[4]?.name).toBe('Staff fatigue above 60%');
  });
});

describe('describeBonusPlan', () => {
  it('renders the Round 1 preset', () => {
    expect(describeBonusPlan(loadPreset('round1').spec, config)).toBe('Each day, the GM earns 10 points per $100 of profit.');
  });

  it('renders the template sentence of section 7 character for character', () => {
    expect(describeBonusPlan(spec({ profit: 10, incidents: -5, overRatio: -5 }), config)).toBe(
      'Each day, the GM earns 10 points per $100 of profit, loses 5 points per incident, and loses 5 points for every block the floor runs over 15 dogs per staffer.',
    );
  });

  it('joins two clauses with "and"', () => {
    expect(describeBonusPlan(spec({ profit: 10, incidents: -7 }), config)).toBe(
      'Each day, the GM earns 10 points per $100 of profit and loses 7 points per incident.',
    );
  });

  it('reads "loses" for a negative weight and "earns" for a positive one, in every measure', () => {
    expect(describeBonusPlan(spec({ profit: -10 }), config)).toBe('Each day, the GM loses 10 points per $100 of profit.');
    expect(describeBonusPlan(spec({ dogsServed: -5 }), config)).toBe('Each day, the GM loses 5 points per dog served.');
    expect(describeBonusPlan(spec({ incidents: 5 }), config)).toBe('Each day, the GM earns 5 points per incident.');
    expect(describeBonusPlan(spec({ reputation: 5 }), config)).toBe('Each day, the GM earns 5 points per point of reputation gained.');
    expect(describeBonusPlan(spec({ fatigue: -5 }), config)).toBe("Each day, the GM loses 5 points for every block the crew's fatigue is above 70%.");
    expect(describeBonusPlan(spec({ overRatio: 2 }), config)).toBe('Each day, the GM earns 2 points for every block the floor runs over 15 dogs per staffer.');
  });

  it('uses the singular for one point', () => {
    expect(describeBonusPlan(spec({ profit: 1, incidents: -1 }), config)).toBe(
      'Each day, the GM earns 1 point per $100 of profit and loses 1 point per incident.',
    );
  });

  it('says so when a measure that is on counts for nothing', () => {
    expect(describeBonusPlan(spec({ profit: 10, incidents: 0 }), config)).toBe(
      'Each day, the GM earns 10 points per $100 of profit and earns 0 points per incident.',
    );
  });

  it('renders every measure at +10 honestly, in section 7 order', () => {
    const all = spec({ profit: 10, dogsServed: 10, incidents: 10, reputation: 10, fatigue: 10, overRatio: 10 });
    expect(describeBonusPlan(all, config)).toBe(
      "Each day, the GM earns 10 points per $100 of profit, earns 10 points per dog served, earns 10 points per incident, earns 10 points per point of reputation gained, earns 10 points for every block the crew's fatigue is above 70%, and earns 10 points for every block the floor runs over 15 dogs per staffer.",
    );
  });

  it('mentions nothing that is off, whatever its weight', () => {
    // The Round 1 preset carries the suggested weights on its five off measures (D26).
    expect(describeBonusPlan(loadPreset('round1').spec, config)).not.toMatch(/incident|dog served|reputation|fatigue|staffer/);
    const weighted = spec({ profit: 10 });
    weighted.kpis.incidents = { on: false, weight: -10 };
    expect(describeBonusPlan(weighted, config)).toBe('Each day, the GM earns 10 points per $100 of profit.');
  });

  it('says the GM is paid nothing when no measure is on', () => {
    expect(describeBonusPlan(spec({}), config)).toBe('The GM is paid nothing: no measure is on.');
  });

  it('takes the legal ratio and the fatigue threshold from the config', () => {
    const c = withConfig((w) => {
      w.bookings.legalRatio = 12;
      w.fatigue.kpiThreshold = 60;
    });
    expect(describeBonusPlan(spec({ overRatio: -4, fatigue: -3 }), c)).toBe(
      "Each day, the GM loses 3 points for every block the crew's fatigue is above 60% and loses 4 points for every block the floor runs over 12 dogs per staffer.",
    );
  });

  it('does not change its input', () => {
    const s = spec({ profit: 10, incidents: -5 });
    const before = structuredClone(s);
    describeBonusPlan(s, config);
    expect(s).toEqual(before);
  });
});

describe('signedNote', () => {
  it('says profit and reputation count both ways when either is on with a weight', () => {
    expect(signedNote(spec({ profit: 10, reputation: 5 }))).toBe(
      'Profit and reputation count both ways: a $100 loss or a one-point drop counts the opposite of a $100 gain or a one-point rise.',
    );
    expect(signedNote(spec({ profit: -10, incidents: -5 }))).toBe('Profit counts both ways: a $100 loss counts the opposite of a $100 gain.');
    expect(signedNote(spec({ reputation: 1 }))).toBe('Reputation counts both ways: a one-point drop counts the opposite of a one-point rise.');
    expect(signedNote(loadPreset('round1').spec)).toBe('Profit counts both ways: a $100 loss counts the opposite of a $100 gain.');
  });

  it('is null when neither is on, or both weigh nothing', () => {
    expect(signedNote(spec({ incidents: -5, overRatio: -5 }))).toBeNull();
    expect(signedNote(spec({ profit: 0, reputation: 0 }))).toBeNull();
    expect(signedNote(spec({}))).toBeNull();
    const weighted = spec({ incidents: -5 });
    weighted.kpis.profit = { on: false, weight: 10 };
    expect(signedNote(weighted)).toBeNull();
  });
});
