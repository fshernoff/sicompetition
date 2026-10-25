// H10: only play earns the add-on.
import { describe, expect, it } from 'vitest';
import { isPlayBlock } from '../../src/world/rules.ts';
import { step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState, makeState, planAction } from '../helpers.ts';

describe('H10 add-on revenue', () => {
  it('play blocks are free play, structured play and walk', () => {
    expect(isPlayBlock('freePlay')).toBe(true);
    expect(isPlayBlock('structuredPlay')).toBe(true);
    expect(isPlayBlock('walk')).toBe(true);
    expect(isPlayBlock('nap')).toBe(false);
    expect(isPlayBlock('clean')).toBe(false);
  });

  it('earns $10 per dog per play block in blocks 1 to 3', () => {
    expect(step(floorState(), floorAction('freePlay'), config, constRng(0.99)).deltas.profit).toBe(200);
    expect(step(floorState({ block: 2, dogsOnFloor: 12 }), floorAction('freePlay'), config, constRng(0.99)).deltas.profit).toBe(120);
  });

  it('earns nothing for a nap, and a clean costs $250 in supplies', () => {
    const nap = step(floorState(), floorAction('nap'), config, constRng(0.99));
    expect(nap.deltas.profit).toBe(0);
    expect(nap.money.addOnRevenue).toBe(0);
    const clean = step(floorState(), floorAction('clean'), config, constRng(0.99));
    expect(clean.deltas.profit).toBe(-250);
    expect(clean.money.supplies).toBe(250);
    expect(clean.state.cash).toBe(2000 - 250);
    const empty = step(floorState({ dogsOnFloor: 0 }), floorAction('clean'), config, constRng(0.99));
    expect(empty.deltas.profit).toBe(-250);
  });

  it('earns no add-on at drop-off: the day rate and the wages only', () => {
    const r = step(makeState(), planAction('all', 'premium', 1), config, constRng(0.99));
    expect(r.deltas.profit).toBe(20 * 52 - 300);
    expect(r.money).toEqual({ dayRateRevenue: 1040, addOnRevenue: 0, wages: 300, refunds: 0, vetCost: 0, fineCost: 0, supplies: 0 });
    expect(r.deltas.dogsServed).toBe(20);
    expect(r.state.cash).toBe(2000 + 20 * 52 - 300);
  });

  it('charges the day rate chosen: low 28, standard 40, premium 52', () => {
    expect(step(makeState(), planAction('all', 'low', 1), config, constRng(0.99)).deltas.profit).toBe(20 * 28 - 300);
    expect(step(makeState(), planAction('all', 'standard', 1), config, constRng(0.99)).deltas.profit).toBe(20 * 40 - 300);
  });

  it('reports the add-on on the money lines', () => {
    const r = step(floorState(), floorAction('freePlay'), config, constRng(0.99));
    expect(r.money.addOnRevenue).toBe(200);
    expect(r.money.dayRateRevenue).toBe(0);
  });

  it('books all, up to 15 per scheduled staffer, or up to 10', () => {
    expect(step(makeState({ requestsToday: 30 }), planAction('all', 'standard', 1), config, constRng(0.99)).state.dogsOnFloor).toBe(30);
    expect(step(makeState({ requestsToday: 30 }), planAction('legal', 'standard', 1), config, constRng(0.99)).state.dogsOnFloor).toBe(15);
    expect(step(makeState({ requestsToday: 30 }), planAction('legal', 'standard', 2), config, constRng(0.99)).state.dogsOnFloor).toBe(30);
    expect(step(makeState({ requestsToday: 30 }), planAction('safe', 'standard', 2), config, constRng(0.99)).state.dogsOnFloor).toBe(20);
    expect(step(makeState({ requestsToday: 8 }), planAction('safe', 'standard', 1), config, constRng(0.99)).state.dogsOnFloor).toBe(8);
  });
});
