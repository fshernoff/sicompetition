// H11: fatigue.
import { describe, expect, it } from 'vitest';
import { fatigueGain } from '../../src/world/rules.ts';
import { initialState, step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState } from '../helpers.ts';

describe('H11 fatigue', () => {
  it('starts the week at 20', () => {
    expect(initialState(config).fatigue).toBe(20);
  });

  it('gains 2 per block plus 0.5 per dog per staffer above 6', () => {
    expect(fatigueGain(0, config)).toBe(2);
    expect(fatigueGain(4, config)).toBe(2);
    expect(fatigueGain(6, config)).toBe(2);
    expect(fatigueGain(10, config)).toBe(4);
    expect(fatigueGain(20, config)).toBe(9);
  });

  it('applies the gain each open block and clamps at 100', () => {
    expect(step(floorState({ fatigue: 20 }), floorAction('freePlay'), config, constRng(0.99)).state.fatigue).toBe(29);
    expect(step(floorState({ fatigue: 95 }), floorAction('freePlay'), config, constRng(0.99)).state.fatigue).toBe(100);
  });

  it('recovers 15 overnight', () => {
    const r = step(floorState({ block: 3, fatigue: 50 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.state.fatigue).toBe(44);
  });

  it('counts a block when fatigue ends it above 70', () => {
    expect(step(floorState({ fatigue: 65 }), floorAction('freePlay'), config, constRng(0.99)).deltas.fatigue).toBe(1);
    expect(step(floorState({ fatigue: 60 }), floorAction('freePlay'), config, constRng(0.99)).deltas.fatigue).toBe(0);
    expect(step(floorState({ fatigue: 61 }), floorAction('freePlay'), config, constRng(0.99)).deltas.fatigue).toBe(0); // 70 is not above 70
  });

  it('uses the floor left behind during a walk', () => {
    // 20 dogs, 2 staff, walk: floor 14 on 1 → gain 2 + 0.5 × 8 = 6
    const r = step(floorState({ floorStaff: 2, scheduledStaff: 2, fatigue: 20 }), floorAction('walk'), config, constRng(0.99));
    expect(r.state.fatigue).toBe(26);
  });
});
