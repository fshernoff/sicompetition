// The Q-table and ε-greedy selection, with the draw order the G2 plan fixes.
import { describe, expect, it } from 'vitest';
import { MAX_ACTIONS, QTable, chooseAction } from '../../src/learn/qlearn.ts';
import { OBSERVATION_COUNT } from '../../src/learn/observe.ts';
import { constRng, countingRng, seqRng } from '../helpers.ts';

describe('QTable', () => {
  it('starts at 0 over 1,161 observations and 27 actions', () => {
    const q = new QTable();
    expect(q.observations).toBe(OBSERVATION_COUNT);
    expect(q.maxActions).toBe(MAX_ACTIONS);
    expect(q.get(0, 0)).toBe(0);
    expect(q.get(1160, 26)).toBe(0);
    expect(q.reachedObservations()).toBe(0);
  });

  it('updates toward the target by alpha and counts the visit', () => {
    const q = new QTable();
    q.set(5, 2, 10);
    expect(q.update(5, 2, 20, 0.1)).toBeCloseTo(11, 10);
    expect(q.get(5, 2)).toBeCloseTo(11, 10);
    expect(q.visits(5, 2)).toBe(1);
    expect(q.visits(5, 3)).toBe(0);
    expect(q.reachedObservations()).toBe(1);
    expect(q.update(5, 2, 0, 1)).toBe(0);
    expect(q.visits(5, 2)).toBe(2);
  });

  it('takes the max over the first nActions slots only', () => {
    const q = new QTable();
    q.set(7, 0, 1);
    q.set(7, 4, 5);
    q.set(7, 10, 99);
    expect(q.maxValue(7, 5)).toBe(5);
    expect(q.maxValue(7, 27)).toBe(99);
  });

  it('picks the best action without a draw when nothing ties', () => {
    const q = new QTable();
    q.set(8, 1, 3);
    const rng = countingRng(constRng(0.9));
    expect(q.best(8, 5, rng)).toBe(1);
    expect(rng.draws()).toBe(0);
  });

  it('breaks a tie with exactly one draw, uniformly among the tied actions', () => {
    const q = new QTable();
    const all = countingRng(constRng(0.5));
    expect(q.best(9, 5, all)).toBe(2); // floor(0.5 × 5) among 0..4
    expect(all.draws()).toBe(1);
    q.set(10, 1, 7);
    q.set(10, 3, 7);
    expect(q.best(10, 5, constRng(0.5))).toBe(3); // floor(0.5 × 2) → the second of [1, 3]
    expect(q.best(10, 5, constRng(0.0))).toBe(1);
    expect(q.best(10, 5, constRng(0.99))).toBe(3);
  });
});

describe('chooseAction', () => {
  it('explores with a second draw when the first is below epsilon', () => {
    const q = new QTable();
    q.set(11, 2, 9);
    const rng = countingRng(seqRng([0.4, 0.9]));
    expect(chooseAction(q, 11, 5, 0.5, rng)).toBe(4); // floor(0.9 × 5)
    expect(rng.draws()).toBe(2);
  });

  it('exploits with one draw when the first is at or above epsilon', () => {
    const q = new QTable();
    q.set(11, 2, 9);
    const rng = countingRng(seqRng([0.5]));
    expect(chooseAction(q, 11, 5, 0.5, rng)).toBe(2);
    expect(rng.draws()).toBe(1);
  });

  it('never explores at epsilon 0 and always explores at epsilon 1', () => {
    const q = new QTable();
    q.set(12, 3, 1);
    expect(chooseAction(q, 12, 5, 0, seqRng([0.0]))).toBe(3);
    expect(chooseAction(q, 12, 5, 1, seqRng([0.999, 0.1]))).toBe(0);
  });

  it('exploiting a tie costs one more draw', () => {
    const q = new QTable();
    const rng = countingRng(seqRng([0.9, 0.5]));
    expect(chooseAction(q, 13, 5, 0.5, rng)).toBe(2);
    expect(rng.draws()).toBe(2);
  });
});
