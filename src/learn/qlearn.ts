// The Q-table and action selection. BRIEF section 13 and the G2 plan's settings table.
import type { Rng } from '../world/types.ts';
import { OBSERVATION_COUNT } from './observe.ts';

/** 27 plans at drop-off is the widest action set; floor rows use the first 5 slots. */
export const MAX_ACTIONS = 27;

/** One flat table of observations × MAX_ACTIONS doubles, plus a visit count per cell. */
export class QTable {
  readonly observations: number;
  readonly maxActions: number;
  /** Row-major: the value of (obs, a) is at obs × maxActions + a. 1,161 × 27 doubles = 251 KB. */
  private readonly values: Float64Array;
  private readonly counts: Uint32Array;

  /** `init` is every cell's starting value: 0 is the plan's pessimistic start (settings table, "Q init"). */
  constructor(observations: number = OBSERVATION_COUNT, maxActions: number = MAX_ACTIONS, init = 0) {
    this.observations = observations;
    this.maxActions = maxActions;
    this.values = new Float64Array(observations * maxActions);
    if (init !== 0) this.values.fill(init);
    this.counts = new Uint32Array(observations * maxActions);
  }

  /** A cell outside the table reads as 0 (a typed array's out-of-range read). */
  get(obs: number, action: number): number {
    return this.values[obs * this.maxActions + action] ?? 0;
  }

  set(obs: number, action: number, value: number): void {
    this.values[obs * this.maxActions + action] = value;
  }

  /** The highest value over actions 0..nActions−1. */
  maxValue(obs: number, nActions: number): number {
    const row = obs * this.maxActions;
    const v = this.values;
    let max = -Infinity;
    for (let a = 0; a < nActions; a++) {
      const x = v[row + a] as number;
      if (x > max) max = x;
    }
    return max;
  }

  /**
   * The index of the best action over 0..nActions−1. When two or more actions tie for the top value, one draw from
   * `rng` picks uniformly among them; when nothing ties, no draw is taken.
   */
  best(obs: number, nActions: number, rng: Rng): number {
    const row = obs * this.maxActions;
    const v = this.values;
    let max = -Infinity;
    let first = 0;
    let ties = 0;
    for (let a = 0; a < nActions; a++) {
      const x = v[row + a] as number;
      if (x > max) {
        max = x;
        first = a;
        ties = 1;
      } else if (x === max) {
        ties += 1;
      }
    }
    if (ties === 1) return first;
    // A tie: the k-th of the tied actions in index order, k uniform in 0..ties−1 (one draw).
    let k = Math.floor(rng.next() * ties);
    for (let a = first; a < nActions; a++) {
      if (v[row + a] === max) {
        if (k === 0) return a;
        k -= 1;
      }
    }
    return first; // unreachable: k < ties
  }

  /** Q(obs, a) += alpha × (target − Q(obs, a)); counts a visit; returns the new value. */
  update(obs: number, action: number, target: number, alpha: number): number {
    const i = obs * this.maxActions + action;
    const old = this.values[i] as number;
    const next = old + alpha * (target - old);
    this.values[i] = next;
    this.counts[i] = (this.counts[i] as number) + 1;
    return next;
  }

  visits(obs: number, action: number): number {
    return this.counts[obs * this.maxActions + action] ?? 0;
  }

  /** How many observations have at least one visited action. */
  reachedObservations(): number {
    let reached = 0;
    for (let o = 0; o < this.observations; o++) {
      const row = o * this.maxActions;
      for (let a = 0; a < this.maxActions; a++) {
        if (this.counts[row + a] !== 0) {
          reached += 1;
          break;
        }
      }
    }
    return reached;
  }
}

/**
 * ε-greedy. Draw order: u = rng.next(); if u < epsilon, explore: a second draw picks floor(rng.next() × nActions);
 * otherwise exploit: q.best(obs, nActions, rng) (which draws once more only on a tie).
 */
export function chooseAction(q: QTable, obs: number, nActions: number, epsilon: number, rng: Rng): number {
  if (rng.next() < epsilon) return Math.floor(rng.next() * nActions);
  return q.best(obs, nActions, rng);
}
