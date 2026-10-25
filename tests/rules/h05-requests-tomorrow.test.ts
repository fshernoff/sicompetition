// H5: reviews set tomorrow's requests.
import { describe, expect, it } from 'vitest';
import { requestsTomorrow } from '../../src/world/rules.ts';
import { initialState, step } from '../../src/world/step.ts';
import { config, constRng, floorAction, floorState, withConfig } from '../helpers.ts';

describe('H5 requests tomorrow', () => {
  it('is 20 + 0.05 × (reputation − 50), rounded half up, plus the rate effect, minus illness', () => {
    expect(requestsTomorrow(50, 'standard', 0, config)).toBe(20);
    expect(requestsTomorrow(30, 'standard', 0, config)).toBe(19);
    expect(requestsTomorrow(70, 'premium', 0, config)).toBe(20);
    expect(requestsTomorrow(50, 'low', 3, config)).toBe(20);
    expect(requestsTomorrow(50, 'premium', 0, config)).toBe(19);
    expect(requestsTomorrow(50, 'low', 0, config)).toBe(23);
    expect(requestsTomorrow(40, 'standard', 0, config)).toBe(20); // 19.5 rounds up
    expect(requestsTomorrow(0, 'standard', 0, config)).toBe(18); // 17.5 rounds up
  });

  it('ignores the rate on a closed day', () => {
    expect(requestsTomorrow(50, null, 0, config)).toBe(20);
  });

  it('clamps to 0..30', () => {
    expect(requestsTomorrow(0, 'premium', 20, config)).toBe(0);
    const busy = withConfig((c) => {
      c.requests.base = 28;
    });
    expect(requestsTomorrow(100, 'low', 0, busy)).toBe(30);
  });

  it('adds the drawn noise', () => {
    expect(requestsTomorrow(50, 'standard', 0, config, 3)).toBe(23);
    expect(requestsTomorrow(50, 'standard', 0, config, -3)).toBe(17);
  });

  it('starts Monday at 20 requests', () => {
    expect(initialState(config).requestsToday).toBe(20);
  });

  it('becomes the next day\'s requestsToday at pickup', () => {
    const r = step(floorState({ block: 3 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.state.day).toBe(1);
    expect(r.state.block).toBe(0);
    expect(r.state.requestsToday).toBe(19);
  });

  it('is projected after every block from the current reputation and today\'s rate', () => {
    const r = step(floorState({ block: 1 }), floorAction('freePlay'), config, constRng(0.99));
    expect(r.state.requestsTomorrow).toBe(19);
  });
});
