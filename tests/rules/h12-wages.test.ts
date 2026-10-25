// H12: wages.
import { describe, expect, it } from 'vitest';
import { step } from '../../src/world/step.ts';
import { config, constRng, makeState, planAction } from '../helpers.ts';

describe('H12 wages', () => {
  it('charges $300 per scheduled staffer at drop-off', () => {
    expect(step(makeState(), planAction('all', 'premium', 1), config, constRng(0.99)).deltas.profit).toBe(1040 - 300);
    expect(step(makeState(), planAction('all', 'premium', 2), config, constRng(0.99)).deltas.profit).toBe(1040 - 600);
    expect(step(makeState(), planAction('all', 'premium', 3), config, constRng(0.99)).deltas.profit).toBe(1040 - 900);
    expect(step(makeState(), planAction('all', 'premium', 3), config, constRng(0.99)).money.wages).toBe(900);
  });

  it('pays everyone who comes in after three solo days', () => {
    const r = step(makeState({ day: 3, soloStreak: 3 }), planAction('all', 'premium', 3), config, constRng(0.99));
    expect(r.state.floorStaff).toBe(3);
    expect(r.deltas.profit).toBe(1040 - 900);
  });

  it('charges nothing on a closed day', () => {
    const r = step(makeState({ day: 3, soloStreak: 3 }), planAction('all', 'premium', 1), config, constRng(0.99));
    expect(r.deltas.profit).toBe(0);
    expect(r.money.wages).toBe(0);
  });

  it('charges wages on a day with no requests', () => {
    const r = step(makeState({ requestsToday: 0 }), planAction('all', 'premium', 2), config, constRng(0.99));
    expect(r.deltas.profit).toBe(-600);
    expect(r.state.dogsOnFloor).toBe(0);
  });
});
