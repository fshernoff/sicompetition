// BRIEF section 3.1: the coarse observation (D28: no fatigue, no cleanliness at drop-off).
import { describe, expect, it } from 'vitest';
import {
  CLOSED_OBSERVATION,
  DROP_OFF_OBSERVATIONS,
  FLOOR_OBSERVATIONS,
  OBSERVATION_COUNT,
  cleanBin,
  energyBin,
  isDecision,
  loadBin,
  observe,
  ratioBin,
  streakBin,
} from '../../src/learn/observe.ts';
import { config, floorState, makeState } from '../helpers.ts';

describe('observation bins', () => {
  it('has 80 drop-off, 1,080 floor and one closed observation', () => {
    expect(DROP_OFF_OBSERVATIONS).toBe(80);
    expect(FLOOR_OBSERVATIONS).toBe(1080);
    expect(CLOSED_OBSERVATION).toBe(1160);
    expect(OBSERVATION_COUNT).toBe(1161);
  });

  it('bins requests at 10, 15 and 20', () => {
    expect([0, 10, 11, 15, 16, 20, 21, 30].map((r) => loadBin(r, config))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('bins the floor ratio at 10, 15 and 20', () => {
    expect([0, 10, 10.5, 15, 15.5, 20, 21, 30].map((r) => ratioBin(r, config))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('bins the solo streak at 0, 1, 2 and 3 or more', () => {
    expect([0, 1, 2, 3, 4, 5].map(streakBin)).toEqual([0, 1, 2, 3, 3, 3]);
  });

  it('bins energy below 35, 35 to 70, above 70', () => {
    expect([0, 34, 35, 70, 71, 100].map(energyBin)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('bins cleanliness at the illness threshold', () => {
    expect([100, 40, 39, 0].map((c) => cleanBin(c, config))).toEqual([0, 0, 1, 1]);
  });
});

describe('observe', () => {
  it('maps Monday drop-off with 20 requests to index 8', () => {
    expect(observe(makeState(), config)).toBe(8);
  });

  it('maps the reckless floor (20 dogs, 1 staffer, energy 40, block 1) to index 118', () => {
    expect(observe(floorState(), config)).toBe(118);
  });

  it('fills the drop-off range 0..79 and the floor range 80..1159', () => {
    expect(observe(makeState({ requestsToday: 0 }), config)).toBe(0);
    expect(observe(makeState({ day: 4, requestsToday: 30, soloStreak: 5 }), config)).toBe(79);
    expect(observe(floorState({ day: 0, block: 1, dogsOnFloor: 0, floorStaff: 1, energy: 0, cleanliness: 100 }), config)).toBe(80);
    // 30 dogs on 1 staffer: ratio bin 3, staff slot 0 → 1147; the top index 1159 needs ratio > 20 with 3 staffers,
    // which 30 dogs cannot produce, so the floor range is 80..1159 by formula and 80..1147 by reach.
    expect(observe(floorState({ day: 4, block: 3, dogsOnFloor: 30, floorStaff: 1, scheduledStaff: 1, energy: 100, cleanliness: 0 }), config)).toBe(1147);
    expect(observe(floorState({ day: 4, block: 3, dogsOnFloor: 30, floorStaff: 3, scheduledStaff: 3, energy: 100, cleanliness: 0 }), config)).toBe(1105);
  });

  it('is the same index for the same state and a different one across every bin boundary', () => {
    expect(observe(makeState(), config)).toBe(observe(makeState(), config));
    expect(observe(makeState({ requestsToday: 10 }), config)).not.toBe(observe(makeState({ requestsToday: 11 }), config));
    expect(observe(makeState({ requestsToday: 15 }), config)).not.toBe(observe(makeState({ requestsToday: 16 }), config));
    expect(observe(makeState({ requestsToday: 20 }), config)).not.toBe(observe(makeState({ requestsToday: 21 }), config));
    expect(observe(makeState({ soloStreak: 2 }), config)).not.toBe(observe(makeState({ soloStreak: 3 }), config));
    expect(observe(makeState({ soloStreak: 3 }), config)).toBe(observe(makeState({ soloStreak: 4 }), config));
    expect(observe(makeState({ day: 0 }), config)).not.toBe(observe(makeState({ day: 1 }), config));
    expect(observe(floorState({ energy: 34 }), config)).not.toBe(observe(floorState({ energy: 35 }), config));
    expect(observe(floorState({ energy: 70 }), config)).not.toBe(observe(floorState({ energy: 71 }), config));
    expect(observe(floorState({ cleanliness: 40 }), config)).not.toBe(observe(floorState({ cleanliness: 39 }), config));
    expect(observe(floorState({ floorStaff: 1 }), config)).not.toBe(observe(floorState({ floorStaff: 2, scheduledStaff: 2 }), config));
    expect(observe(floorState({ dogsOnFloor: 15 }), config)).not.toBe(observe(floorState({ dogsOnFloor: 16 }), config));
    expect(observe(floorState({ block: 1 }), config)).not.toBe(observe(floorState({ block: 2 }), config));
    expect(observe(floorState({ day: 0 }), config)).not.toBe(observe(floorState({ day: 1 }), config));
  });

  it('ignores what the key leaves out: fatigue everywhere, cleanliness at drop-off, reputation, cash, requestsTomorrow', () => {
    expect(observe(makeState({ fatigue: 100, cleanliness: 0, reputation: 10, cash: 0, requestsTomorrow: 3 }), config)).toBe(observe(makeState(), config));
    expect(observe(floorState({ fatigue: 100, reputation: 5, cash: -50 }), config)).toBe(observe(floorState(), config));
  });

  it('sends a closed day\'s floor blocks to the closed observation, which is not a decision', () => {
    const closed = makeState({ day: 3, block: 2, closed: true, calledOut: true, scheduledStaff: 1, floorStaff: 0, dogsOnFloor: 0, plan: { bookings: 'all', rate: 'premium', staff: 1 } });
    expect(observe(closed, config)).toBe(CLOSED_OBSERVATION);
    expect(isDecision(closed)).toBe(false);
    expect(isDecision(makeState({ soloStreak: 3 }))).toBe(true); // the drop-off that may close the day is a decision
    expect(isDecision(floorState())).toBe(true);
    expect(isDecision(makeState({ day: 5, done: true }))).toBe(false);
    expect(() => observe(makeState({ day: 5, done: true }), config)).toThrow();
  });
});
