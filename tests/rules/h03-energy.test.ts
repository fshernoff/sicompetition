// H3: free play raises floor energy, nap lowers it, and high energy plus crowding is where incidents happen.
import { describe, expect, it } from 'vitest';
import { energyDelta, energyFactor, incidentProbability } from '../../src/world/rules.ts';
import { initialState, step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState } from '../helpers.ts';

describe('H3 energy', () => {
  it('moves +20 free play, +5 structured, -30 nap, -10 walk, 0 clean', () => {
    expect(energyDelta('freePlay', config)).toBe(20);
    expect(energyDelta('structuredPlay', config)).toBe(5);
    expect(energyDelta('nap', config)).toBe(-30);
    expect(energyDelta('walk', config)).toBe(-10);
    expect(energyDelta('clean', config)).toBe(0);
  });

  it('starts every day at 40', () => {
    expect(initialState(config).energy).toBe(40);
    const pickup = step(floorState({ block: 3, energy: 95 }), floorAction('freePlay'), config, constRng(0.99));
    expect(pickup.state.day).toBe(1);
    expect(pickup.state.energy).toBe(40);
  });

  it('applies the activity delta after the block and clamps to 0..100', () => {
    expect(step(floorState({ energy: 40 }), floorAction('freePlay'), config, constRng(0.99)).state.energy).toBe(60);
    expect(step(floorState({ energy: 90 }), floorAction('freePlay'), config, constRng(0.99)).state.energy).toBe(100);
    expect(step(floorState({ energy: 20 }), floorAction('nap'), config, constRng(0.99)).state.energy).toBe(0);
  });

  it('scales incident probability by 0.5 + energy/100', () => {
    expect(energyFactor(0, config)).toBeCloseTo(0.5, 10);
    expect(energyFactor(50, config)).toBeCloseTo(1.0, 10);
    expect(energyFactor(100, config)).toBeCloseTo(1.5, 10);
    expect(incidentProbability(20, 100, 'freePlay', config)).toBeCloseTo(0.855, 10);
  });

  it('uses the energy at the start of the block for the draw', () => {
    const hot = step(floorState({ energy: 100 }), floorAction('freePlay'), config, constRng(0.62));
    expect(hot.deltas.incidents).toBe(1);
    const cool = step(floorState({ energy: 40 }), floorAction('freePlay'), config, constRng(0.62));
    expect(cool.deltas.incidents).toBe(0);
    const over = step(floorState({ energy: 100 }), floorAction('freePlay'), config, constRng(0.86));
    expect(over.deltas.incidents).toBe(0);
  });

  it('multiplies by the activity: nap and clean 0.1, structured 0.6 when led, walk 1.0', () => {
    expect(incidentProbability(20, 40, 'nap', config)).toBeCloseTo(0.0513, 10);
    expect(incidentProbability(20, 40, 'clean', config)).toBeCloseTo(0.0513, 10);
    expect(incidentProbability(20, 40, 'walk', config)).toBeCloseTo(0.513, 10);
    expect(incidentProbability(10, 40, 'structuredPlay', config)).toBeCloseTo(0.0108, 10);
  });

  it('caps the combined probability at 0.9', () => {
    expect(incidentProbability(30, 100, 'freePlay', config)).toBeCloseTo(0.9, 10);
  });
});
