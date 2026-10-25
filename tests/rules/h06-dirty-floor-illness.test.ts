// H6: a dirty floor causes illness and cancellations.
import { describe, expect, it } from 'vitest';
import { cleanlinessDelta, illnessExpected } from '../../src/world/rules.ts';
import { initialState, step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState, seqRng } from '../helpers.ts';

describe('H6 dirty floor, illness, cancellations', () => {
  it('starts the week at 80', () => {
    expect(initialState(config).cleanliness).toBe(80);
  });

  it('loses 0.5 per dog present in a play block, 0.1 in a nap, gains 50 when cleaned', () => {
    expect(cleanlinessDelta(20, 'freePlay', config)).toBe(-10);
    expect(cleanlinessDelta(20, 'structuredPlay', config)).toBe(-10);
    expect(cleanlinessDelta(20, 'walk', config)).toBe(-10);
    expect(cleanlinessDelta(20, 'nap', config)).toBe(-2);
    expect(cleanlinessDelta(20, 'clean', config)).toBe(50);
  });

  it('clamps to 0..100 and recovers 10 overnight', () => {
    expect(step(floorState({ cleanliness: 80 }), floorAction('clean'), config, constRng(0.99)).state.cleanliness).toBe(100);
    expect(step(floorState({ cleanliness: 5 }), floorAction('freePlay'), config, constRng(0.99)).state.cleanliness).toBe(0);
    const night = step(floorState({ block: 3, cleanliness: 50 }), floorAction('nap'), config, constRng(0.99));
    expect(night.state.cleanliness).toBe(58);
  });

  it('expects 10% of the dogs sick at cleanliness 0, scaling to none at 40', () => {
    expect(illnessExpected(20, 0, config)).toBeCloseTo(2, 10);
    expect(illnessExpected(20, 20, config)).toBeCloseTo(1, 10);
    expect(illnessExpected(20, 40, config)).toBe(0);
    expect(illnessExpected(20, 60, config)).toBe(0);
    expect(illnessExpected(10, 0, config)).toBeCloseTo(1, 10);
  });

  it('at pickup each case costs 1 reputation and cancels 1 request tomorrow', () => {
    // cleanliness 10 − 10 (20 dogs at play) = 0 at pickup → 2 cases, no fractional draw
    const r = step(floorState({ block: 3, cleanliness: 10 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.deltas.reputation).toBe(-2);
    expect(r.events.find((e) => e.type === 'illness')?.amount).toBe(2);
    expect(r.state.reputation).toBe(48);
    expect(r.pickup?.reputation).toBe(48); // the readout shows the day as it ended, sick dogs included
    expect(r.pickup?.illnessCases).toBe(2);
    expect(r.state.requestsToday).toBe(20 - 1 - 2); // premium −1, illness −2
    expect(r.state.cleanliness).toBe(10); // 0 + overnight 10
  });

  it('rounds the fractional case with one draw', () => {
    // 15 dogs: cleanliness 10 − 7.5 = 2.5 → expected 15 × 0.1 × 37.5/40 = 1.40625; ratio 15 → no inspector draw
    const two = step(floorState({ block: 3, cleanliness: 10, dogsOnFloor: 15 }), floorAction('freePlay'), config, seqRng([0.99, 0.3]));
    expect(two.events.find((e) => e.type === 'illness')?.amount).toBe(2);
    const one = step(floorState({ block: 3, cleanliness: 10, dogsOnFloor: 15 }), floorAction('freePlay'), config, seqRng([0.99, 0.5]));
    expect(one.events.find((e) => e.type === 'illness')?.amount).toBe(1);
  });

  it('rounds a half case with a draw strictly below the fraction', () => {
    // 20 dogs: cleanliness 40 − 10 = 30 at pickup → expected 0.5; ratio 20 → the inspector draw is taken first
    const one = step(floorState({ block: 3, cleanliness: 40 }), floorAction('freePlay'), config, seqRng([0.99, 0.99, 0.49]));
    expect(one.events.find((e) => e.type === 'illness')?.amount).toBe(1);
    const none = step(floorState({ block: 3, cleanliness: 40 }), floorAction('freePlay'), config, seqRng([0.99, 0.99, 0.5]));
    expect(none.events.map((e) => e.type)).not.toContain('illness');
  });

  it('causes no illness when the floor is clean enough at pickup', () => {
    const r = step(floorState({ block: 3, cleanliness: 60 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.events.map((e) => e.type)).not.toContain('illness');
    expect(r.deltas.reputation).toBe(0);
  });
});
