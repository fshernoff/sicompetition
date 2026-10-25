// H8: walks earn app photos that lift reputation but cost a staffer's block.
import { describe, expect, it } from 'vitest';
import { floorForActivity } from '../../src/world/rules.ts';
import { step } from '../../src/world/step.ts';
import { config, constRng, countingRng, floorAction, floorState, seqRng } from '../helpers.ts';

describe('H8 walks', () => {
  it('takes one staffer and up to six dogs off the floor', () => {
    expect(floorForActivity(20, 2, 'walk', config)).toEqual({ activity: 'walk', dogs: 14, staff: 1, ratio: 14, walkingDogs: 6, fellBack: null });
    expect(floorForActivity(6, 2, 'walk', config)).toEqual({ activity: 'walk', dogs: 0, staff: 1, ratio: 0, walkingDogs: 6, fellBack: null });
    expect(floorForActivity(5, 3, 'walk', config)).toEqual({ activity: 'walk', dogs: 0, staff: 2, ratio: 0, walkingDogs: 5, fellBack: null });
    expect(floorForActivity(0, 2, 'walk', config)).toEqual({ activity: 'walk', dogs: 0, staff: 1, ratio: 0, walkingDogs: 0, fellBack: null });
  });

  it('falls back to free play with one staffer', () => {
    expect(floorForActivity(20, 1, 'walk', config)).toEqual({ activity: 'freePlay', dogs: 20, staff: 1, ratio: 20, walkingDogs: 0, fellBack: 'walkFellBack' });
  });

  it('takes no photo of an empty leash', () => {
    const r = step(floorState({ dogsOnFloor: 0, floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, constRng(0.99));
    expect(r.activity).toBe('walk');
    expect(r.deltas.reputation).toBe(0);
    expect(r.events.map((e) => e.type)).not.toContain('walkPhoto');
  });

  it('lifts reputation 3, calms the floor 10, and earns the add-on for every dog present', () => {
    const r = step(floorState({ floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, constRng(0.99));
    expect(r.activity).toBe('walk');
    expect(r.floorRatio).toBe(14);
    expect(r.deltas.reputation).toBe(3);
    expect(r.deltas.profit).toBe(200);
    expect(r.deltas.overRatio).toBe(0);
    expect(r.state.energy).toBe(30);
    expect(r.state.reputation).toBe(53);
    expect(r.events.map((e) => e.type)).toContain('walkPhoto');
  });

  it('with one staffer it is free play: no photo, energy up', () => {
    const r = step(floorState(), floorAction('walk'), config, constRng(0.99));
    expect(r.activity).toBe('freePlay');
    expect(r.deltas.reputation).toBe(0);
    expect(r.state.energy).toBe(60);
    expect(r.events.map((e) => e.type)).toContain('walkFellBack');
    expect(r.events.map((e) => e.type)).not.toContain('walkPhoto');
  });

  it('sums the step\'s reputation effects and clamps once: 99 + 3 − 2 is 100, delta +1', () => {
    // floor 14 on 1 at energy 40: p = 0.126; draw 0.12 is an incident, the vet draw 0.12 is not a bill, no inspector draw
    const r = step(floorState({ floorStaff: 2, scheduledStaff: 2, reputation: 99 }), floorAction('walk'), config, constRng(0.12));
    expect(r.deltas.incidents).toBe(1);
    expect(r.state.reputation).toBe(100);
    expect(r.deltas.reputation).toBe(1);
  });

  it('the floor left behind can be over the legal line: 30 dogs on 2 staff walking is 24 on 1', () => {
    const rng = countingRng(seqRng([0.99, 0.04]));
    const r = step(floorState({ dogsOnFloor: 30, floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, rng);
    expect(r.floorRatio).toBe(24);
    expect(r.deltas.overRatio).toBe(1);
    expect(r.events.map((e) => e.type)).toContain('inspection');
    expect(rng.draws()).toBe(2);
  });

  it('a walk at pickup still gets the dogs sick on a dirty floor: walkers count', () => {
    // cleanliness 10 − 10 (20 dogs present) = 0 → 2 cases; premium −2
    const r = step(floorState({ block: 3, cleanliness: 10, floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, constRng(0.99));
    expect(r.events.find((e) => e.type === 'illness')?.amount).toBe(2);
    expect(r.deltas.reputation).toBe(3 - 2);
    expect(r.state.requestsToday).toBe(20 - 1 - 2);
  });

  it('the floor left behind carries the incident risk: 14 dogs on 1 staffer at energy 40 is 0.126', () => {
    const hit = step(floorState({ floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, constRng(0.12));
    expect(hit.deltas.incidents).toBe(1);
    const miss = step(floorState({ floorStaff: 2, scheduledStaff: 2 }), floorAction('walk'), config, constRng(0.13));
    expect(miss.deltas.incidents).toBe(0);
  });
});
