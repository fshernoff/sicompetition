// Shared fixtures for the G1 tests. States are built directly (not through initialState) so a rule test does not
// depend on another package's code.
import configJson from '../src/world/config.default.json' with { type: 'json' };
import type {
  Action,
  Bookings,
  FloorActivity,
  Rate,
  RewardSpec,
  Rng,
  StaffCount,
  State,
  WorldConfig,
} from '../src/world/types.ts';

export const config: WorldConfig = configJson as WorldConfig;

/** A copy of the default config with `patch` applied by the caller. */
export function withConfig(patch: (c: WorldConfig) => void): WorldConfig {
  const c = structuredClone(config);
  patch(c);
  return c;
}

/** Every draw returns `v`. */
export function constRng(v: number): Rng {
  return { next: () => v };
}

/** Draws come from `values` in order, then `fallback` forever. */
export function seqRng(values: readonly number[], fallback = 0.99): Rng {
  let i = 0;
  return {
    next: () => {
      const v = values[i];
      i += 1;
      return v === undefined ? fallback : v;
    },
  };
}

/** Counts how many draws the world took. */
export function countingRng(inner: Rng): Rng & { draws: () => number } {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return inner.next();
    },
    draws: () => n,
  };
}

/** Monday drop-off, before any action. */
export function makeState(overrides: Partial<State> = {}): State {
  return {
    day: 0,
    block: 0,
    requestsToday: 20,
    dogsOnFloor: 0,
    scheduledStaff: 0,
    floorStaff: 0,
    soloStreak: 0,
    energy: 40,
    cleanliness: 80,
    fatigue: 20,
    reputation: 50,
    cash: 2000,
    requestsTomorrow: 20,
    plan: null,
    illnessCasesToday: 0,
    closed: false,
    calledOut: false,
    done: false,
    ...overrides,
  };
}

/** Monday late morning with 20 dogs and one staffer under (all, premium, 1): the reckless floor. */
export function floorState(overrides: Partial<State> = {}): State {
  return makeState({
    block: 1,
    dogsOnFloor: 20,
    scheduledStaff: 1,
    floorStaff: 1,
    plan: { bookings: 'all', rate: 'premium', staff: 1 },
    ...overrides,
  });
}

export function planAction(bookings: Bookings, rate: Rate, staff: StaffCount): Action {
  return { kind: 'plan', plan: { bookings, rate, staff } };
}

export function floorAction(activity: FloorActivity): Action {
  return { kind: 'floor', activity };
}

export function spec(weights: Partial<Record<keyof RewardSpec['kpis'], number>>): RewardSpec {
  const off = { on: false, weight: 0 };
  const s: RewardSpec = {
    version: 1,
    kpis: {
      profit: { ...off },
      dogsServed: { ...off },
      incidents: { ...off },
      reputation: { ...off },
      fatigue: { ...off },
      overRatio: { ...off },
    },
  };
  for (const [k, w] of Object.entries(weights)) {
    s.kpis[k as keyof RewardSpec['kpis']] = { on: true, weight: w as number };
  }
  return s;
}

export const round1 = spec({ profit: 10 });
