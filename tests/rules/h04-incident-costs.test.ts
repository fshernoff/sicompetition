// H4: every incident means a refund, a chance of a vet bill and a review drop.
import { describe, expect, it } from 'vitest';
import { step } from '../../src/world/step.ts';
import { config, countingRng, floorAction, floorState, seqRng } from '../helpers.ts';

describe('H4 incident costs', () => {
  it('refunds $15, bills $150 at the vet when the second draw is below 0.10, drops reputation 2', () => {
    const r = step(floorState(), floorAction('freePlay'), config, seqRng([0.0, 0.05, 0.99]));
    expect(r.deltas.incidents).toBe(1);
    expect(r.deltas.profit).toBe(200 - 15 - 150);
    expect(r.deltas.reputation).toBe(-2);
    expect(r.state.reputation).toBe(48);
    expect(r.state.cash).toBe(2000 + 200 - 15 - 150);
    const types = r.events.map((e) => e.type);
    expect(types).toContain('incident');
    expect(types).toContain('vetBill');
    expect(r.events.find((e) => e.type === 'vetBill')?.amount).toBe(150);
  });

  it('skips the vet bill when the second draw is 0.10 or more', () => {
    const r = step(floorState(), floorAction('freePlay'), config, seqRng([0.0, 0.1, 0.99]));
    expect(r.deltas.profit).toBe(200 - 15);
    expect(r.events.map((e) => e.type)).not.toContain('vetBill');
  });

  it('takes the vet draw only after an incident', () => {
    const miss = countingRng(seqRng([0.99, 0.99]));
    step(floorState(), floorAction('freePlay'), config, miss);
    expect(miss.draws()).toBe(2); // incident, inspector (ratio 20 > 15)
    const hit = countingRng(seqRng([0.0, 0.5, 0.99]));
    step(floorState(), floorAction('freePlay'), config, hit);
    expect(hit.draws()).toBe(3); // incident, vet, inspector
  });

  it('clamps reputation at 0', () => {
    const r = step(floorState({ reputation: 1 }), floorAction('freePlay'), config, seqRng([0.0, 0.5, 0.99]));
    expect(r.state.reputation).toBe(0);
    expect(r.deltas.reputation).toBe(-1);
  });
});
