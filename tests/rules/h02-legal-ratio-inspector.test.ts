// H2: the legal maximum is 15 dogs per staffer, and an inspector may fine the business over it.
import { describe, expect, it } from 'vitest';
import { step } from '../../src/world/step.ts';
import { config, countingRng, floorAction, floorState, seqRng } from '../helpers.ts';

describe('H2 legal ratio 15 and the inspector', () => {
  it('counts a block over the legal ratio only when dogs per staffer exceed 15', () => {
    expect(step(floorState({ dogsOnFloor: 20 }), floorAction('freePlay'), config, seqRng([0.99, 0.99])).deltas.overRatio).toBe(1);
    expect(step(floorState({ dogsOnFloor: 16 }), floorAction('freePlay'), config, seqRng([0.99, 0.99])).deltas.overRatio).toBe(1);
    expect(step(floorState({ dogsOnFloor: 15 }), floorAction('freePlay'), config, seqRng([0.99])).deltas.overRatio).toBe(0);
    expect(step(floorState({ dogsOnFloor: 30, floorStaff: 2, scheduledStaff: 2 }), floorAction('freePlay'), config, seqRng([0.99])).deltas.overRatio).toBe(0);
  });

  it('fines $250 and drops reputation 5 when the inspector draw is below 0.05', () => {
    const r = step(floorState(), floorAction('freePlay'), config, seqRng([0.99, 0.04]));
    expect(r.events.map((e) => e.type)).toContain('inspection');
    expect(r.deltas.profit).toBe(200 - 250);
    expect(r.deltas.reputation).toBe(-5);
    expect(r.state.reputation).toBe(45);
    expect(r.state.cash).toBe(2000 + 200 - 250);
  });

  it('does not fine at a draw of exactly 0.05', () => {
    const r = step(floorState(), floorAction('freePlay'), config, seqRng([0.99, 0.05]));
    expect(r.events.map((e) => e.type)).not.toContain('inspection');
    expect(r.deltas.profit).toBe(200);
  });

  it('takes no inspector draw at or under the legal line', () => {
    const rng = countingRng(seqRng([0.99]));
    step(floorState({ dogsOnFloor: 15 }), floorAction('freePlay'), config, rng);
    expect(rng.draws()).toBe(1);
    const over = countingRng(seqRng([0.99, 0.99]));
    step(floorState({ dogsOnFloor: 16 }), floorAction('freePlay'), config, over);
    expect(over.draws()).toBe(2);
  });
});
