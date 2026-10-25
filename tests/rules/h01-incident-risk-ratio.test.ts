// H1: incident risk climbs steeply above 10 dogs per staffer.
import { describe, expect, it } from 'vitest';
import { incidentBaseProbability, incidentProbability } from '../../src/world/rules.ts';
import { step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState } from '../helpers.ts';

describe('H1 incident risk climbs steeply above 10 dogs per staffer', () => {
  it('is flat at 0.02 up to 10, +0.03 per dog to 15, +0.08 per dog above, capped at 0.9', () => {
    expect(incidentBaseProbability(5, config)).toBeCloseTo(0.02, 10);
    expect(incidentBaseProbability(10, config)).toBeCloseTo(0.02, 10);
    expect(incidentBaseProbability(12, config)).toBeCloseTo(0.08, 10);
    expect(incidentBaseProbability(15, config)).toBeCloseTo(0.17, 10);
    expect(incidentBaseProbability(20, config)).toBeCloseTo(0.57, 10);
    expect(incidentBaseProbability(25, config)).toBeCloseTo(0.9, 10);
    expect(incidentBaseProbability(30, config)).toBeCloseTo(0.9, 10);
  });

  it('is steeper above the legal line than below it', () => {
    const below = incidentBaseProbability(11, config) - incidentBaseProbability(10, config);
    const above = incidentBaseProbability(16, config) - incidentBaseProbability(15, config);
    expect(above).toBeGreaterThan(below);
  });

  it('is 0 with no dogs on the floor', () => {
    expect(incidentBaseProbability(0, config)).toBe(0);
    expect(incidentProbability(0, 100, 'freePlay', config)).toBe(0);
  });

  it('combines with energy and activity: 20 dogs, 1 staffer, energy 40, free play is 0.513', () => {
    expect(incidentProbability(20, 40, 'freePlay', config)).toBeCloseTo(0.513, 10);
    expect(incidentProbability(10, 40, 'freePlay', config)).toBeCloseTo(0.018, 10);
  });

  it('an incident happens in a block when the draw is below the probability', () => {
    const hit = step(floorState(), floorAction('freePlay'), config, constRng(0.51));
    expect(hit.deltas.incidents).toBe(1);
    expect(hit.events.map((e) => e.type)).toContain('incident');
    const miss = step(floorState(), floorAction('freePlay'), config, constRng(0.52));
    expect(miss.deltas.incidents).toBe(0);
    expect(miss.events.map((e) => e.type)).not.toContain('incident');
  });
});
