// Policies for the headless sim. BRIEF section 12 (the fixed policies by their exact rule) and section 4 (actions).
import type { Action, DayPlan, FloorActivity, Policy } from '../world/types.ts';

/** A floor pattern is the activity for blocks 1, 2 and 3. */
export type FloorPattern = readonly [FloorActivity, FloorActivity, FloorActivity];

const ALL_FREE: FloorPattern = ['freePlay', 'freePlay', 'freePlay'];

export const FLOOR_PATTERNS: Readonly<Record<string, FloorPattern>> = {
  allFree: ALL_FREE,
  allStructured: ['structuredPlay', 'structuredPlay', 'structuredPlay'],
  napAfternoon: ['freePlay', 'nap', 'freePlay'],
  cleanAtPickup: ['freePlay', 'freePlay', 'clean'],
  allWalk: ['walk', 'walk', 'walk'],
};

/** Uniform over the legal actions, from the policy stream: one draw per call. */
export const randomPolicy: Policy = (_state, legal, rng) => {
  const pick = legal[Math.floor(rng.next() * legal.length)];
  if (pick === undefined) throw new Error('randomPolicy: no legal actions');
  return pick;
};

/** The action for one block of a day: the plan at drop-off, the pattern's activity on the floor. */
function dayAction(block: number, plan: DayPlan, pattern: FloorPattern): Action {
  if (block === 0) return { kind: 'plan', plan };
  const activity = pattern[block - 1];
  if (activity === undefined) throw new Error(`floor pattern has no activity for block ${block}`);
  return { kind: 'floor', activity };
}

/** Same plan every day, same pattern every day. */
export function stationaryPolicy(plan: DayPlan, pattern: FloorPattern): Policy {
  return (state) => dayAction(state.block, plan, pattern);
}

/** A plan per day and a pattern per day (5 entries each). */
export function dayPlanPolicy(plans: readonly DayPlan[], patterns: readonly FloorPattern[]): Policy {
  return (state) => {
    const plan = plans[state.day];
    const pattern = patterns[state.day];
    if (plan === undefined || pattern === undefined) throw new Error(`dayPlanPolicy: no plan for day ${state.day}`);
    return dayAction(state.block, plan, pattern);
  };
}

const RECKLESS: DayPlan = { bookings: 'all', rate: 'premium', staff: 1 };

/** (all, premium, 1) every day, free play every block. Closes on Thursday (H7). */
export const recklessPolicy: Policy = stationaryPolicy(RECKLESS, ALL_FREE);

/** recklessPolicy with 2 staffers on Thursday: what the trained Round 1 GM should find. */
export const recklessCoveredPolicy: Policy = dayPlanPolicy(
  [RECKLESS, RECKLESS, RECKLESS, { ...RECKLESS, staff: 2 }, RECKLESS],
  [ALL_FREE, ALL_FREE, ALL_FREE, ALL_FREE, ALL_FREE],
);

/** (safe, standard, 2) every day; structured play, then nap, then clean. */
export const carefulPolicy: Policy = stationaryPolicy(
  { bookings: 'safe', rate: 'standard', staff: 2 },
  ['structuredPlay', 'nap', 'clean'],
);

export type PolicyName = 'random' | 'reckless' | 'recklessCovered' | 'careful';
export const POLICIES: Readonly<Record<PolicyName, Policy>> = {
  random: randomPolicy,
  reckless: recklessPolicy,
  recklessCovered: recklessCoveredPolicy,
  careful: carefulPolicy,
};
