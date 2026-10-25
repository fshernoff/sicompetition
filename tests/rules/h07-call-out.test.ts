// H7: a staffer who works three days without help calls out.
import { describe, expect, it } from 'vitest';
import { step } from '../../src/world/step.ts';
import { config, constRng, countingRng, floorAction, floorState, makeState, planAction } from '../helpers.ts';

describe('H7 call-out after three solo days', () => {
  it('counts consecutive days the floor ran with exactly one staffer', () => {
    expect(step(floorState({ block: 3, floorStaff: 1, soloStreak: 0 }), floorAction('freePlay'), config, constRng(0.99)).state.soloStreak).toBe(1);
    expect(step(floorState({ block: 3, floorStaff: 1, soloStreak: 2 }), floorAction('freePlay'), config, constRng(0.99)).state.soloStreak).toBe(3);
    expect(step(floorState({ block: 3, floorStaff: 2, scheduledStaff: 2, soloStreak: 2 }), floorAction('freePlay'), config, constRng(0.99)).state.soloStreak).toBe(0);
  });

  it('does not call out with a streak of two', () => {
    const r = step(makeState({ day: 2, soloStreak: 2 }), planAction('all', 'premium', 1), config, constRng(0.99));
    expect(r.state.calledOut).toBe(false);
    expect(r.state.floorStaff).toBe(1);
    expect(r.state.closed).toBe(false);
  });

  it('with help scheduled after three solo days, everyone comes in and is paid', () => {
    const r = step(makeState({ day: 3, soloStreak: 3 }), planAction('all', 'premium', 2), config, constRng(0.99));
    expect(r.state.calledOut).toBe(false);
    expect(r.state.closed).toBe(false);
    expect(r.state.scheduledStaff).toBe(2);
    expect(r.state.floorStaff).toBe(2);
    expect(r.state.dogsOnFloor).toBe(20);
    expect(r.deltas.profit).toBe(20 * 52 - 600);
    expect(r.events).toEqual([]);
  });

  it('the day with help resets the streak at pickup', () => {
    const r = step(floorState({ day: 3, block: 3, floorStaff: 2, scheduledStaff: 2, soloStreak: 3 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.state.soloStreak).toBe(0);
    expect(r.state.day).toBe(4);
  });

  it('scheduled alone again, the staffer calls out and the daycare is closed for the day', () => {
    const r = step(makeState({ day: 3, soloStreak: 3 }), planAction('all', 'premium', 1), config, constRng(0.99));
    expect(r.state.closed).toBe(true);
    expect(r.state.calledOut).toBe(true);
    expect(r.state.scheduledStaff).toBe(1);
    expect(r.state.floorStaff).toBe(0);
    expect(r.state.dogsOnFloor).toBe(0);
    expect(r.deltas.profit).toBe(0);
    expect(r.deltas.dogsServed).toBe(0);
    expect(r.deltas.reputation).toBe(-10);
    expect(r.state.reputation).toBe(40);
    expect(r.activity).toBeNull();
    expect(r.floorRatio).toBe(0);
    const types = r.events.map((e) => e.type);
    expect(types).toContain('callOut');
    expect(types).toContain('closed');
  });

  it('a closed drop-off takes no draws', () => {
    const rng = countingRng(constRng(0.0));
    step(makeState({ day: 3, soloStreak: 3 }), planAction('all', 'premium', 1), config, rng);
    expect(rng.draws()).toBe(0);
  });

  it('a closed day passes its blocks with no draws, no deltas and no floor', () => {
    const closed = makeState({ day: 3, block: 1, closed: true, calledOut: true, scheduledStaff: 1, floorStaff: 0, dogsOnFloor: 0, reputation: 40, plan: { bookings: 'all', rate: 'premium', staff: 1 } });
    const rng = countingRng(constRng(0.0));
    const r = step(closed, floorAction('nap'), config, rng);
    expect(rng.draws()).toBe(0);
    expect(r.activity).toBeNull();
    expect(r.floorRatio).toBe(0);
    expect(Object.values(r.deltas).every((v) => v === 0)).toBe(true);
    expect(Object.values(r.money).every((v) => v === 0)).toBe(true);
    expect(r.state.energy).toBe(closed.energy);
    expect(r.state.fatigue).toBe(closed.fatigue);
    expect(r.state.cleanliness).toBe(closed.cleanliness);
  });

  it('a closed day ignores walk and clean: no photo, no cleaning, no supplies, no fallback events', () => {
    const closed = makeState({ day: 3, block: 2, closed: true, calledOut: true, scheduledStaff: 1, floorStaff: 0, dogsOnFloor: 0, reputation: 40, cleanliness: 20, fatigue: 90, plan: { bookings: 'all', rate: 'premium', staff: 1 } });
    const walk = step(closed, floorAction('walk'), config, countingRng(constRng(0.0)));
    expect(walk.events).toEqual([]);
    expect(walk.state.reputation).toBe(40);
    expect(walk.deltas.fatigue).toBe(0);
    const clean = step(closed, floorAction('clean'), config, countingRng(constRng(0.0)));
    expect(clean.state.cleanliness).toBe(20);
    expect(clean.deltas.profit).toBe(0);
    expect(clean.events).toEqual([]);
  });

  it('a closed pickup still recovers overnight, sets tomorrow from reputation alone, and resets the streak', () => {
    const closed = makeState({ day: 3, block: 3, closed: true, calledOut: true, scheduledStaff: 1, floorStaff: 0, dogsOnFloor: 0, reputation: 40, cleanliness: 30, fatigue: 60, plan: { bookings: 'all', rate: 'premium', staff: 1 } });
    const r = step(closed, floorAction('nap'), config, countingRng(constRng(0.0)));
    expect(r.pickup).toBeDefined();
    expect(r.state.day).toBe(4);
    expect(r.state.requestsToday).toBe(20); // round(20 + 0.05 × −10) = round(19.5) = 20, no rate effect
    expect(r.state.cleanliness).toBe(40);
    expect(r.state.fatigue).toBe(45);
    expect(r.state.soloStreak).toBe(0);
    expect(r.state.closed).toBe(false);
    expect(r.state.calledOut).toBe(false);
  });

  it('legal bookings use the scheduled count, which is the floor count on an open day', () => {
    const r = step(makeState({ requestsToday: 30 }), planAction('legal', 'standard', 2), config, constRng(0.99));
    expect(r.state.dogsOnFloor).toBe(30);
    expect(r.state.floorStaff).toBe(2);
    expect(r.floorRatio).toBe(15);
    expect(r.deltas.overRatio).toBe(0);
  });
});
