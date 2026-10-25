// H9: structured play needs a staffer per 10 dogs.
import { describe, expect, it } from 'vitest';
import { floorForActivity } from '../../src/world/rules.ts';
import { step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState } from '../helpers.ts';

describe('H9 structured play', () => {
  it('is a led class at 10 dogs per staffer or fewer', () => {
    expect(floorForActivity(10, 1, 'structuredPlay', config)).toEqual({ activity: 'structuredPlay', dogs: 10, staff: 1, ratio: 10, walkingDogs: 0, fellBack: null });
    expect(floorForActivity(20, 2, 'structuredPlay', config).activity).toBe('structuredPlay');
  });

  it('is free play with a clipboard above that', () => {
    expect(floorForActivity(20, 1, 'structuredPlay', config)).toEqual({ activity: 'freePlay', dogs: 20, staff: 1, ratio: 20, walkingDogs: 0, fellBack: 'structuredFellBack' });
    expect(floorForActivity(11, 1, 'structuredPlay', config).fellBack).toBe('structuredFellBack');
  });

  it('led: energy +5 and the add-on', () => {
    const r = step(floorState({ dogsOnFloor: 10 }), floorAction('structuredPlay'), config, constRng(0.99));
    expect(r.activity).toBe('structuredPlay');
    expect(r.state.energy).toBe(45);
    expect(r.deltas.profit).toBe(100);
  });

  it('fallen back: energy +20, the add-on, and the event', () => {
    const r = step(floorState(), floorAction('structuredPlay'), config, constRng(0.99));
    expect(r.activity).toBe('freePlay');
    expect(r.state.energy).toBe(60);
    expect(r.deltas.profit).toBe(200);
    expect(r.events.map((e) => e.type)).toContain('structuredFellBack');
  });

  it('fallen back, the incident draw is at full free-play risk', () => {
    const r = step(floorState(), floorAction('structuredPlay'), config, constRng(0.37));
    expect(r.deltas.incidents).toBe(1);
  });
});
