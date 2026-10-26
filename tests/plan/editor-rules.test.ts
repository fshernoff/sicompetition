// The editor's rules (G3 plan, design calls): the round limit of BRIEF section 8, the clamping of weights, the
// locked toggles of a preset that uses its whole allowance, and the round named on the address.
import { describe, expect, it } from 'vitest';
import { roundFromSearch } from '../../src/ui/editor.ts';
import { activeCount, setWeight, toggleKpi, planLocked } from '../../src/world/bonusPlan.ts';
import { loadPreset, validateRewardSpec } from '../../src/world/config.ts';
import { KPI_KEYS } from '../../src/world/types.ts';
import { spec } from '../helpers.ts';

const round1 = loadPreset('round1').spec;

describe('activeCount', () => {
  it('counts the measures that are on', () => {
    expect(activeCount(round1)).toBe(1);
    expect(activeCount(spec({}))).toBe(0);
    expect(activeCount(spec({ profit: 10, incidents: -5, overRatio: -5 }))).toBe(3);
  });
});

describe('toggleKpi', () => {
  it('turns a measure on at its stored weight (D26) and returns a new object that validates', () => {
    const before = structuredClone(round1);
    const next = toggleKpi(round1, 'incidents', 3);
    expect(next).not.toBeNull();
    expect(next).not.toBe(round1);
    expect(next?.kpis.incidents).toEqual({ on: true, weight: -5 });
    expect(next?.kpis.profit).toEqual({ on: true, weight: 10 });
    expect(round1).toEqual(before);
    expect(validateRewardSpec(next)).toEqual(next);
  });

  it('refuses the toggle that would pass the round limit', () => {
    const two = toggleKpi(round1, 'incidents', 3);
    const three = toggleKpi(two as NonNullable<typeof two>, 'reputation', 3);
    expect(activeCount(three as NonNullable<typeof three>)).toBe(3);
    expect(toggleKpi(three as NonNullable<typeof three>, 'fatigue', 3)).toBeNull();
    expect(toggleKpi(round1, 'incidents', 1)).toBeNull();
    expect(toggleKpi(round1, 'incidents', 2)).not.toBeNull();
  });

  it('always allows turning a measure off, and keeps its weight', () => {
    const three = spec({ profit: 10, incidents: -5, overRatio: -5 });
    const off = toggleKpi(three, 'profit', 3);
    expect(off?.kpis.profit).toEqual({ on: false, weight: 10 });
    expect(activeCount(off as NonNullable<typeof off>)).toBe(2);
    expect(toggleKpi(round1, 'profit', 1)?.kpis.profit).toEqual({ on: false, weight: 10 });
  });
});

describe('setWeight', () => {
  it('clamps to −10..+10 and rounds to an integer, on or off', () => {
    expect(setWeight(round1, 'profit', 12).kpis.profit.weight).toBe(10);
    expect(setWeight(round1, 'profit', -11).kpis.profit.weight).toBe(-10);
    expect(setWeight(round1, 'profit', 3.7).kpis.profit.weight).toBe(4);
    expect(setWeight(round1, 'profit', 2.5).kpis.profit.weight).toBe(3);
    expect(setWeight(round1, 'profit', -2.4).kpis.profit.weight).toBe(-2);
    expect(setWeight(round1, 'profit', 0).kpis.profit).toEqual({ on: true, weight: 0 });
    expect(setWeight(round1, 'incidents', -7).kpis.incidents).toEqual({ on: false, weight: -7 });
  });

  it('leaves the weight alone for a value that is not a finite number', () => {
    expect(setWeight(round1, 'profit', NaN).kpis.profit.weight).toBe(10);
    expect(setWeight(round1, 'profit', Infinity).kpis.profit.weight).toBe(10);
    expect(setWeight(round1, 'profit', -Infinity).kpis.profit.weight).toBe(10);
  });

  it('never mutates its input and every result validates', () => {
    const before = structuredClone(round1);
    for (const v of [12, -11, 3.7, 2.5, NaN, Infinity, 0, -10, 10]) {
      for (const k of KPI_KEYS) {
        const next = setWeight(round1, k, v);
        expect(next).not.toBe(round1);
        expect(validateRewardSpec(next)).toEqual(next);
      }
    }
    expect(round1).toEqual(before);
  });
});

describe('planLocked', () => {
  it('locks a preset that already uses its whole allowance (Round 1) and no other', () => {
    expect(planLocked(loadPreset('round1'))).toBe(true);
    expect(planLocked(loadPreset('round2'))).toBe(false);
    expect(planLocked(loadPreset('round3'))).toBe(false);
    expect(planLocked(loadPreset('balanced'))).toBe(false);
  });
});

describe('roundFromSearch', () => {
  it('reads ?round=2 or ?round=round3 and falls back to Round 1', () => {
    expect(roundFromSearch('')).toBe('round1');
    expect(roundFromSearch('?round=1')).toBe('round1');
    expect(roundFromSearch('?round=2')).toBe('round2');
    expect(roundFromSearch('?round=3')).toBe('round3');
    expect(roundFromSearch('?round=round2')).toBe('round2');
    expect(roundFromSearch('?round=round3')).toBe('round3');
    expect(roundFromSearch('?round=9')).toBe('round1');
    expect(roundFromSearch('?round=balanced')).toBe('round1');
    expect(roundFromSearch('?round=')).toBe('round1');
    expect(roundFromSearch('?pilot=20')).toBe('round1');
    expect(roundFromSearch('?pilot=20&round=3')).toBe('round3');
  });
});
